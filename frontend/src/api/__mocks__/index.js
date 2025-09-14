const api = {
  get: jest.fn((url) => {
    // features
    if (/\/orgs\/[^/]+\/features$/.test(url)) {
      return Promise.resolve({ data: { whatsapp_numbers:{limit:1,enabled:true}, ai_calendar_generator:{enabled:true}, ai_image_generator:{enabled:true} }});
    }
    // campaigns list
    if (/\/campaigns(\?.*)?$/.test(url)) {
      return Promise.resolve({ data: { items: [{ id:'camp-1', title:'Outubro', month_ref:'2025-10-01' }] }});
    }
    // suggestions list
    if (/\/campaigns\/[^/]+\/suggestions(\?.*)?$/.test(url)) {
      return Promise.resolve({ data: { items: [
        { id:'sug-1', campaign_id:'camp-1', date:'2025-10-05', time:'10:00:00-03:00', status:'suggested', channel_targets:{ ig:{enabled:false}, fb:{enabled:false} }, copy_json:{ headline:'Sugestão #1', caption:'Legenda 1' }, asset_refs:[] },
        { id:'sug-2', campaign_id:'camp-1', date:'2025-10-06', time:'14:30:00-03:00', status:'approved',  channel_targets:{ ig:{enabled:true},  fb:{enabled:false} }, copy_json:{ headline:'Aprovado' }, asset_refs:[] },
      ] }});
    }
    // jobs por sugestão
    if (/\/suggestions\/[^/]+\/jobs$/.test(url)) {
      return Promise.resolve({ data: { ig:{ jobId:'ig-job-1', status:'pending' }, fb:{ jobId:null, status:null } }});
    }
    // clients (lista básica)
    if (/\/clients(\?.*)?$/.test(url)) {
      return Promise.resolve({ data: { items: [], total: 0 }});
    }
    // facebook pages
    if (url.includes('/facebook/pages')) {
      return Promise.resolve({ data: [] });
    }
    // instagram accounts
    if (url.includes('/instagram/accounts')) {
      return Promise.resolve({ data: [] });
    }
    // plans list
    if (/\/admin\/plans$/.test(url)) {
      return Promise.resolve({ data: [{ code:'Free' }, { code:'Starter' }, { code:'Pro' }] });
    }
    // orgs admin list
    if (/\/admin\/organizations$/.test(url)) {
      return Promise.resolve({ data: { items: [{ id:'org-1', name:'Org One' }] }});
    }
    return Promise.resolve({ data: {} });
  }),
  post: jest.fn((url, body) => {
    if (/\/campaigns\/generate$/.test(url)) {
      return Promise.resolve({ data: { campaignId:'camp-1', suggestions: [] }});
    }
    if (/\/suggestions\/[^/]+\/approve$/.test(url)) {
      return Promise.resolve({ data: { ok:true, jobs:{ ig:'ig-job-1' } }});
    }
    if (/\/assets$/.test(url)) {
      return Promise.resolve({ data: { id:'asset-1' }});
    }
    return Promise.resolve({ data: { ok:true }});
  }),
  patch: jest.fn(() => Promise.resolve({ data: { ok:true } })),
  delete: jest.fn(() => Promise.resolve({ data: { ok:true } })),
  defaults: { headers: { common: {} } },
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
};
export default api;
