// backend/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import metaWebhookRouter from './routes/webhooks/meta.js';
import inboxExtraRouter from './routes/inboxExtra.js';
import { attachIO } from './services/realtime.js';
import { authRequired as auth } from './middleware/auth.js';
import { withOrg } from './middleware/withOrg.js';

const app = express();

const httpServer = http.createServer(app);
attachIO(httpServer);

// webhooks (sem auth)
app.use('/api/webhooks', express.json({ limit: '10mb' }), metaWebhookRouter);

// inbox extra (com auth/withOrg definidos no app)
app.use('/api/inbox', auth, withOrg, inboxExtraRouter);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log('API + WS on', PORT));
