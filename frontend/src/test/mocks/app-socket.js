export const makeSocket = jest.fn(() => {
  return {
    on: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
    connect: jest.fn(),
    off: jest.fn(),
  };
});

export default { makeSocket };
