import { Router } from 'express';
import { listLeads, createLead, qualifyLead, moveToOpportunity } from '../controllers/leadsController.js';

const router = Router();

// GET /api/leads
router.get('/', listLeads);

// POST /api/leads
router.post('/', createLead);

// PUT /api/leads/:id/qualificar
router.put('/:id/qualificar', qualifyLead);

// POST /api/leads/:id/mover-para-oportunidade
router.post('/:id/mover-para-oportunidade', moveToOpportunity);

export default router;
