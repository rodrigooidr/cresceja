const originalEnv = { ...process.env };

afterEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

test('exits if encryption key missing in production', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.CRESCEJA_ENC_KEY;
  delete process.env.GOOGLE_TOKEN_ENC_KEY;
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(import('../services/crypto.js')).rejects.toThrow('exit');
  expect(err).toHaveBeenCalled();
  exit.mockRestore();
  err.mockRestore();
});

test('warns when using legacy key', async () => {
  process.env.NODE_ENV = 'development';
  delete process.env.CRESCEJA_ENC_KEY;
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await import('../services/crypto.js');
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
