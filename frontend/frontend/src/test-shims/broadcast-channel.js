// src/test-shims/broadcast-channel.js

// Polyfill mínimo para Jest/JSDOM.
// Suporta addEventListener/removeEventListener e a propriedade onmessage.
class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this._listeners = new Set();
    this._onmessage = null;
  }

  postMessage(data) {
    // Entrega assíncrona para imitar o comportamento do browser
    queueMicrotask(() => {
      const event = { data };
      // listeners registrados via addEventListener('message', cb)
      for (const l of this._listeners) l(event);
      // handler via onmessage
      if (typeof this._onmessage === 'function') this._onmessage(event);
    });
  }

  addEventListener(type, cb) {
    if (type === 'message' && typeof cb === 'function') {
      this._listeners.add(cb);
    }
  }

  removeEventListener(type, cb) {
    if (type === 'message' && typeof cb === 'function') {
      this._listeners.delete(cb);
    }
  }

  set onmessage(fn) {
    this._onmessage = fn;
  }

  get onmessage() {
    return this._onmessage;
  }

  close() {
    this._listeners.clear();
    this._onmessage = null;
  }
}

if (!globalThis.BroadcastChannel) {
  // Expõe no ambiente de testes
  globalThis.BroadcastChannel = FakeBroadcastChannel;
}

export {};
