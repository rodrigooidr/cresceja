import React, { useEffect, useMemo, useState } from 'react';
import inboxApi from 'api/inboxApi';

import WhatsAppOfficialCard from 'components/settings/WhatsAppOfficialCard';
import WhatsAppBaileysCard from 'components/settings/WhatsAppBaileysCard';
import InstagramCard from 'components/settings/InstagramCard';
import FacebookCard from 'components/settings/FacebookCard';

// util simples para LS
const LS_KEY = 'channels.selectedOrgId';
const getSavedOrg = () => {
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
};
const setSavedOrg = (v) => {
  try { v ? localStorage.setItem(LS_KEY, v) : localStorage.removeItem(LS_KEY); } catch {}
};

function Tab({ id, active, onClick, children }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={
        'px-3 py-2 border-b-2 -mb-px ' +
        (active
          ? 'border-blue-600 text-blue-700 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300')
      }
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );
}

export default function ChannelsPage() {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [orgs, setOrgs] = useState([]);         // [{id,name}]
  const [orgId, setOrgId] = useState(getSavedOrg());
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [errOrgs, setErrOrgs] = useState('');

  // carrega orgs – tenta admin, senão cai para a org atual
  useEffect(() => {
    let mounted = true;
    async function fetchOrgs() {
      setLoadingOrgs(true);
      setErrOrgs('');
      try {
        // tenta: SuperAdmin
        const { data } = await inboxApi.get('/orgs/admin/orgs');
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!mounted) return;

        // ordena por nome
        items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
        setOrgs(items);

        // orgId salvo ainda existe?
        const saved = getSavedOrg();
        if (saved && items.some(o => o.id === saved)) {
          setOrgId(saved);
        } else if (items.length && !orgId) {
          setOrgId(items[0].id);
        }
      } catch (e) {
        // 403 -> não é superadmin: carrega somente a org do token
        if (e?.response?.status === 403) {
          try {
            const { data: me } = await inboxApi.get('/orgs/me');
            if (!mounted) return;
            const only = me?.org ? [{ id: me.org.id, name: me.org.name }] : [];
            setOrgs(only);
            if (only.length) {
              setOrgId(only[0].id);
              setSavedOrg(only[0].id);
            }
          } catch (e2) {
            if (!mounted) return;
            setErrOrgs('Falha ao carregar sua organização.');
          }
        } else {
          if (!mounted) return;
          setErrOrgs('Falha ao listar organizações.');
        }
      } finally {
        if (mounted) setLoadingOrgs(false);
      }
    }
    fetchOrgs();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persistir org selecionada
  useEffect(() => { setSavedOrg(orgId); }, [orgId]);

  const currentOrg = useMemo(
    () => orgs.find(o => o.id === orgId) || null,
    [orgs, orgId]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Seletor de Cliente (SuperAdmin vê lista; os demais verão 1 opção só) */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Cliente:</label>

        {loadingOrgs ? (
          <div className="text-sm text-gray-500">Carregando…</div>
        ) : errOrgs ? (
          <div className="text-sm text-red-600">{errOrgs}</div>
        ) : (
          <select
            className="border rounded px-2 py-1 text-sm min-w-[260px]"
            value={orgId || ''}
            onChange={(e) => setOrgId(e.target.value || '')}
          >
            {orgs.length === 0 && <option value="">— nenhum —</option>}
            {orgs.length > 0 && (
              <>
                {!orgId && <option value="">— escolher —</option>}
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.id.slice(0, 8)})
                  </option>
                ))}
              </>
            )}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-2" role="tablist" aria-label="Canais">
        <Tab id="whatsapp"  active={activeTab === 'whatsapp'}  onClick={setActiveTab}>WhatsApp</Tab>
        <Tab id="instagram" active={activeTab === 'instagram'} onClick={setActiveTab}>Instagram</Tab>
        <Tab id="facebook"  active={activeTab === 'facebook'}  onClick={setActiveTab}>Facebook</Tab>
      </div>

      {/* Conteúdo das tabs */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6" role="tabpanel" aria-labelledby="whatsapp">
          {/* WhatsApp Cloud (Oficial) */}
          <div className="rounded border bg-white p-4">
            <h3 className="font-medium mb-3">WhatsApp Oficial</h3>
            <WhatsAppOfficialCard orgId={orgId} currentOrg={currentOrg} />
          </div>

          {/* WhatsApp Session (Baileys) */}
          <div className="rounded border bg-white p-4">
            <h3 className="font-medium mb-3">WhatsApp (Baileys)</h3>
            <WhatsAppBaileysCard orgId={orgId} currentOrg={currentOrg} />
          </div>
        </div>
      )}

      {activeTab === 'instagram' && (
        <div className="rounded border bg-white p-4" role="tabpanel" aria-labelledby="instagram">
          <h3 className="font-medium mb-3">Instagram</h3>
          <InstagramCard orgId={orgId} currentOrg={currentOrg} />
        </div>
      )}

      {activeTab === 'facebook' && (
        <div className="rounded border bg-white p-4" role="tabpanel" aria-labelledby="facebook">
          <h3 className="font-medium mb-3">Facebook</h3>
          <FacebookCard orgId={orgId} currentOrg={currentOrg} />
        </div>
      )}
    </div>
  );
}
