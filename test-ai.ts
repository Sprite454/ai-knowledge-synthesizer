import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

global.fetch = fetch as any;

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function testAI() {
    console.log('🧪 Testing AI route directly...');

    // Login to get token
    let res = await supabase.auth.signInWithPassword({
        email: 'test-a-1772699496727@example.com',
        password: 'securepassword123'
    });

    const token = res.data?.session?.access_token;
    if (!token) {
        console.error('Login failed, cannot get JWT:', res.error);
        return;
    }

    console.log('✅ Logged in for test');

    const testWith = async (provider: string) => {
        console.log(`\n============== Testing ${provider} ==============`);
        try {
            const response = await fetch('http://localhost:3000/api/v1/ai/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    text: "请总结一下光合作用的过程。",
                    provider: provider
                })
            });

            const txt = await response.text();
            console.log(`Status: ${response.status}`);
            if (!response.ok) {
                console.log(`Error Response: ${txt}`);
            } else {
                console.log(`Success Response preview: ${txt.slice(0, 100)}...`);
            }
        } catch (e: any) {
            console.error('Fetch error:', e);
        }
    }

    await testWith('gemini');
    await testWith('deepseek');
}

testAI();
