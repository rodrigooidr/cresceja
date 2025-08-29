class FakeResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = FakeResizeObserver;
}
export {};
