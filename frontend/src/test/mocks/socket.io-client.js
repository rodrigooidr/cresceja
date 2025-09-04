export const io = jest.fn(() => ({
  on: jest.fn(),
  emit: jest.fn(),
  close: jest.fn(),
  connect: jest.fn(),
  off: jest.fn(),
}));

export default { io };

