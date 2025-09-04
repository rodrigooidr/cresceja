const handlers = {};

const makeFakeSocket = () => {
  const socket = {
    on: jest.fn((e, cb) => { handlers[e] = [...(handlers[e]||[]), cb]; return socket; }),
    off: jest.fn((e, cb) => {
      if (!handlers[e]) return socket;
      if (!cb) { delete handlers[e]; return socket; }
      handlers[e] = (handlers[e]||[]).filter(h => h !== cb);
      if (!handlers[e].length) delete handlers[e];
      return socket;
    }),
    once: jest.fn((e, cb) => { const wrap = (...a)=>{cb(...a); socket.off(e, wrap);}; socket.on(e, wrap); return socket; }),
    emit: jest.fn((e, p) => { (handlers[e]||[]).forEach(h => h(p)); return socket; }),
    connect: jest.fn(() => socket),
    close: jest.fn(() => socket),
    disconnect: jest.fn(() => socket),
  };
  return socket;
};

export const makeSocket = jest.fn(() => makeFakeSocket());
export const getSocket = jest.fn(() => makeSocket());
export const __handlers = handlers;
export default function makeSocketDefault() { return makeSocket(); }

