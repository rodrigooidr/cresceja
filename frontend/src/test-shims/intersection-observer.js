// Polyfill mínimo de IntersectionObserver p/ Jest/JSDOM
class FakeIntersectionObserver {
  constructor(callback, options = {}) {
    this._cb = callback;
    this._options = options;
    this._elements = new Set();
  }
  observe(el) { this._elements.add(el); }
  unobserve(el) { this._elements.delete(el); }
  disconnect() { this._elements.clear(); }
  takeRecords() { return []; }

  // Útil em testes se quiser disparar manualmente
  __trigger(isIntersecting = true, entries = null) {
    const list =
      entries ||
      [...this._elements].map(target => ({
        isIntersecting,
        target,
        time: Date.now(),
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: target.getBoundingClientRect
          ? target.getBoundingClientRect()
          : {},
        intersectionRect: {},
        rootBounds: null,
      }));
    this._cb(list, this);
  }
}
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = FakeIntersectionObserver;
}
export {};
