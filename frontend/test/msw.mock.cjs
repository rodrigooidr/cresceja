const makeHandler = (method) => (path, resolver) => ({ method, path, resolver });

const http = {
  get: makeHandler('GET'),
  post: makeHandler('POST'),
  put: makeHandler('PUT'),
  delete: makeHandler('DELETE'),
};

const HttpResponse = {
  json(body, init = {}) {
    const status = init.status ?? 200;
    return {
      status,
      body,
      json: async () => body,
    };
  },
};

module.exports = { http, HttpResponse };
