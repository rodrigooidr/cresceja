// backend/routes/webhooks/meta.js
import { Router } from 'express';
import * as ctrl from '../../controllers/webhooks/metaController.js';

const r = Router();

// Verificação do webhook (GET hub.*)
r.get('/meta/:provider', ctrl.verify);   // :provider = 'whatsapp' | 'instagram' | 'facebook'

// Recebimento de eventos (POST)
r.post('/meta/:provider', ctrl.receive);

export default r;
