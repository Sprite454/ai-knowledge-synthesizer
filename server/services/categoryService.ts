import { SupabaseClient } from '@supabase/supabase-js';

export interface CategoryWithCount {
    id: string;
    name: string;
    sortOrder: number;
    count: number;
}

// ========== 获取所有分类（含卡片计数）==========
export async function getAllCategories(db: SupabaseClient): Promise<CategoryWithCount[]> {
    const { data: categories, error } = await db
        .from('categories')
        .select('id, name, sort_order')
        .order('sort_order');

    if (error) throw error;
    if (!categories) return [];

    const result: CategoryWithCount[] = [];
    for (const cat of categories) {
        const { count } = await db
            .from('cards')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id);

        result.push({
            id: cat.id,
            name: cat.name,
            sortOrder: cat.sort_order,
            count: count || 0,
        });
    }
    return result;
}

// ========== 创建分类 ==========
export async function createCategory(db: SupabaseClient, userId: string, name: string): Promise<CategoryWithCount> {
    const { data: maxRow } = await db
        .from('categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data, error } = await db
        .from('categories')
        .insert({ name, sort_order: sortOrder, user_id: userId })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') throw new Error(`Category "${name}" already exists`);
        throw error;
    }

    return { id: data!.id, name: data!.name, sortOrder: data!.sort_order, count: 0 };
}

// ========== 重命名分类 ==========
export async function renameCategory(db: SupabaseClient, id: string, newName: string): Promise<CategoryWithCount | null> {
    const { error } = await db
        .from('categories')
        .update({ name: newName })
        .eq('id', id);

    if (error) {
        if (error.code === '23505') throw new Error(`Category "${newName}" already exists`);
        throw error;
    }

    const all = await getAllCategories(db);
    return all.find(c => c.id === id) || null;
}

// ========== 删除分类 ==========
export async function deleteCategory(db: SupabaseClient, userId: string, id: string, fallbackName: string = '📥 未分类'): Promise<boolean> {
    let { data: fallback } = await db
        .from('categories')
        .select('id')
        .eq('name', fallbackName)
        .single();

    if (!fallback) {
        const { data: created } = await db
            .from('categories')
            .insert({ name: fallbackName, sort_order: 999, user_id: userId })
            .select('id')
            .single();
        fallback = created;
    }

    await db.from('cards').update({ category_id: fallback!.id }).eq('category_id', id);
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) throw error;
    return true;
}
