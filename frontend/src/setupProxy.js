const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const target = process.env.CJ_API_TARGET || 'http://localhost:4000';

  // API HTTP
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: false,
      logLevel: 'silent',
    })
  );

  // Socket.IO WS
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      logLevel: 'silent',
    })
  );
};
