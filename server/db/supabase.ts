import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
}

// 管理员客户端 (service_role) - 绕过 RLS, 仅用于管理操作
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// 用户级客户端工厂 - 使用 anon key + 用户 JWT, RLS 生效
export function createUserClient(jwt: string): SupabaseClient {
    if (!supabaseAnonKey) {
        throw new Error('Missing SUPABASE_ANON_KEY in environment variables');
    }
    return createClient(supabaseUrl!, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
        },
    });
}
