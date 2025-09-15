import axios from 'axios';
const ver = process.env.META_GRAPH_VERSION || 'v21.0';

export async function subscribeFacebook(pageId, token) {
  const url = `https://graph.facebook.com/${ver}/${pageId}/subscribed_apps`;
  return axios.post(
    url,
    { subscribed_fields: ['messages','messaging_postbacks','messaging_reads','messaging_deliveries'] },
    { params: { access_token: token } }
  );
}

export async function subscribeInstagram(igUserId, token) {
  const url = `https://graph.facebook.com/${ver}/${igUserId}/subscribed_apps`;
  return axios.post(url, {}, { params: { access_token: token } });
}

export default { subscribeFacebook, subscribeInstagram };
