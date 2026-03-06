import { SupabaseClient } from '@supabase/supabase-js';

// ========== Helper: 确保分类存在，返回其 ID ==========
export async function ensureCategoryId(db: SupabaseClient, categoryName: string, userId: string): Promise<string> {
    const { data: existing } = await db
        .from('categories')
        .select('id')
        .eq('name', categoryName)
        .single();

    if (existing) return existing.id;

    const { data: created, error } = await db
        .from('categories')
        .insert({ name: categoryName, user_id: userId })
        .select('id')
        .single();

    if (error) throw error;
    return created!.id;
}

// ========== Helper: 确保标签存在，返回其 ID ==========
async function ensureTagId(db: SupabaseClient, tagName: string, userId: string): Promise<string> {
    const { data: existing } = await db
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .single();

    if (existing) return existing.id;

    const { data: created, error } = await db
        .from('tags')
        .insert({ name: tagName, user_id: userId })
        .select('id')
        .single();

    if (error) throw error;
    return created!.id;
}

// ========== 组装卡片：从数据库行 → 前端格式 ==========
async function assembleCard(db: SupabaseClient, row: any): Promise<any> {
    // 获取分类名
    let categoryName = '📥 未分类';
    if (row.category_id) {
        const { data: cat } = await db
            .from('categories')
            .select('name')
            .eq('id', row.category_id)
            .single();
        if (cat) categoryName = cat.name;
    }

    // 获取标签
    const { data: tagRows } = await db
        .from('card_tags')
        .select('tag_id, tags(name)')
        .eq('card_id', row.id);

    const tags = (tagRows || []).map((t: any) => t.tags?.name).filter(Boolean);

    // 获取行动项
    const { data: actionRows } = await db
        .from('action_items')
        .select('id, text, completed, sort_order')
        .eq('card_id', row.id)
        .order('sort_order');

    const actionItems = (actionRows || []).map((a: any) => ({
        id: a.id,
        text: a.text,
        completed: a.completed,
    }));

    // 获取聊天记录
    const { data: chatRows } = await db
        .from('chat_messages')
        .select('id, role, content, suggested_questions, created_at')
        .eq('card_id', row.id)
        .order('created_at');

    const chatHistory = (chatRows || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        suggestedQuestions: m.suggested_questions,
    }));

    return {
        id: row.id,
        title: row.title,
        mainEntity: row.main_entity,
        contentType: row.content_type,
        coreConcept: row.core_concept,
        index: row.index_points,
        fullMarkdown: row.full_markdown,
        mindmap: row.mindmap,
        category: categoryName,
        sourceUrl: row.source_url,
        sourceType: row.source_type,
        images: row.images,
        isStarred: row.is_starred,
        mergedCount: row.merged_count,
        sourceCards: row.source_card_ids?.length > 0 ? row.source_card_ids : undefined,
        originalSourceCards: row.original_source_cards?.length > 0 ? row.original_source_cards : undefined,
        x: row.x,
        y: row.y,
        createdAt: new Date(row.created_at).getTime(),
        tags,
        actionItems,
        chatHistory,
    };
}

// ========== 获取所有卡片 ==========
export async function getAllCards(db: SupabaseClient): Promise<any[]> {
    const { data: rows, error } = await db
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows) return [];

    const cards = await Promise.all(rows.map(row => assembleCard(db, row)));
    return cards;
}

// ========== 获取单个卡片 ==========
export async function getCardById(db: SupabaseClient, id: string): Promise<any | null> {
    const { data: row, error } = await db
        .from('cards')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !row) return null;
    return assembleCard(db, row);
}

// ========== 创建卡片 ==========
export async function createCard(db: SupabaseClient, userId: string, input: any): Promise<any> {
    const categoryId = input.category ? await ensureCategoryId(db, input.category, userId) : null;
    const now = input.createdAt ? new Date(input.createdAt).toISOString() : new Date().toISOString();

    const { data: row, error } = await db
        .from('cards')
        .insert({
            title: input.title,
            main_entity: input.mainEntity || null,
            content_type: input.contentType || null,
            core_concept: input.coreConcept,
            index_points: input.index || [],
            full_markdown: input.fullMarkdown || '',
            mindmap: input.mindmap || '',
            category_id: categoryId,
            source_url: input.sourceUrl || null,
            source_type: input.sourceType || 'text',
            images: input.images || [],
            is_starred: input.isStarred || false,
            merged_count: input.mergedCount || 1,
            source_card_ids: input.sourceCardIds || [],
            original_source_cards: input.originalSourceCards || [],
            x: input.x ?? null,
            y: input.y ?? null,
            user_id: userId,
            created_at: now,
            updated_at: now,
        })
        .select()
        .single();

    if (error) throw error;

    // 插入标签
    if (input.tags?.length > 0) {
        for (const tagName of input.tags) {
            const tagId = await ensureTagId(db, tagName.trim(), userId);
            await db.from('card_tags').upsert({ card_id: row!.id, tag_id: tagId, user_id: userId });
        }
    }

    // 插入行动项
    if (input.actionItems?.length > 0) {
        const items = input.actionItems.map((item: any, idx: number) => ({
            card_id: row!.id,
            text: item.text,
            completed: item.completed || false,
            sort_order: idx,
            user_id: userId,
        }));
        await db.from('action_items').insert(items);
    }

    // 插入聊天记录
    if (input.chatHistory?.length > 0) {
        const msgs = input.chatHistory.map((msg: any) => ({
            card_id: row!.id,
            role: msg.role,
            content: msg.content,
            suggested_questions: msg.suggestedQuestions || [],
            user_id: userId,
            created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : now,
        }));
        await db.from('chat_messages').insert(msgs);
    }

    return getCardById(db, row!.id);
}

