const updateSpy = jest.fn();
const client = {
  query: jest.fn((sql, params) => {
    if (sql.includes('FROM content_suggestions')) {
      return Promise.resolve({ rows:[{ id:'s1', jobs_map:{ instagram:'ig1', facebook:'fb1' } }] });
    }
    if (sql.includes('FROM instagram_publish_jobs')) return Promise.resolve({ rows:[{ status:'done' }] });
    if (sql.includes('FROM facebook_publish_jobs')) return Promise.resolve({ rows:[{ status:'done' }] });
    if (sql.startsWith('UPDATE content_suggestions')) { updateSpy(sql, params); return Promise.resolve({}); }
    return Promise.resolve({ rows:[] });
  }),
  release: jest.fn()
};
const pool = { connect: async () => client };

describe('campaigns sync worker', () => {
  test('marks suggestion as published when jobs done', async () => {
    const mod = await import('../queues/campaigns.sync.worker.js');
    await mod.syncOnce(pool);
    expect(updateSpy).toHaveBeenCalled();
  });
});
