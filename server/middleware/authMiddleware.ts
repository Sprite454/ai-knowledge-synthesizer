import { Request, Response, NextFunction } from 'express';
import { supabase, createUserClient } from '../db/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

// 扩展 Express Request 类型
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            supabase?: SupabaseClient;
        }
    }
}

/**
 * 认证中间件：
 * 1. 从 Authorization header 提取 JWT
 * 2. 验证 token 有效性
 * 3. 将 userId 和用户级 Supabase 客户端挂载到 req
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '未登录：请先登录后再操作' });
        }

        const token = authHeader.split(' ')[1];

        // 使用 service_role 客户端验证 JWT 并获取用户信息
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }

        // 挂载到 req 对象上供路由使用
        req.userId = user.id;
        req.supabase = createUserClient(token);

        next();
    } catch (error: any) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: '认证失败' });
    }
}
