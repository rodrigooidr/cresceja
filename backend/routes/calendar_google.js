
import express from 'express';
import { getAuthUrl, handleCallback, createEvent } from '../services/calendar/google.js';
const router = express.Router();
router.get('/auth', (req,res)=>{
  // Expect req.user injected by upstream middleware in real app; here, allow query uid for simplicity during setup
  const uid = (req.user && req.user.id) || req.query.uid || '00000000-0000-0000-0000-000000000000';
  const url = getAuthUrl(`uid:${uid}`);
  res.json({ url });
});
router.get('/callback', async (req,res)=>{
  const code = req.query.code;
  const state = req.query.state || '';
  const userId = state.replace('uid:','');
  if(!code || !userId) return res.status(400).send('Missing code or state');
  await handleCallback(code, userId);
  res.send('Google Calendar conectado! Você pode fechar esta aba.');
});
router.post('/event', async (req,res)=>{
  const uid = (req.user && req.user.id) || req.body.user_id;
  const { summary, start, end } = req.body || {};
  const r = await createEvent(uid, { summary, start, end });
  res.status(r.ok ? 200 : 409).json(r);
});
export default router;



