import { Router, Request, Response } from 'express';
import * as cardService from '../services/cardService';
import { ensureCategoryId } from '../services/cardService';

const router = Router();

// POST /api/v1/migrate/import
// 接受 localStorage 数据，批量导入到 Supabase
router.post('/import', async (req: Request, res: Response) => {
    try {
        const { cards, categories } = req.body;
        const db = req.supabase!;
        const userId = req.userId!;

        if (!cards || !Array.isArray(cards)) {
            return res.status(400).json({ error: 'cards array is required' });
        }

        // 先创建所有分类
        if (categories && Array.isArray(categories)) {
            for (const name of categories) {
                try { await ensureCategoryId(db, name, userId); } catch (e) { /* ignore */ }
            }
        }

        const imported: string[] = [];
        const errors: { id: string; error: string }[] = [];

        for (const card of cards) {
            try {
                await cardService.createCard(db, userId, {
                    title: card.title,
                    mainEntity: card.mainEntity,
                    contentType: card.contentType,
                    coreConcept: card.coreConcept,
                    index: card.index || card.details,
                    fullMarkdown: card.fullMarkdown || '',
                    mindmap: card.mindmap || '',
                    category: card.category || '📥 未分类',
                    sourceUrl: card.sourceUrl,
                    sourceType: card.sourceType || 'text',
                    images: card.images || [],
                    isStarred: card.isStarred || false,
                    mergedCount: card.mergedCount || 1,
                    sourceCardIds: card.sourceCards?.map((c: any) => c.id) || [],
                    originalSourceCards: card.originalSourceCards || [],
                    actionItems: card.actionItems || [],
                    tags: card.tags || [],
                    chatHistory: card.chatHistory || [],
                    x: card.x,
                    y: card.y,
                    createdAt: card.createdAt,
                });
                imported.push(card.id || card.title);
            } catch (err: any) {
                errors.push({ id: card.id || card.title, error: err.message });
            }
        }

        res.json({
            success: true,
            imported: imported.length,
            errors: errors.length,
            details: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
