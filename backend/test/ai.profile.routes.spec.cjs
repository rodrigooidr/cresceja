/* eslint-env jest */

const request = require('supertest');
import express from 'express';

async function setupApp({ role = 'OrgAdmin', getProfileReturn = { orgId: 'org-1' } } = {}) {
  jest.resetModules();
  const getProfile = jest.fn().mockResolvedValue(getProfileReturn);
  const updateProfile = jest.fn().mockResolvedValue({ orgId: 'org-1', vertical: 'beauty' });

  await jest.unstable_mockModule('../services/ai/profileService.js', () => ({
    getProfile,
    updateProfile,
  }));

  const router = (await import('../routes/ai.profile.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', role };
    next();
  });
  app.use(router);

  return { app, getProfile, updateProfile };
}

describe('AI profile routes', () => {
  test('GET returns persisted profile', async () => {
    const { app, getProfile } = await setupApp({ getProfileReturn: { orgId: 'org-1', vertical: 'health' } });
    const res = await request(app).get('/api/orgs/org-1/ai-profile').expect(200);
    expect(getProfile).toHaveBeenCalledWith('org-1');
    expect(res.body).toEqual({ orgId: 'org-1', vertical: 'health' });
  });

  test('PUT validates payload', async () => {
    const { app, updateProfile } = await setupApp();
    await request(app).put('/api/orgs/org-1/ai-profile').send({ brandVoice: 123 }).expect(422);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test('PUT saves profile when valid', async () => {
    const { app, updateProfile } = await setupApp();
    await request(app)
      .put('/api/orgs/org-1/ai-profile')
      .send({ brandVoice: 'Friendly', languages: ['pt-BR'] })
      .expect(200);
    expect(updateProfile).toHaveBeenCalledWith('org-1', { brandVoice: 'Friendly', languages: ['pt-BR'] }, 'user-1');
  });

  test('returns 403 for unauthorized role', async () => {
    const { app } = await setupApp({ role: 'OrgViewer' });
    await request(app).get('/api/orgs/org-1/ai-profile').expect(403);
  });
});
