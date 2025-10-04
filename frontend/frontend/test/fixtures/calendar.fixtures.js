import { DateTime } from 'luxon';

export const TODAY = '2025-10-01T12:00:00-03:00';

export function campaignsFixture() {
  return [{ id:'camp-1', title:'Outubro • Loja XYZ', month_ref:'2025-10-01' }];
}

export function suggestionsFixture() {
  // sempre com TZ explícito -03:00
  return [
    {
      id:'sug-1',
      campaign_id:'camp-1',
      date:'2025-10-05',
      time:'10:00:00-03:00',
      status:'suggested',
      channel_targets:{ ig:{enabled:false}, fb:{enabled:false} },
      copy_json:{ headline:'Sugestão IG/FB #1', caption:'Legenda 1' },
      asset_refs:[]
    },
    {
      id:'sug-2',
      campaign_id:'camp-1',
      date:'2025-10-06',
      time:'14:30:00-03:00',
      status:'approved',
      channel_targets:{ ig:{enabled:true}, fb:{enabled:false} },
      copy_json:{ headline:'Post aprovado' },
      asset_refs:[]
    }
  ];
}

export function jobsFixture() {
  return {
    ig: { jobId:'ig-job-1', status:'pending' },
    fb: { jobId:null, status:null }
  };
}
