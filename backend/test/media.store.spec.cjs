const fs = require('fs');
const path = require('path');

process.env.S3_BUCKET = '';

const axiosGet = jest.fn();

let fetchAndStore;
let MEDIA_STORAGE_DIR;
let processAttachmentDownload;
let setInboxRepo;
let makeMemoryRepo;
let getInboxRepo;

beforeAll(async () => {
  await jest.unstable_mockModule('axios', () => ({
    __esModule: true,
    default: { get: (...args) => axiosGet(...args) },
    get: (...args) => axiosGet(...args),
  }));
  const mediaStore = await import('../services/media/store.js');
  fetchAndStore = mediaStore.fetchAndStore;
  MEDIA_STORAGE_DIR = mediaStore.MEDIA_STORAGE_DIR;
  ({ processAttachmentDownload } = await import('../jobs/ingest_attachments.js'));
  ({ setInboxRepo, makeMemoryRepo, getInboxRepo } = await import('../services/inbox/repo.js'));
});

beforeEach(() => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  axiosGet.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

test('fetchAndStore writes attachment to local storage', async () => {
  const buffer = Buffer.from('media-file');
  axiosGet.mockResolvedValueOnce({
    data: buffer,
    headers: { 'content-type': 'image/png', 'content-length': buffer.length },
  });

  const result = await fetchAndStore('https://example.com/img.png', null, 'org_test');
  expect(result.storage_key).toContain('org_test');
  expect(result.mime).toBe('image/png');
  const fullPath = path.join(MEDIA_STORAGE_DIR, result.storage_key);
  expect(fs.existsSync(fullPath)).toBe(true);
  const stored = fs.readFileSync(fullPath);
  expect(stored.equals(buffer)).toBe(true);
  fs.unlinkSync(fullPath);
});

test('processAttachmentDownload downloads and stores attachment', async () => {
  const repo = getInboxRepo();
  const message = await repo.createMessage({
    org_id: 'org_test',
    conversation_id: 'conv1',
    external_message_id: 'ext1',
    direction: 'in',
    text: 'hi',
    attachments_json: [
      { remote_url: 'https://cdn.example.com/file.jpg', mime: 'image/jpeg' },
    ],
    sent_at: new Date(),
    raw_json: {},
  });

  const buffer = Buffer.from('downloaded-file');
  axiosGet.mockResolvedValueOnce({
    data: buffer,
    headers: { 'content-type': 'image/jpeg', 'content-length': buffer.length },
  });

  await processAttachmentDownload({
    messageId: message.id,
    attachments: message.attachments_json,
    orgId: 'org_test',
    token: 'TOKEN',
  });

  const updated = await repo.getMessageById(message.id);
  const storedKey = updated.attachments_json[0].storage_key;
  expect(storedKey).toBeTruthy();
  const fullPath = path.join(MEDIA_STORAGE_DIR, storedKey);
  expect(fs.existsSync(fullPath)).toBe(true);
  const stored = fs.readFileSync(fullPath);
  expect(stored.equals(buffer)).toBe(true);
  fs.unlinkSync(fullPath);
});
