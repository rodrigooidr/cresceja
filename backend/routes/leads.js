import { Router } from 'express';
import { listLeads, createLead } from '../controllers/leadsController.js';

const router = Router();

// GET /api/leads
router.get('/', listLeads);

// POST /api/leads
router.post('/', createLead);

export default router;
