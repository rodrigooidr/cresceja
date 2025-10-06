import express from 'express';
import { google } from 'googleapis';
import { requireCalendarRole } from '../middleware/calendar.rbac.js';
import { encrypt } from '../lib/crypto.util.js';

const router = express.Router();

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GCAL_REDIRECT_URI
  );
}

router.post('/api/appointments/oauth/google/install', requireCalendarRole(['admin', 'owner']), (req, res) => {
  const { professionalId, orgId } = req.body || {};
  const scopes = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];
  const auth = oauthClient();
  const url = auth.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent', state: JSON.stringify({ professionalId, orgId }) });
  return res.status(200).json({ url });
});

router.get('/api/appointments/oauth/google/callback', async (req, res) => {
  const { code, state } = req.query || {};
  const auth = oauthClient();
  const { tokens } = await auth.getToken(String(code));
  // TODO: persistir em calendar_accounts (usar encrypt() para tokens)
  // Campos: org_id, professional_id, google_account_email, oauth_access_token(enc), oauth_refresh_token(enc), oauth_expiry, scopes
  return res.status(200).send('Google account connected. You can close this window.');
});

export default router;
