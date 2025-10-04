import { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';
import { useOrg } from '../../contexts/OrgContext.jsx';

// PagePicker loads Facebook pages and persists choice in localStorage per org.
export default function PagePicker({ onChange, impersonateOrgId }) {
  const { selected } = useOrg();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!selected) return;
      setLoading(true);
      setError('');
      try {
        const meta = impersonateOrgId ? { meta: { impersonateOrgId } } : {};
        const { data } = await inboxApi.get(`/orgs/${selected}/facebook/pages`, meta);
        if (!alive) return;
        const list = data || [];
        setPages(list);
        const saved = localStorage.getItem(`active_fb_page::${selected}`);
        const initial = saved && list.some((p) => p.id === saved) ? saved : list[0]?.id || '';
        setValue(initial);
        if (initial) {
          localStorage.setItem(`active_fb_page::${selected}`, initial);
          onChange && onChange(initial);
        } else {
          onChange && onChange('');
        }
      } catch (err) {
        if (!alive) return;
        setError('err');
        onChange && onChange('');
      } finally {
        alive && setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [selected, impersonateOrgId, onChange]);

  function handleChange(e) {
    const val = e.target.value;
    setValue(val);
    localStorage.setItem(`active_fb_page::${selected}` || '', val);
    onChange && onChange(val);
  }

  if (loading) return <div className="text-sm opacity-70">Carregando páginas...</div>;
  if (error) return <div className="text-sm text-red-600">Erro ao carregar páginas.</div>;
  if (!pages.length)
    return (
      <div className="text-sm">
        Nenhuma página conectada.{' '}
        <a href="/settings" className="text-blue-600 underline">Conectar página</a>
      </div>
    );

  return (
    <select
      aria-label="Página do Facebook"
      value={value}
      onChange={handleChange}
      className="border p-2 rounded"
    >
      {pages.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name || p.page_id}
        </option>
      ))}
    </select>
  );
}
