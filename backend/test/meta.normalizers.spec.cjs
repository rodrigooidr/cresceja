const { expect, describe, test } = global;

let normalizeMessenger, normalizeInstagram;

beforeAll(async () => {
  ({ normalizeMessenger, normalizeInstagram } = await import('../services/meta/normalizers.js'));
});

describe('meta normalizers', () => {
  test('normalizeMessenger produces internal events', () => {
    const body = {
      entry: [
        {
          id: '123',
          messaging: [
            {
              sender: { id: 'u1' },
              message: { mid: 'm1', text: 'hi' },
              timestamp: 111,
            },
          ],
        },
      ],
    };
    const events = normalizeMessenger(body);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: 'facebook',
      externalAccountId: '123',
      externalUserId: 'u1',
      messageId: 'm1',
      text: 'hi',
    });
  });

  test('normalizeInstagram produces internal events', () => {
    const body = {
      entry: [
        {
          id: 'ig1',
          changes: [
            {
              value: {
                timestamp: '222',
                thread_id: 't1',
                messages: [
                  {
                    id: 'm2',
                    from: { id: 'u2' },
                    text: 'hello',
                    attachments: [],
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = normalizeInstagram(body);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: 'instagram',
      externalAccountId: 'ig1',
      externalUserId: 'u2',
      externalThreadId: 't1',
      messageId: 'm2',
      text: 'hello',
    });
  });
});
