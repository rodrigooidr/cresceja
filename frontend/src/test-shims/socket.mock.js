// frontend/src/test-shims/socket.mock.js

// Mock de socket singleton compatível com a API usada no app:
// - makeSocket(): retorna sempre a MESMA instância (singleton)
// - instancia expõe: on/off/emit/connect/disconnect/close
// - helper de testes: __emit(event, payload)
// - reset global: __resetSocketForTests()

class MockSocket {
  constructor() {
    this._handlers = new Map(); // event -> Set<fn>
    this.connected = false;
  }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return this;
  }

  off(event, fn) {
    if (!this._handlers.has(event)) return this;
    if (fn) this._handlers.get(event).delete(fn);
    else this._handlers.get(event).clear();
    return this;
  }

  // Emite evento para listeners (simula evento vindo do servidor)
  __emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try { fn(payload); } catch (e) { /* evita quebrar o loop */ }
    }
  }

  emit(event, payload) {
    // Alguns códigos chamam s.emit localmente; vamos roteá-los
    this.__emit(event, payload);
    return this;
  }

  connect() {
    this.connected = true;
    this.__emit('connect');
    return this;
  }

  disconnect() {
    if (!this.connected) return this;
    this.connected = false;
    this.__emit('disconnect');
    return this;
  }

  close() {
    // alguns códigos chamam close() em desmontagem
    return this.disconnect();
  }

  removeAllListeners() {
    this._handlers.clear();
  }
}

let __socketSingleton = null;

function makeSocket() {
  if (!__socketSingleton) {
    __socketSingleton = new MockSocket();
    // conecta por padrão para não quebrar fluxos que esperam 'connect'
    __socketSingleton.connect();
  }
  return __socketSingleton;
}

function __resetSocketForTests() {
  if (__socketSingleton) {
    try { __socketSingleton.removeAllListeners(); } catch {}
  }
  __socketSingleton = null;
}

// Exportações compatíveis com ESM e CJS
const api = { makeSocket, __resetSocketForTests };
module.exports = api;
module.exports.default = api;
