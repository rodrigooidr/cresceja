// ⚠️ Router mantido apenas para compatibilidade de código.
// NÃO registrar este arquivo no servidor para evitar rotas duplicadas.
// Ele reexporta o router canônico de /api/orgs/:orgId/features.
// Se for importado por engano, o handler e o payload serão idênticos.

import router from './org.features.js';
export default router;
