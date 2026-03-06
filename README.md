# AI Knowledge Synthesizer 🧠

[![English](https://img.shields.io/badge/Language-English-blue)](#) [![中文](https://img.shields.io/badge/语言-中文-red)](./README_zh.md)

![Project Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

**AI Knowledge Synthesizer** is an advanced, all-in-one knowledge management and extraction workspace. It leverages multiple state-of-the-art Large Language Models (LLMs) and headless browsers to automatically scrape, synthesize, and organize information from raw text, complex anti-crawler websites, PDFs, Markdown files, and even images into structured knowledge cards.

## ✨ Key Features

- **🤖 Multi-Model Engine**: Seamlessly switch between top-tier LLMs including **Google Gemini 1.5 Flash**, **Kimi Vision (Moonshot)**, and **DeepSeek**.
- **🕷️ Ultimate Web Scraper**: Built-in Puppeteer stealth proxy server smoothly bypasses severe anti-bot challenges on platforms like *Xiaohongshu*, *Zhihu*, and *WeChat Official Accounts*.
- **📄 Multi-Modal Parsing**: Instantly extract and comprehend data from URLs, raw text, `.pdf`, `.md`, and Image uploads (powered by native Kimi/Gemini Vision pipelines).
- **🗂️ Smart Organization**: Visually manage your knowledge cards with Kanban boards, category tags, and dynamic AI-generated mindmaps (Mermaid).
- **🔒 Secure Authentication**: Integrated with Supabase for robust user authentication and secure cloud database storage.

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- A [Supabase](https://supabase.com/) account and project
- API Keys for the AI models you plan to use (Gemini, Kimi, DeepSeek)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Sprite454/ai-knowledge-synthesizer.git
cd ai-knowledge-synthesizer
npm install
```

### 3. Environment Variables
Copy the example environment file and fill in your keys:
```bash
cp .env.example .env
```
Ensure you have the following correctly configured in your `.env`:
```env
# AI Providers
GEMINI_API_KEY=your_gemini_key
KIMI_API_KEY=your_kimi_key
DEEPSEEK_API_KEY=your_deepseek_key

# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### 4. Database Setup
Execute the SQL migrations provided in the `server/db/` folder in your Supabase SQL Editor to initialize the required tables (`cards`, `categories`, `tags`). *(Refer to [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions)* 

### 5. Run the Application
Start the development server (runs both the Vite frontend and Express backend concurrently):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to access the Synthesizer.

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Framer Motion, Lucide Icons, Vite
- **Backend**: Node.js, Express, Puppeteer (with Stealth Plugin), PDF-Parse, Multer
- **Database / Auth**: Supabase (PostgreSQL)

## 📄 License
This project is open-source and available under the MIT License.
