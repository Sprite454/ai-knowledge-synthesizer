-- ============================================
-- AI Knowledge Synthesizer - Supabase Schema
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 知识卡片表
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  main_entity TEXT,
  content_type TEXT,
  core_concept TEXT NOT NULL,
  index_points JSONB NOT NULL DEFAULT '[]',
  full_markdown TEXT NOT NULL DEFAULT '',
  mindmap TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  source_url TEXT,
  source_type TEXT DEFAULT 'text',
  images JSONB NOT NULL DEFAULT '[]',
  is_starred BOOLEAN NOT NULL DEFAULT false,
  merged_count INT NOT NULL DEFAULT 1,
  source_card_ids JSONB NOT NULL DEFAULT '[]',
  original_source_cards JSONB NOT NULL DEFAULT '[]',
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- 卡片-标签关联表
CREATE TABLE IF NOT EXISTS card_tags (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

-- 行动项
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

-- 聊天记录
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  suggested_questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category_id);
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_is_starred ON cards(is_starred);
CREATE INDEX IF NOT EXISTS idx_card_tags_card ON card_tags(card_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_tag ON card_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_action_items_card ON action_items(card_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_card ON chat_messages(card_id);

-- 插入默认分类
INSERT INTO categories (name, sort_order) VALUES
  ('📚 知识库', 0),
  ('💼 工作', 1),
  ('🚀 个人成长', 2),
  ('🎨 生活', 3),
  ('📥 未分类', 4)
ON CONFLICT (name) DO NOTHING;
