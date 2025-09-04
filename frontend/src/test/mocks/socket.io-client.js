export const io = () => ({
  on: jest.fn(),
  emit: jest.fn(),
  close: jest.fn(),
  connect: jest.fn(),
});
export default { io };

