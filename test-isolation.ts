import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Polyfill fetch
global.fetch = fetch as any;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

const BASE_URL = 'http://localhost:3000/api/v1';

async function request(path: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
}

async function runTest() {
    console.log('🧪 Starting A/B Account Isolation Test...\n');
    const userA = `test-a-${Date.now()}@example.com`;
    const userB = `test-b-${Date.now()}@example.com`;
    const password = 'securepassword123';

    // 1. 注册账号 A
    console.log(`👤 Registering User A (${userA})...`);
    let res = await supabase.auth.signUp({ email: userA, password });
    if (res.error) throw res.error;

    // 等待登录生效
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ User A registered and logged in.');

    // 2. 账号 A 创建卡片
    console.log(`📝 User A creating a card...`);
    const cardTitle = `Secret Card from User A ${Date.now()}`;
    const cardCreated = await request('/cards', {
        method: 'POST',
        body: JSON.stringify({
            title: cardTitle,
            coreConcept: 'Only User A should see this.',
            category: 'Secret Category A'
        })
    });
    console.log(`✅ Card created with ID: ${cardCreated.id}`);

    // 验证 A 能看到卡片
    let cards = await request('/cards');
    if (!cards.find((c: any) => c.title === cardTitle)) {
        throw new Error('User A cannot fetch their own card!');
    }
    console.log(`✅ User A can see their own card.`);

    // 3. 登出 A，注册账号 B
    console.log(`\n🚪 Signing out User A...`);
    await supabase.auth.signOut();

    console.log(`👤 Registering User B (${userB})...`);
    res = await supabase.auth.signUp({ email: userB, password });
    if (res.error) throw res.error;

    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ User B registered and logged in.');

    // 4. B 获取卡片，验证隔离
    console.log(`🔍 User B fetching cards...`);
    cards = await request('/cards');

    const leak = cards.find((c: any) => c.title === cardTitle);
    if (leak) {
        throw new Error('🚨 DATA LEAK: User B can see User A\'s card!');
    } else {
        console.log(`✅ SUCCESS: User B cannot see User A's card. (Cards count: ${cards.length})`);
    }

    // 清理
    console.log(`\n🚪 Signing out User B...`);
    await supabase.auth.signOut();
    console.log('🎉 All security tests passed successfully!');
}

runTest().catch(console.error);
