
import express from 'express';
import { appendMessage } from '../../services/messages.js';
const router = express.Router();

router.get('/', (req,res)=>{
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.IG_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

router.post('/', async (req,res)=>{
  try{
    const entries = req.body.entry || [];
    for (const e of entries){
      for (const c of (e.changes || [])){
        const value = c.value || {};
        for (const m of (value.messages || [])){
          await appendMessage({
            channel_type: 'instagram',
            external_from: m.from,
            text: m.text?.body || null,
            type: m.type || 'text',
            attachments: m.attachments || null,
            ts: m.timestamp ? Number(m.timestamp) * 1000 : Date.now()
          });
        }
      }
    }
    res.json({ received:true });
  }catch(e){
    console.error('IG webhook error', e.message);
    res.sendStatus(200);
  }
});

export default router;



