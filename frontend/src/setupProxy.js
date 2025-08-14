const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use('/api',
    createProxyMiddleware({ target: 'http://localhost:4000', changeOrigin: true })
  );
  app.use('/socket.io',
    createProxyMiddleware({ target: 'http://localhost:4000', ws: true, changeOrigin: true })
  );
};
