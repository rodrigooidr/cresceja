// use SOMENTE caminhos de API — nunca "/"
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/api', '/auth'], // <— apenas rotas de backend
    createProxyMiddleware({
      target: 'http://localhost:4000',
      changeOrigin: true,
      ws: false, // não proxie /ws do dev-server
      logLevel: 'warn',
    })
  );
};
