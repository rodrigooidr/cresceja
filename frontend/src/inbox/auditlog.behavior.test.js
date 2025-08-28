import { append, load, clear, filter, exportJson } from './auditlog';

const CID = 'conv-test-1';

beforeEach(() => { clear(CID); });
afterAll(() => { clear(CID); });

test('append/load/limit', () => {
  append(CID, { kind: 'message', action: 'sent', meta: { text: 'hi' } });
  append(CID, { kind: 'ai', action: 'enabled' });
  let items = load(CID);
  expect(items.length).toBe(2);
  expect(items[0].kind).toBe('message');

  // limit 500
  for (let i = 0; i < 510; i++) {
    append(CID, { kind: 'tag', action: 'added', meta: { i } });
  }
  items = load(CID);
  expect(items.length).toBe(500);
});

test('filter by kind and query', () => {
  clear(CID);
  append(CID, { kind: 'crm', action: 'status_changed', meta: { to: 'Won' } });
  append(CID, { kind: 'media', action: 'rejected', meta: { reason: 'file-too-large' } });
  append(CID, { kind: 'message', action: 'failed', meta: { code: 500 } });

  const all = load(CID);
  const onlyMedia = filter(all, { kinds: ['media'] });
  expect(onlyMedia).toHaveLength(1);

  const byText = filter(all, { query: 'failed' });
  expect(byText).toHaveLength(1);
  expect(byText[0].kind).toBe('message');
});

test('exportJson produces a JSON string', () => {
  append(CID, { kind: 'message', action: 'sent' });
  const items = load(CID);
  const json = exportJson(items);
  expect(typeof json).toBe('string');
  expect(json).toContain('"kind":');
});
