const { expect, describe, test, beforeAll, beforeEach } = global;

const enqueueMock = jest.fn();

let normalizeMessenger;
let ingestIncoming;
let setInboxRepo;
let makeMemoryRepo;

beforeAll(async () => {
  await jest.unstable_mockModule('../jobs/ingest_attachments.js', () => ({
    enqueueAttachmentDownload: (...args) => enqueueMock(...args),
  }));
  ({ normalizeMessenger } = await import('../services/meta/normalizers.js'));
  ({ ingestIncoming } = await import('../services/inbox/ingest.js'));
  ({ setInboxRepo, makeMemoryRepo } = await import('../services/inbox/repo.js'));
});

beforeEach(() => {
  const repo = makeMemoryRepo();
  setInboxRepo(repo);
  enqueueMock.mockClear();
  repo.seedChannelAccount({
    id: 'fb1',
    org_id: 'org_test',
    channel: 'facebook',
    external_account_id: 'PAGE_ID',
    access_token: 'TOKEN',
  });
});

describe('meta attachments normalization', () => {
  test('ingest enriches attachment metadata and schedules download', async () => {
    const events = normalizeMessenger({
      entry: [
        {
          id: 'PAGE_ID',
          messaging: [
            {
              sender: { id: 'user1' },
              timestamp: Date.now(),
              message: {
                mid: 'mid123',
                text: 'hi',
                attachments: [
                  {
                    type: 'image',
                    payload: { url: 'https://cdn.example.com/pic.jpg', mime_type: 'image/jpeg', width: 640, height: 360 },
                    file_size: 1234,
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    await ingestIncoming(events[0]);

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const payload = enqueueMock.mock.calls[0][0];
    expect(payload.attachments[0]).toMatchObject({
      remote_url: 'https://cdn.example.com/pic.jpg',
      mime: 'image/jpeg',
      width: 640,
      height: 360,
      storage_key: null,
    });
  });
});
