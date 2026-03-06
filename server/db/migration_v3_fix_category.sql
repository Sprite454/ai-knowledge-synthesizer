-- =============================================
-- Migration V3: 修复多用户下分类名称冲突问题
-- =============================================
-- 现象描述：在原有单用户架构中，categories 表的 name 字段是全局唯一的 (UNIQUE 约束)。
-- 在多用户环境下，不同用户创建同名分类（如“工作”、“🎨 生活”）会触发 duplicate key value violates unique constraint "categories_name_key" 的错误，导致整个创建知识卡片流程失败。
--
-- 解决方案：
-- 1. 移除 `name` 的全局唯一约束
-- 2. 添加 `(user_id, name)` 的组合唯一约束，确保同一个用户不能建同名分类，但不同用户可以。

-- 1. 移除全局唯一约束 (可能由于自动生成，名字可能叫 categories_name_key)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- 2. 添加联合唯一约束，保证「单个用户」不会有重名分类
ALTER TABLE categories ADD CONSTRAINT categories_user_id_name_key UNIQUE (user_id, name);
