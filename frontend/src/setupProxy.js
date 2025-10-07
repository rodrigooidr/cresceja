// frontend/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const target = process.env.REACT_APP_API_TARGET || 'http://localhost:4000';

  const common = {
    target,
    changeOrigin: true,
    ws: true,         // 🔑 WS para Socket.IO
    secure: false,
    xfwd: true,
    logLevel: 'warn',
  };

  // REST
  app.use(['/api'], createProxyMiddleware(common));

  // Socket.IO (polling + ws)
  app.use(['/socket.io'], createProxyMiddleware(common));
};
