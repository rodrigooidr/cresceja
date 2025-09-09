// Shim simples que expõe um objeto de status HTTP em CommonJS.
// Isso basta para satisfazer as libs que importam '@bundled-es-modules/statuses' nos testes.
const { STATUS_CODES } = require('http');
module.exports = { default: STATUS_CODES, STATUS_CODES };
