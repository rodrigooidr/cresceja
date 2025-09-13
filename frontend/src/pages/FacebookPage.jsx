import { useEffect, useState } from 'react';
import { useOrg } from '../contexts/OrgContext.jsx';
import inboxApi from '../api/inboxApi.js';

export default function FacebookPage() {
  const { selected } = useOrg();
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState('');
  const [posts, setPosts] = useState([]);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    async function loadPages() {
      const { data } = await inboxApi.get(`/orgs/${selected}/facebook/pages`, { meta: { scope: 'global' } });
      setPages(data || []);
      if (data?.[0]) setPage(data[0].id);
    }
    if (selected) loadPages();
  }, [selected]);

  useEffect(() => {
    async function loadPosts() {
      if (!page) return;
      const { data } = await inboxApi.get(`/orgs/${selected}/facebook/pages/${page}/posts`, { params: { limit }, meta: { scope: 'global' } });
      setPosts(data || []);
    }
    loadPosts();
  }, [page, selected, limit]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <select value={page} onChange={(e) => setPage(e.target.value)} className="border p-1">
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{p.name || p.page_id}</option>
          ))}
        </select>
        <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="border p-1 w-20" />
      </div>
      <ul className="space-y-2">
        {posts.map((pst) => (
          <li key={pst.id} className="rounded border p-2">
            <div>{pst.message}</div>
            <div className="text-xs opacity-70">{new Date(pst.created_time).toLocaleString()}</div>
            {pst.permalink_url && (
              <a href={pst.permalink_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs">Ver no Facebook</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
