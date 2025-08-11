
import axios from 'axios';

const WA_BASE = 'https://graph.facebook.com/v20.0';

export async function sendText(to, text){
  if(!process.env.WA_PHONE_NUMBER_ID || !process.env.WA_TOKEN){
    console.warn('WhatsApp Cloud not configured');
    return false;
  }
  try{
    const url = `${WA_BASE}/${process.env.WA_PHONE_NUMBER_ID}/messages`;
    const res = await axios.post(url, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    }, {
      headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` }
    });
    return !!res.data;
  }catch(e){
    console.error('WA send error', e?.response?.data || e.message);
    return false;
  }
}
