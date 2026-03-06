/**
 * Frontend API 客户端
 * 所有对后端的 HTTP 请求都通过此模块发起
 * 自动从 Supabase session 获取 JWT 并注入 Authorization header
 */

import { supabase } from '@/services/supabaseClient';

const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    // 从 Supabase 获取当前 session 的 JWT
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            ...headers,
            ...(options?.headers as Record<string, string> || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ========== Cards ==========
export const cardsApi = {
    list: () => request<any[]>('/cards'),
    get: (id: string) => request<any>(`/cards/${id}`),
    create: (data: any) => request<any>('/cards', {
        method: 'POST', body: JSON.stringify(data),
    }),
    update: (id: string, data: any) => request<any>(`/cards/${id}`, {
        method: 'PUT', body: JSON.stringify(data),
    }),
    delete: (id: string) => request<any>(`/cards/${id}`, { method: 'DELETE' }),
    toggleStar: (id: string) => request<any>(`/cards/${id}/star`, { method: 'PUT' }),
    updatePosition: (id: string, x: number, y: number) => request<any>(`/cards/${id}/position`, {
        method: 'PUT', body: JSON.stringify({ x, y }),
    }),
    toggleAction: (cardId: string, actionId: string) => request<any>(`/cards/${cardId}/actions/${actionId}/toggle`, {
        method: 'PUT',
    }),
};

// ========== Categories ==========
export const categoriesApi = {
    list: () => request<any[]>('/categories'),
    create: (name: string) => request<any>('/categories', {
        method: 'POST', body: JSON.stringify({ name }),
    }),
    rename: (id: string, name: string) => request<any>(`/categories/${id}`, {
        method: 'PUT', body: JSON.stringify({ name }),
    }),
    delete: (id: string, fallback?: string) =>
        request<any>(`/categories/${id}?fallback=${encodeURIComponent(fallback || '📥 未分类')}`, {
            method: 'DELETE',
        }),
};

// ========== Tags ==========
export const tagsApi = {
    list: () => request<any[]>('/tags'),
};

// ========== AI ==========
export const aiApi = {
    synthesize: (data: {
        text: string; images?: string[]; language?: string;
        existingTitles?: string[]; existingCategories?: string[];
        isVideo?: boolean; forcedType?: string;
    }) => request<any>('/ai/synthesize', {
        method: 'POST', body: JSON.stringify({ ...data, provider: localStorage.getItem('ai-provider') || 'deepseek' }),
    }),
    merge: (data: {
        cards: any[]; language?: string; existingTitles?: string[];
    }) => request<any[]>('/ai/merge', {
        method: 'POST', body: JSON.stringify({ ...data, provider: localStorage.getItem('ai-provider') || 'deepseek' }),
    }),
    chat: (data: {
        messages: any[]; context: string; language?: string; enableSearch?: boolean;
    }) => request<{ content: string; suggestedQuestions: string[] }>('/ai/chat', {
        method: 'POST', body: JSON.stringify({ ...data, provider: localStorage.getItem('ai-provider') || 'deepseek' }),
    }),
    deepDive: (data: {
        card: { title: string; coreConcept: string; tags: string[] }; language?: string;
    }) => request<{ content: string; sources: any[] }>('/ai/deep-dive', {
        method: 'POST', body: JSON.stringify({ ...data, provider: localStorage.getItem('ai-provider') || 'deepseek' }),
    }),
};

// ========== Proxies ==========
export const proxyApi = {
    feishu: (webhookUrl: string, payload: any) => request<any>('/proxy/feishu', {
        method: 'POST', body: JSON.stringify({ webhookUrl, payload }),
    }),
    reader: (url: string) => request<{ content: string }>('/proxy/reader', {
        method: 'POST', body: JSON.stringify({ url }),
    }),
};

// ========== Migration ==========
export const migrateApi = {
    import: (data: { cards: any[]; categories: string[] }) => request<any>('/migrate/import', {
        method: 'POST', body: JSON.stringify(data),
    }),
};

// ========== Files Support ==========
export const filesApi = {
    parse: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${BASE}/files/parse`, {
            method: 'POST',
            body: formData,
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP error ${res.status}`);
        }
        return res.json();
    }
};
