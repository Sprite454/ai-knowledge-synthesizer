# AI 知识合成器 (AI Knowledge Synthesizer) 🧠

[![English](https://img.shields.io/badge/Language-English-blue)](./README.md) [![中文](https://img.shields.io/badge/语言-中文-red)](#)

![Project Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

**AI 知识合成器** 是一款先进的、一体化的知识管理与智能提取工作台。它利用多种前沿的大语言模型（LLM）和真实的无头浏览器技术，自动从长文本、高反爬机制的复杂网站、PDF、Markdown 乃至本地图片中抓取、合成并提炼出结构化的知识卡片。

## 📸 界面预览

<div align="center">
  <!-- 请在 GitHub 网页端编辑时，将您的登录页图片拖放到下方引号内替换链接 -->
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="登录界面 (Login Interface)" width="48%">
  &nbsp;
  <!-- 请在 GitHub 网页端编辑时，将您的主程序图片拖放到下方引号内替换链接 -->
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="主程序面板 (Main Workspace)" width="48%">
  <br/>
  <em>(左：系统登录页 / 右：主程序工作台)</em>
</div>

## ✨ 核心特性

- **🤖 强大多模态引擎**: 支持无缝切换顶尖 AI 模型，包括 **Google Gemini 1.5 Flash**、**Kimi (月之暗面) Vision**，以及 **DeepSeek**。
- **🕷️ 终极网页穿透**: 内置搭载了防风控伪装插件的 Puppeteer 代理引擎，能够如同真人般轻松绕过**小红书**、**知乎**、**微信公众号**等平台的强力反爬虫策略，获取真实渲染内容。
- **📄 全格式深度解析**: 支持瞬间提取和理解来自 URL 链接、纯文本、`.pdf`、`.md` 以及图片上传的数据（由原生 Kimi / Gemini 视觉管道驱动）。
- **🗂️ 智能化管理面板**: 利用动态的看板流、智能标签分类以及 AI 自动生成的思维导图（Mermaid 格式）对内容进行可视化管理。
- **🔒 安全云端同步**: 深度集成 Supabase，提供坚固的用户认证隔离和云端数据库留存方案。

## 🚀 快速开始

### 1. 环境准备
- [Node.js](https://nodejs.org/) (建议版本 v18+)
- 注册好 [Supabase](https://supabase.com/) 账户及项目
- 获取你希望使用的 AI 模型 API 秘钥 (Gemini, Kimi, 或 DeepSeek)

### 2. 安装依赖
克隆仓库并安装底层依赖（由于包含反爬虫底层驱动，安装包含预编译浏览器）：
```bash
git clone https://github.com/Sprite454/ai-knowledge-synthesizer.git
cd ai-knowledge-synthesizer
npm install
```

### 3. 配置环境变量
请复制并重命名本地环境变量配置模板：
```bash
cp .env.example .env
```
并确保在 `.env` 中填写了以下必备密钥与服务接入点：
```env
# AI 模型密钥
GEMINI_API_KEY=修改为你的_gemini_key
KIMI_API_KEY=修改为你的_kimi_key
DEEPSEEK_API_KEY=修改为你的_deepseek_key

# Supabase 配置
VITE_SUPABASE_URL=你的_supabase_服务地址
VITE_SUPABASE_ANON_KEY=你的_supabase_公开密钥
SUPABASE_SERVICE_KEY=你的_supabase_服务端根密钥
```

### 4. 数据库初始化
请将 `server/db/` 目录下的 SQL 迁移文件复制到您的 Supabase SQL Editor 中依次执行，这会帮助您初始化数据表 (`cards`, `categories`, `tags`) 结构。 *(详见 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 文档)* 

### 5. 启动程序
启动本地全栈开发环境（Vite 前端与 Express 后端将同步拉起）：
```bash
npm run dev
```
打开你的浏览器访问 [http://localhost:5173](http://localhost:5173) 即可进入合成工作台。

## 🛠️ 技术栈揭秘
- **前端架构**: React, TypeScript, TailwindCSS, Framer Motion, Lucide Icons, Vite
- **后端架构**: Node.js, Express, Puppeteer (内置 Stealth 反风控隐身协议), PDF-Parse, Multer
- **云数据库与认证**: Supabase (PostgreSQL)

## 📄 开源协议
本项目采用 MIT 开源协议发布。
