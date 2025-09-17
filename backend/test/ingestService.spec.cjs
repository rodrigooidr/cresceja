/* eslint-env jest */

let service;
let queryMock;

beforeAll(async () => {
  queryMock = jest.fn(async () => ({ rows: [] }));
  await jest.unstable_mockModule('#db', () => ({ query: queryMock }));
  service = await import('../services/ai/ingestService.js');
});

describe('ingestService', () => {
  beforeEach(() => {
    queryMock.mockClear();
  });

  test('ingest stores document data', async () => {
    const stored = {
      id: 'doc-1',
      org_id: 'org-1',
      source_type: 'upload',
      uri: 'https://cdn/doc.pdf',
      lang: 'pt',
      title: 'Manual',
      tags: ['tag'],
      meta: { size: 10 },
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    };
    queryMock.mockResolvedValueOnce({ rows: [stored] });

    const result = await service.ingest('org-1', {
      source_type: 'upload',
      uri: 'https://cdn/doc.pdf',
      lang: 'pt',
      title: 'Manual',
      tags: ['tag'],
      meta: { size: 10 },
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kb_documents'),
      [
        'org-1',
        'upload',
        'https://cdn/doc.pdf',
        'pt',
        'Manual',
        ['tag'],
        { size: 10 },
        expect.any(Date),
      ]
    );
    expect(result).toEqual(stored);
  });

  test('reindex counts documents', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 7 }] });
    const result = await service.reindex('org-1');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), ['org-1']);
    expect(result).toEqual({ ok: true, indexed: 7 });
  });
});
