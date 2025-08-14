
import express from 'express';
import { appendMessage } from '../../services/messages.js';
const router = express.Router();

router.get('/', (req,res)=>{
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

router.post('/', async (req,res)=>{
  try{
    const entries = req.body.entry || [];
    for (const e of entries){
      for (const m of (e.messaging || [])){
        const msg = m.message;
        if (!msg) continue;
        await appendMessage({
          channel_type: 'facebook',
          external_from: m.sender?.id,
          text: msg.text || null,
          type: (msg.attachments?.[0]?.type) || 'text',
          attachments: msg.attachments || null,
          ts: m.timestamp || Date.now()
        });
      }
    }
    res.json({ received:true });
  }catch(e){
    console.error('FB webhook error', e.message);
    res.sendStatus(200);
  }
});

export default router;



