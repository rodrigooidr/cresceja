import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import inboxApi from '../../api/inboxApi';

const tabs = ['overview','billing','whatsapp','integrations','users','credits','logs','data'];

export default function AdminOrgDetails(){
  const { id } = useParams();
  const [org,setOrg] = useState(null);
  const [tab,setTab] = useState('overview');

  useEffect(()=>{
    (async ()=>{
      try {
        const res = await inboxApi.get(`/api/admin/orgs/${id}`, { meta:{ scope:'global' }});
        setOrg(res.data);
      } catch(e){
        console.error(e);
      }
    })();
  },[id]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Organização {org?.name || id}</h1>
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-2 py-1 border-b-2 ${tab===t?'border-blue-500':'border-transparent'}`}>{t}</button>
        ))}
      </div>
      <div>
        {tab === 'overview' && <pre>{JSON.stringify(org, null, 2)}</pre>}
        {tab !== 'overview' && <div>TODO: {tab}</div>}
      </div>
    </div>
  );
}
