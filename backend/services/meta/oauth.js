import axios from 'axios';

const ver = process.env.META_GRAPH_VERSION || 'v21.0';
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;

export async function exchangeUserToken(shortLived) {
  if (!shortLived) throw new Error('missing_user_token');
  const { data } = await axios.get('https://graph.facebook.com/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortLived,
    },
  });
  return data?.access_token;
}

export async function listPagesWithTokens(userAccessToken) {
  if (!userAccessToken) return [];
  const { data } = await axios.get(`https://graph.facebook.com/${ver}/me/accounts`, {
    params: {
      access_token: userAccessToken,
      fields: 'id,name,access_token,perms',
    },
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function getIgBusiness(pageId, pageAccessToken) {
  if (!pageId || !pageAccessToken) return null;
  const { data } = await axios.get(`https://graph.facebook.com/${ver}/${pageId}`, {
    params: {
      access_token: pageAccessToken,
      fields: 'instagram_business_account{id,username}',
    },
  });
  return data?.instagram_business_account || null;
}

export function hasPerm(perms, name) {
  return Array.isArray(perms) && perms.includes(name);
}

export default { exchangeUserToken, listPagesWithTokens, getIgBusiness, hasPerm };
