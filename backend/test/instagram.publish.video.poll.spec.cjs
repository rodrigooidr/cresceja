const listJobs = [
  { id:'job1', org_id:'o1', account_id:'acc1', type:'video', caption:'', media:{ url:'http://v' }, status:'pending', ig_user_id:'igid' }
];

const mockQuery = jest.fn((sql, params) => {
  if (sql.startsWith('UPDATE instagram_publish_jobs j')) {
    const rows = listJobs.filter(j=>j.status==='pending').slice(0,20).map(j=>({ ...j }));
    rows.forEach(j=>{ j.status='creating'; });
    return { rows };
  }
  if (sql.startsWith('UPDATE instagram_publish_jobs SET creation_id')) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.creation_id = params[1];
    return { rows:[] };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='publishing'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.status='publishing';
    return { rows:[] };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='done'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.status='done';
    job.creation_id=params[1];
    job.published_media_id=params[2];
    return { rows:[] };
  }
  if (sql.startsWith("UPDATE instagram_publish_jobs SET status='failed'")) {
    const job = listJobs.find(j=>j.id===params[0]);
    job.status='failed';
    job.error=params[1];
    return { rows:[] };
  }
  return { rows:[] };
});

jest.unstable_mockModule('#db', () => ({ query: (sql, params) => mockQuery(sql, params) }));
jest.unstable_mockModule('../services/instagramTokens.js', () => ({ refreshIfNeeded: jest.fn().mockResolvedValue({ access_token:'tok' }) }));

let processPending;
beforeAll(async () => {
  ({ processPending } = await import('../queues/instagram.publish.worker.js'));
});

test('worker polls video until finished and publishes', async () => {
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ id:'c1' }) })
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ status_code:'IN_PROGRESS', video_status:'PROCESSING' }) })
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ status_code:'FINISHED', video_status:'READY' }) })
    .mockResolvedValueOnce({ status:200, json:()=>Promise.resolve({ id:'pm1' }) });
  global.fetch = fetchMock;
  await processPending();
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(listJobs[0].status).toBe('done');
  expect(listJobs[0].published_media_id).toBe('pm1');
});
