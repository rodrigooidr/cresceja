// frontend/src/components/OrgSelect.jsx
import React, { useMemo, useState } from 'react';
import { useOrg } from '../contexts/OrgContext.jsx';

function resolveLabel(org) {
  if (!org) return '';
  return org.nome_fantasia || org.name || org.slug || org.company?.name || org.fantasy_name || 'Organização';
}

export default function OrgSelect() {
  const { orgs = [], selected, setSelected, org: activeOrgDetails } = useOrg();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const activeOrg = useMemo(() => {
    return orgs.find((org) => String(org.id) === String(selected)) || activeOrgDetails || null;
  }, [orgs, selected, activeOrgDetails]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orgs;
    return orgs.filter((org) => {
      const label = resolveLabel(org).toLowerCase();
      return label.includes(needle);
    });
  }, [orgs, q]);

  return (
    <div className="org-select">
      <button
        type="button"
        className="org-select__button"
        onClick={() => setOpen((value) => !value)}
      >
        {activeOrg ? resolveLabel(activeOrg) : 'Selecionar organização'}
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="org-select__menu">
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Filtrar por nome..."
            className="org-select__search"
          />
          <ul className="org-select__list">
            {filtered.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  className="org-select__item"
                  onClick={() => {
                    setSelected(String(org.id));
                    setOpen(false);
                  }}
                  title={org.slug || org.name}
                >
                  {resolveLabel(org)}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="org-select__empty">Nenhuma organização encontrada</li>
            )}
          </ul>
        </div>
      )}

      <style>{`
        .org-select { position: relative; width: 100%; }
        .org-select__button {
          width: 100%; text-align: left; padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px; background: #fff;
        }
        .org-select__menu {
          position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0;
          background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .org-select__search { width: 100%; padding: 8px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 8px; }
        .org-select__list { list-style: none; max-height: 280px; overflow: auto; margin: 0; padding: 0; }
        .org-select__item { width: 100%; text-align: left; padding: 8px; border-radius: 8px; }
        .org-select__item:hover { background: #f6f6f6; }
        .org-select__empty { color: #999; padding: 8px; }
        .chev { float: right; opacity: .6; }
      `}</style>
    </div>
  );
}
