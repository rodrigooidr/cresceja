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
        const authz = req.headers['authorization'];
        const org = req.headers['x-org-id'];
        if (authz) proxyReq.setHeader('authorization', authz);
        if (org) proxyReq.setHeader('x-org-id', org);
        return proxyReq;
      },
    })
  );
};
