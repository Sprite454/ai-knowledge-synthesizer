import { Router, Request, Response } from 'express';
import * as cardService from '../services/cardService';

const router = Router();

// GET /api/v1/cards
router.get('/', async (req: Request, res: Response) => {
    try {
        const cards = await cardService.getAllCards(req.supabase!);
        res.json(cards);
    } catch (error: any) {
        console.error('Error fetching cards:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/v1/cards/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const card = await cardService.getCardById(req.supabase!, req.params.id);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    } catch (error: any) {
        console.error('Error fetching card:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/cards
router.post('/', async (req: Request, res: Response) => {
    try {
        const card = await cardService.createCard(req.supabase!, req.userId!, req.body);
        res.status(201).json(card);
    } catch (error: any) {
        console.error('Error creating card:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/v1/cards/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const card = await cardService.updateCard(req.supabase!, req.userId!, req.params.id, req.body);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    } catch (error: any) {
        console.error('Error updating card:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/v1/cards/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await cardService.deleteCard(req.supabase!, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting card:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/v1/cards/:id/star
router.put('/:id/star', async (req: Request, res: Response) => {
    try {
        const card = await cardService.toggleStar(req.supabase!, req.params.id);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    } catch (error: any) {
        console.error('Error toggling star:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/v1/cards/:id/position
router.put('/:id/position', async (req: Request, res: Response) => {
    try {
        const { x, y } = req.body;
        await cardService.updatePosition(req.supabase!, req.params.id, x, y);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error updating position:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/v1/cards/:id/actions/:actionId/toggle
router.put('/:id/actions/:actionId/toggle', async (req: Request, res: Response) => {
    try {
        const db = req.supabase!;
        const { data: row } = await db
            .from('action_items')
            .select('completed')
            .eq('id', req.params.actionId)
            .eq('card_id', req.params.id)
            .single();

        if (!row) return res.status(404).json({ error: 'Action item not found' });

        await db
            .from('action_items')
            .update({ completed: !row.completed })
            .eq('id', req.params.actionId);

        const card = await cardService.getCardById(db, req.params.id);
        res.json(card);
    } catch (error: any) {
        console.error('Error toggling action:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
