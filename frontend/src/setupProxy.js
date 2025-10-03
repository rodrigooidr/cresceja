// use SOMENTE caminhos de API — nunca "/"
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/api', '/auth'], // <— apenas rotas de backend
    createProxyMiddleware({
      target: 'http://localhost:4000',
      changeOrigin: false,
      xfwd: true,
      ws: false, // não proxie /ws do dev-server
      logLevel: 'warn',
      preserveHeaderKeyCase: true,
      onProxyReq(proxyReq, req) {
        const auth = req.headers['authorization'];
        if (auth) proxyReq.setHeader('Authorization', auth);
        const orgId = req.headers['x-org-id'];
        if (orgId) proxyReq.setHeader('X-Org-Id', orgId);
        return proxyReq;
      },
    })
  );
};
