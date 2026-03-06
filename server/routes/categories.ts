import { Router, Request, Response } from 'express';
import * as categoryService from '../services/categoryService';

const router = Router();

// GET /api/v1/categories
router.get('/', async (req: Request, res: Response) => {
    try {
        const categories = await categoryService.getAllCategories(req.supabase!);
        res.json(categories);
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/v1/categories
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const category = await categoryService.createCategory(req.supabase!, req.userId!, name);
        res.status(201).json(category);
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/v1/categories/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const category = await categoryService.renameCategory(req.supabase!, req.params.id, name);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (error: any) {
        if (error.message?.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error renaming category:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/v1/categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const fallback = (req.query.fallback as string) || '📥 未分类';
        await categoryService.deleteCategory(req.supabase!, req.userId!, req.params.id, fallback);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
