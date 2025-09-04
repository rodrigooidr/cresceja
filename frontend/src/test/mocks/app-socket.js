// Mock robusto: cobre import default e named, e implementa on/off/once/emit
const makeFakeSocket = () => {
  const handlers = new Map();

  const on = jest.fn((evt, cb) => {
    const list = handlers.get(evt) || [];
    list.push(cb);
    handlers.set(evt, list);
    return socket; // permite chaining
  });

  const off = jest.fn((evt, cb) => {
    if (!handlers.has(evt)) return socket;
    if (!cb) { handlers.delete(evt); return socket; }
    const list = handlers.get(evt).filter(h => h !== cb);
    if (list.length) handlers.set(evt, list); else handlers.delete(evt);
    return socket;
  });

  const once = jest.fn((evt, cb) => {
    const wrapper = (...args) => { cb(...args); off(evt, wrapper); };
    on(evt, wrapper);
    return socket;
  });

  const emit = jest.fn((evt, payload) => {
    const list = handlers.get(evt) || [];
    list.forEach(h => h(payload));
    return socket;
  });

  const connect = jest.fn(() => socket);
  const close = jest.fn(() => socket);
  const disconnect = jest.fn(() => socket);

  const socket = { on, off, once, emit, connect, close, disconnect };
  return socket;
};

// named export
export const makeSocket = jest.fn(() => makeFakeSocket());

// default export como função (para cobrir `import makeSocket from ...`)
export default function makeSocketDefault() {
  return makeSocket();
}
