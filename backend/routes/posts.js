import { Router } from 'express';

const router = Router();

// Rota placeholder para evitar erros caso o servidor importe /posts
router.get('/health', (req, res) => res.json({ ok: true }));

export default router;
