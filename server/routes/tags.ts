import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/v1/tags
router.get('/', async (req: Request, res: Response) => {
    try {
        const db = req.supabase!;
        const { data: tags, error } = await db
            .from('tags')
            .select('id, name');

        if (error) throw error;

        const result = [];
        for (const tag of tags || []) {
            const { count } = await db
                .from('card_tags')
                .select('*', { count: 'exact', head: true })
                .eq('tag_id', tag.id);

            result.push({ id: tag.id, name: tag.name, count: count || 0 });
        }

        result.sort((a, b) => b.count - a.count);
        res.json(result);
    } catch (error: any) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
