import inboxApi from "../../api/inboxApi";

import React, { useState } from 'react';
 
import PostPreview from '../components/PostPreview';
export default function RepurposePage(){
  const [postId, setPostId] = useState('');
  const [status, setStatus] = useState(null);
  const [channel, setChannel] = useState('instagram');
  const enqueue = async () => {
    await inboxApi.post(`/repurpose/${postId}`, { modes: ['story','email','video'] });
    const r = await inboxApi.get(`/repurpose/${postId}/status`);
    setStatus(r.data);
  };
  return (
    <div style={{maxWidth:800, margin:'0 auto'}}>
      <h2>Repurpose</h2>
      <input placeholder="Post ID" value={postId} onChange={e=>setPostId(e.target.value)} aria-label="ID do post"/>
      <button onClick={enqueue} disabled={!postId}>Gerar variações</button>
      {status && <pre>{JSON.stringify(status,null,2)}</pre>}
      {postId && (
        <div style={{marginTop:16}}>
          <label>Canal de prévia:&nbsp;
            <select value={channel} onChange={e=>setChannel(e.target.value)}>
              <option>instagram</option>
              <option>facebook</option>
              <option>linkedin</option>
              <option>gmb</option>
            </select>
          </label>
          <PostPreview postId={postId} channel={channel} />
        </div>
      )}
    </div>
  );
}


