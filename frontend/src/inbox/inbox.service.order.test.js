import { listConversations } from './inbox.service.js';
import inboxApi from '@/api/inboxApi';

jest.mock('@/api/inboxApi');

const convs = [
  { id: 1, last_message_at: '2024-01-01T10:00:00Z', updated_at: '2024-01-01T09:00:00Z' },
  { id: 2, last_message_at: '2024-01-02T10:00:00Z', updated_at: '2024-01-02T09:00:00Z' },
  { id: 3, last_message_at: null, updated_at: '2024-01-03T09:00:00Z' }
];

test('orders conversations by last_message_at desc', async () => {
  inboxApi.get.mockResolvedValue({ data: { items: convs } });
  const { items } = await listConversations();
  expect(items.map((c) => c.id)).toEqual([2, 1, 3]);
});
