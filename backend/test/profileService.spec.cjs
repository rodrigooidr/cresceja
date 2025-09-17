/* eslint-env jest */

let service;
let queryMock;

beforeAll(async () => {
  queryMock = jest.fn(async () => ({ rows: [] }));
  await jest.unstable_mockModule('#db', () => ({ query: queryMock }));
  service = await import('../services/ai/profileService.js');
});

beforeEach(() => {
  queryMock.mockClear();
});

describe('profileService', () => {
  test('getProfile returns default object when not found', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const profile = await service.getProfile('org-1');
    expect(profile).toEqual({ orgId: 'org-1' });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM org_ai_profiles'), ['org-1']);
  });

  test('updateProfile upserts and returns normalized profile', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          org_id: 'org-1',
          profile: { vertical: 'beauty', languages: ['pt-BR'] },
          updated_at: now,
          updated_by: 'user-1',
        },
      ],
    });

    const profile = await service.updateProfile('org-1', { vertical: 'beauty', languages: ['pt-BR'] }, 'user-1');
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO org_ai_profiles'),
      [
        'org-1',
        { vertical: 'beauty', languages: ['pt-BR'] },
        expect.any(Date),
        'user-1',
      ]
    );
    expect(profile).toEqual({
      orgId: 'org-1',
      vertical: 'beauty',
      languages: ['pt-BR'],
      updatedAt: now.toISOString(),
      updatedBy: 'user-1',
    });
  });
});
