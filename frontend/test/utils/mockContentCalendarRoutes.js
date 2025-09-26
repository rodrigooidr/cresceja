import inboxApi from '@/api/inboxApi';

const defaultJobs = [
  {
    id: 'job-1',
    channel: 'instagram',
    date: '2025-09-01',
    title: 'Sugestão IG/FB #1',
    suggestionId: 's1',
  },
];

const defaultCampaigns = [
  {
    id: 'camp-1',
    name: 'Campanha Setembro',
    month_ref: '2025-09-01',
  },
];

const defaultSuggestions = [
  {
    id: 's1',
    title: 'Sugestão IG/FB #1',
    channels: ['instagram', 'facebook'],
    status: 'suggested',
    date: '2025-09-01',
    time: '09:00:00-03:00',
  },
  {
    id: 's2',
    title: 'Sugestão IG/FB #2',
    channels: ['instagram'],
    status: 'approved',
    date: '2025-09-02',
    time: '14:00:00-03:00',
  },
];

export function mockContentCalendarRoutes(overrides = {}) {
  const jobs = overrides.jobs ?? defaultJobs;
  const campaigns = overrides.campaigns ?? defaultCampaigns;
  const suggestions = overrides.suggestions ?? defaultSuggestions;
  const approveResponse = overrides.approveResponse ?? { data: { ok: true } };

  inboxApi.__mockRoute?.('GET', '/marketing/content/jobs', () => ({
    data: { items: jobs },
  }));

  inboxApi.__mockRoute?.('GET', /^\/orgs\/1\/campaigns(\?.*)?$/, () => ({
    data: { items: campaigns },
  }));

  inboxApi.__mockRoute?.('GET', /^\/orgs\/1\/campaigns\/camp-1\/suggestions$/, () => ({
    data: { items: suggestions },
  }));

  inboxApi.__mockRoute?.('PUT', /^\/orgs\/1\/campaigns\/camp-1\/suggestions\/s1\/approve$/, () => (
    approveResponse
  ));
}

export default mockContentCalendarRoutes;
