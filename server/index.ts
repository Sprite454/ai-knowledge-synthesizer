import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import cardsRouter from './routes/cards';
import categoriesRouter from './routes/categories';
import tagsRouter from './routes/tags';
import migrateRouter from './routes/migrate';
import aiRouter from './routes/ai';
import proxyRouter from './routes/proxy';
import filesRouter from './routes/files';
import { authMiddleware } from './middleware/authMiddleware';

dotenv.config();

async function startServer() {
    const app = express();
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    // JSON body parser (大限额：支持 base64 图片)
    app.use(express.json({ limit: '50mb' }));

    // 公开路由（无需认证）
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
    });

    // 受保护路由（需要认证）
    app.use('/api/v1/cards', authMiddleware, cardsRouter);
    app.use('/api/v1/categories', authMiddleware, categoriesRouter);
    app.use('/api/v1/tags', authMiddleware, tagsRouter);
    app.use('/api/v1/ai', authMiddleware, aiRouter);
    app.use('/api/v1/migrate', authMiddleware, migrateRouter);
    app.use('/api/v1/proxy', authMiddleware, proxyRouter);
    app.use('/api/v1/files', authMiddleware, filesRouter);

    // Vite 开发中间件
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static('dist'));
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📦 Supabase URL: ${process.env.SUPABASE_URL ? '✅ configured' : '❌ missing'}`);
        console.log(`🔑 Anon Key:     ${process.env.SUPABASE_ANON_KEY ? '✅ configured' : '❌ missing'}`);
        console.log(`🔐 Service Key:  ${process.env.SUPABASE_SERVICE_KEY ? '✅ configured' : '❌ missing'}`);
        console.log(`🤖 Gemini API:   ${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing'}`);
    });
}

startServer();
