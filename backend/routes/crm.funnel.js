import express from 'express';
const router = express.Router();

router.post('/crm/funnel/from-conversation', async (req, res, next) => {
  try {
    const { conversation_id } = req.body;
    const opportunity_id = await req.db.createOpportunityFromConversation(conversation_id);
    return res.json({ opportunity_id });
  } catch (e) { next(e); }
});

export default router;