// ========== 更新卡片 ==========
export async function updateCard(db: SupabaseClient, userId: string, id: string, updates: any): Promise<any | null> {
    const updateData: any = { updated_at: new Date().toISOString() };

    // 映射字段名 camelCase → snake_case
    const fieldMap: Record<string, string> = {
        title: 'title', mainEntity: 'main_entity', contentType: 'content_type',
        coreConcept: 'core_concept', fullMarkdown: 'full_markdown', mindmap: 'mindmap',
        sourceUrl: 'source_url', sourceType: 'source_type', x: 'x', y: 'y',
    };

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
        if (updates[jsKey] !== undefined) updateData[dbCol] = updates[jsKey];
    }

    // JSON 字段
    if (updates.index !== undefined) updateData.index_points = updates.index;
    if (updates.images !== undefined) updateData.images = updates.images;
    if (updates.sourceCardIds !== undefined) updateData.source_card_ids = updates.sourceCardIds;
    if (updates.originalSourceCards !== undefined) updateData.original_source_cards = updates.originalSourceCards;

    // Boolean / Number
    if (updates.isStarred !== undefined) updateData.is_starred = updates.isStarred;
    if (updates.mergedCount !== undefined) updateData.merged_count = updates.mergedCount;

    // 分类
    if (updates.category !== undefined) {
        updateData.category_id = await ensureCategoryId(db, updates.category, userId);
    }

    const { error } = await db.from('cards').update(updateData).eq('id', id);
    if (error) throw error;

    // 更新标签
    if (updates.tags !== undefined) {
        await db.from('card_tags').delete().eq('card_id', id);
        for (const tagName of updates.tags) {
            const tagId = await ensureTagId(db, tagName.trim(), userId);
            await db.from('card_tags').upsert({ card_id: id, tag_id: tagId, user_id: userId });
        }
    }

    // 更新行动项
    if (updates.actionItems !== undefined) {
        await db.from('action_items').delete().eq('card_id', id);
        if (updates.actionItems.length > 0) {
            const items = updates.actionItems.map((item: any, idx: number) => ({
                card_id: id, text: item.text, completed: item.completed || false, sort_order: idx, user_id: userId,
            }));
            await db.from('action_items').insert(items);
        }
    }

    // 更新聊天记录
    if (updates.chatHistory !== undefined) {
        await db.from('chat_messages').delete().eq('card_id', id);
        if (updates.chatHistory.length > 0) {
            const msgs = updates.chatHistory.map((msg: any) => ({
                card_id: id, role: msg.role, content: msg.content,
                suggested_questions: msg.suggestedQuestions || [],
                user_id: userId,
                created_at: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
            }));
            await db.from('chat_messages').insert(msgs);
        }
    }

    return getCardById(db, id);
}

// ========== 删除卡片 ==========
export async function deleteCard(db: SupabaseClient, id: string): Promise<boolean> {
    const { error } = await db.from('cards').delete().eq('id', id);
    if (error) throw error;
    return true;
}

// ========== 切换星标 ==========
export async function toggleStar(db: SupabaseClient, id: string): Promise<any | null> {
    const { data: row } = await db.from('cards').select('is_starred').eq('id', id).single();
    if (!row) return null;

    await db.from('cards').update({
        is_starred: !row.is_starred,
        updated_at: new Date().toISOString(),
    }).eq('id', id);

    return getCardById(db, id);
}

// ========== 更新白板位置 ==========
export async function updatePosition(db: SupabaseClient, id: string, x: number, y: number): Promise<boolean> {
    const { error } = await db.from('cards').update({
        x, y, updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
    return true;
}
