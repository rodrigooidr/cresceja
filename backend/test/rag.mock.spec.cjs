/* eslint-env jest */

let rag;
let queryMock;

beforeAll(async () => {
  queryMock = jest.fn(async () => ({
    rows: [
      { title: 'Doc A', uri: 'https://example.com/a', lang: 'pt', tags: ['faq'], source_type: 'upload', meta: { score: 0.9 } },
      { title: 'Doc B', uri: 'https://example.com/b', lang: 'pt', tags: ['help'], source_type: 'url', meta: { score: 0.8 } },
    ],
  }));
  await jest.unstable_mockModule('#db', () => ({ query: queryMock }));
  rag = await import('../services/ai/rag.js');
});

describe('rag.search', () => {
  beforeEach(() => {
    queryMock.mockClear();
  });

  test('returns up to topK results with text/meta', async () => {
    const results = await rag.search('org-1', 'como fazer?', { topK: 1 });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM kb_documents'), ['org-1', 1]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      text: 'Doc A',
      meta: expect.objectContaining({ sourceType: 'upload', uri: 'https://example.com/a' }),
    });
  });
});
