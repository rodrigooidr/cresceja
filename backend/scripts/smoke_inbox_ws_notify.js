// backend/scripts/smoke_inbox_ws_notify.js
import axios from 'axios';
import pg from 'pg';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const DB_URL = process.env.DATABASE_URL || 'postgres://cresceja:cresceja123@localhost:5432/cresceja_db';
const ADMIN_EMAIL = process.env.SMOKE_EMAIL || 'rodrigooidr@hotmail.com';
const ADMIN_PASS = process.env.SMOKE_PASS || 'R0drig01!';

(async () => {
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();

  const login = await axios.post(`${BASE_URL}/api/auth/login`, { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const token = login.data?.token;
  if (!token) throw new Error('login_failed');
  const orgId = login.data.user?.org_id;

  const conv = await db.query(`SELECT id FROM conversations WHERE org_id=$1 LIMIT 1`, [orgId]);
  if (!conv.rows[0]) throw new Error('no_conversation');
  const conversationId = conv.rows[0].id;

  await axios.post(
    `${BASE_URL}/api/inbox/conversations/${conversationId}/messages`,
    { text: 'ping' },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  console.log('smoke inbox message sent');
  await db.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
