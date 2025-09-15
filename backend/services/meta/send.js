import axios from 'axios';
const ver = process.env.META_GRAPH_VERSION || 'v21.0';
const auth = (t) => ({ Authorization: `Bearer ${t}` });

export async function sendMessengerText(pageId, token, psid, text) {
  const url = `https://graph.facebook.com/${ver}/${pageId}/messages`;
  return axios.post(
    url,
    { recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text } },
    { headers: auth(token) }
  );
}

export async function sendInstagramText(igUserId, token, igsid, text) {
  const url = `https://graph.facebook.com/${ver}/${igUserId}/messages`;
  return axios.post(
    url,
    { recipient: { id: igsid }, message: { text } },
    { headers: auth(token) }
  );
}

export default { sendMessengerText, sendInstagramText };
