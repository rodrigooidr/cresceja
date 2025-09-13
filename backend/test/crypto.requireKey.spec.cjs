const originalEnv = { ...process.env };

afterEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

test('exits if GOOGLE_TOKEN_ENC_KEY missing in production', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.GOOGLE_TOKEN_ENC_KEY;
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(import('../services/crypto.js')).rejects.toThrow('exit');
  expect(err).toHaveBeenCalled();
  exit.mockRestore();
  err.mockRestore();
});
