// Mock plano: evita conexões reais e expõe API básica usada pelo app
module.exports = {
  io: jest.fn(() => {
    const handlers = {};
    return {
      on: jest.fn((evt, fn) => {
        handlers[evt] = fn;
      }),
      off: jest.fn((evt) => {
        delete handlers[evt];
      }),
      emit: jest.fn(),
      close: jest.fn(),
      connect: jest.fn(() => {
        if (handlers.connect) handlers.connect();
      }),
    };
  }),
};
