-- =============================================
-- Migration V2: 多用户支持 (user_id + RLS)
-- =============================================
-- 在 Supabase SQL Editor 中执行此脚本

-- Step 1: 为所有核心表添加 user_id 字段
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE card_tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: 启用 RLS
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;

-- Step 3: 创建 RLS 策略

-- === cards ===
DROP POLICY IF EXISTS "cards_select_own" ON cards;
CREATE POLICY "cards_select_own" ON cards FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cards_insert_own" ON cards;
CREATE POLICY "cards_insert_own" ON cards FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cards_update_own" ON cards;
CREATE POLICY "cards_update_own" ON cards FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cards_delete_own" ON cards;
CREATE POLICY "cards_delete_own" ON cards FOR DELETE USING (auth.uid() = user_id);

-- === categories ===
DROP POLICY IF EXISTS "categories_select_own" ON categories;
CREATE POLICY "categories_select_own" ON categories FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON categories;
CREATE POLICY "categories_insert_own" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_update_own" ON categories;
CREATE POLICY "categories_update_own" ON categories FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_delete_own" ON categories;
CREATE POLICY "categories_delete_own" ON categories FOR DELETE USING (auth.uid() = user_id);

-- === tags ===
DROP POLICY IF EXISTS "tags_select_own" ON tags;
CREATE POLICY "tags_select_own" ON tags FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tags_insert_own" ON tags;
CREATE POLICY "tags_insert_own" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tags_update_own" ON tags;
CREATE POLICY "tags_update_own" ON tags FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tags_delete_own" ON tags;
CREATE POLICY "tags_delete_own" ON tags FOR DELETE USING (auth.uid() = user_id);

-- === action_items ===
DROP POLICY IF EXISTS "action_items_select_own" ON action_items;
CREATE POLICY "action_items_select_own" ON action_items FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "action_items_insert_own" ON action_items;
CREATE POLICY "action_items_insert_own" ON action_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "action_items_update_own" ON action_items;
CREATE POLICY "action_items_update_own" ON action_items FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "action_items_delete_own" ON action_items;
CREATE POLICY "action_items_delete_own" ON action_items FOR DELETE USING (auth.uid() = user_id);

-- === chat_messages ===
DROP POLICY IF EXISTS "chat_messages_select_own" ON chat_messages;
CREATE POLICY "chat_messages_select_own" ON chat_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_insert_own" ON chat_messages;
CREATE POLICY "chat_messages_insert_own" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_update_own" ON chat_messages;
CREATE POLICY "chat_messages_update_own" ON chat_messages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_messages_delete_own" ON chat_messages;
CREATE POLICY "chat_messages_delete_own" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- === card_tags ===
DROP POLICY IF EXISTS "card_tags_select_own" ON card_tags;
CREATE POLICY "card_tags_select_own" ON card_tags FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "card_tags_insert_own" ON card_tags;
CREATE POLICY "card_tags_insert_own" ON card_tags FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "card_tags_update_own" ON card_tags;
CREATE POLICY "card_tags_update_own" ON card_tags FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "card_tags_delete_own" ON card_tags;
CREATE POLICY "card_tags_delete_own" ON card_tags FOR DELETE USING (auth.uid() = user_id);

-- Step 4: 允许 service_role 绕过 RLS (后端管理操作需要)
-- 注意: Supabase 的 service_role key 默认绕过 RLS, 无需额外操作

-- Step 5: 在 Supabase Dashboard 中启用 Email Auth:
-- Authentication → Providers → Email → 启用
-- 建议关闭 "Confirm email" 以方便开发测试
