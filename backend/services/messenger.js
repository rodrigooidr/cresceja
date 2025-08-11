
const verifyToken = process.env.FB_VERIFY_TOKEN || 'verify_token';
function verifyWebhook(req, res){
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if(mode === 'subscribe' && token === verifyToken){ return res.status(200).send(challenge); }
  return res.sendStatus(403);
}
async function handleMessage(body){
  const entries = body.entry || [];
  const out = [];
  for(const e of entries){
    const messaging = (e.messaging || e.standby || []);
    for(const m of messaging){
      const msg = m.message;
      if(msg){
        out.push({
          from: m.sender?.id,
          text: msg.text || null,
          type: msg.attachments?.[0]?.type || 'text',
          attachments: msg.attachments || null,
          timestamp: m.timestamp
        });
      }
    }
  }
  return out;
}
export default { verifyWebhook, handleMessage };
