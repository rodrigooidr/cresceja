const listJobs = [
  { id:'job1', org_id:'o1', page_id:'pg1', type:'video', message:'', media:{ url:'http://v' }, status:'pending' }
];
let encrypt;
let tokenEnc;
const mockQuery = jest.fn((sql, params) => {
  if (sql.startsWith('UPDATE facebook_publish_jobs j')) {
    const rows = listJobs.filter(j=>j.status==='pending').slice(0,20).map(j=>({ ...j, fb_page_id:'fbid', access_token: tokenEnc.c, enc_ver: tokenEnc.v }));
    rows.forEach(j=>{ j.status='creating'; });
    return { rows };
  }
  if (sql.startsWith("UPDATE facebook_publish_jobs SET status='done'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.status='done';
    job.published_post_id=params[1];
    return { rows:[] };
  }
  if (sql.startsWith("UPDATE facebook_publish_jobs SET status='failed'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.status='failed';
    job.error=params[1];
    return { rows:[] };
  }
  if (sql.startsWith('UPDATE facebook_pages SET is_active=false')) return { rows:[] };
  return { rows:[] };
});

jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));

let processPending;
beforeAll(async () => {
  process.env.GOOGLE_TOKEN_ENC_KEY = '12345678901234567890123456789012';
  ({ encrypt } = await import('../services/crypto.js'));
  tokenEnc = encrypt('tok');
  ({ processPending } = await import('../queues/facebook.publish.worker.js'));
});

test('worker uploads video and marks done', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ id:'vid1' }) })
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ status:'processing' }) })
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ status:'ready' }) });
  global.fetch = fetchMock;
  await processPending();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(listJobs[0].status).toBe('done');
  expect(listJobs[0].published_post_id).toBe('vid1');
});
