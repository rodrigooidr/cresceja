import apiModule from '../../src/api/index.js';
import inboxApiModule from '../../src/api/inboxApi.js';

const api = apiModule?.default || apiModule;
const inboxApi = inboxApiModule?.default || inboxApiModule;

const clients = Array.from(
  new Set([
    api,
    inboxApi,
  ])
).filter(Boolean);

export function registerContentCalendarRoutes() {
  const register = (method, matcher, handler) => {
    clients.forEach((client) => {
      const fn = client?.__mockRoute || client?.__mock?.route;
      if (typeof fn === 'function') {
        fn(method, matcher, handler);
      }
    });
  };

  const defaultCampaigns = [{ id: 'camp-1', title: 'Outubro • Loja XYZ', month_ref: '2025-10-01' }];
  const defaultSuggestions = [
    {
      id: 'sug-1',
      campaign_id: 'camp-1',
      date: '2025-10-05',
      time: '10:00:00-03:00',
      status: 'suggested',
      title: 'Sugestão IG/FB #1',
      copy_json: { headline: 'Sugestão IG/FB #1', caption: 'Legenda 1' },
      channel_targets: { ig: { enabled: false }, fb: { enabled: false } },
      channels: ['instagram', 'facebook'],
    },
    {
      id: 'sug-2',
      campaign_id: 'camp-1',
      date: '2025-10-06',
      time: '14:30:00-03:00',
      status: 'approved',
      title: 'Sugestão IG/FB #2',
      copy_json: { headline: 'Sugestão IG/FB #2' },
      channel_targets: { ig: { enabled: true }, fb: { enabled: false } },
      channels: ['instagram'],
    },
  ];

  register('GET', /\/orgs\/[^/]+\/campaigns$/, () => ({ data: { items: defaultCampaigns } }));
  register('GET', /\/orgs\/[^/]+\/campaigns\/[^/]+\/suggestions$/, () => ({ data: { items: defaultSuggestions } }));
  register('GET', '/marketing/suggestions', () => ({ data: { items: defaultSuggestions } }));
  register('GET', /\/marketing\/suggestions\/sug-1$/, () => ({
    data: {
      id: 'sug-1',
      title: 'Sugestão IG/FB #1',
      body: 'Conteúdo da Sugestão IG/FB #1',
      copy_json: { headline: 'Sugestão IG/FB #1', caption: 'Legenda 1' },
      channels: ['instagram', 'facebook'],
    },
  }));
  register('PUT', /\/marketing\/suggestions\/sug-1\/approve$/, () => ({ data: { ok: true } }));
  register('PUT', /\/orgs\/[^/]+\/suggestions\/sug-1\/approve$/, () => ({ data: { ok: true } }));
}

export function setupContentCalendarRoutes() {
  beforeEach(() => {
    registerContentCalendarRoutes();
  });
}

export default registerContentCalendarRoutes;
