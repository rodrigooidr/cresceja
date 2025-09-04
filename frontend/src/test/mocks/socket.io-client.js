const makeIo = () => ({
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  close: jest.fn(),
  disconnect: jest.fn(),
});

export const io = jest.fn(() => makeIo());
export default { io };
