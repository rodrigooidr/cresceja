let resolveDbHealthcheckConfig;

beforeAll(async () => {
  ({ resolveDbHealthcheckConfig } = await import('../utils/dbHealthcheckFlag.js'));
});

describe('resolveDbHealthcheckConfig', () => {
  it('allows skipping when not in production', () => {
    const config = resolveDbHealthcheckConfig({ NODE_ENV: 'development', SKIP_DB_HEALTHCHECK: '1' });
    expect(config).toMatchObject({ skip: true, reason: 'skipped', requested: true });
  });

  it('ignores skip flag in production', () => {
    const config = resolveDbHealthcheckConfig({ NODE_ENV: 'production', SKIP_DB_HEALTHCHECK: '1' });
    expect(config).toMatchObject({ skip: false, reason: 'ignored_in_production', requested: true });
  });
});
