// backend/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';

import publicRouter from './routes/public.js';
import orgsRouter from './routes/orgs.js';
import subscriptionRouter from './routes/subscription.js';

import metaWebhookRouter from './routes/webhooks/meta.js';
import inboxExtraRouter from './routes/inboxExtra.js';

import { attachIO } from './services/realtime.js';
import { authRequired as auth } from './middleware/auth.js';
import { withOrg } from './middleware/withOrg.js';

const app = express();

// body parser global (para POST/PUT em geral)
app.use(express.json({ limit: '10mb' }));

// rotas públicas
app.use('/api/public', publicRouter);

// orgs (seu orgs.js expõe '/orgs/me', então prefixo aqui deve ser '/api')
app.use('/api', orgsRouter);

// assinatura (status/trial)
app.use('/api/subscription', subscriptionRouter);

// webhooks (se preferir manter parser dedicado, ok)
app.use('/api/webhooks', express.json({ limit: '10mb' }), metaWebhookRouter);

// rotas protegidas extras
app.use('/api/inbox', auth, withOrg, inboxExtraRouter);

const httpServer = http.createServer(app);
attachIO(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log('API + WS on', PORT));
