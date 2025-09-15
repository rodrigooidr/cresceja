// src/pages/inbox/components/SidebarFilters.jsx
import React from "react";

export default function SidebarFilters({ value, onChange, channelIconBySlug, accounts = [] }) {
  const handleChange = (field, newValue) => {
    onChange({ ...value, [field]: newValue });
  };

  const toggleTag = (tag) => {
    const exists = value.tags.includes(tag);
    const newTags = exists
      ? value.tags.filter((t) => t !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags: newTags });
  };

  return (
    <div className="sidebar-filters space-y-3 p-2 border rounded-xl bg-white shadow-sm">
      {/* Busca */}
      <input
        type="text"
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="Buscar conversas..."
        value={value.q}
        onChange={(e) => handleChange("q", e.target.value)}
      />

      {/* Status */}
      <div>
        <label className="block text-xs font-semibold mb-1">Status</label>
        <select
          className="w-full px-3 py-2 border rounded-lg text-sm"
          value={value.status}
          onChange={(e) => handleChange("status", e.target.value)}
        >
          <option value="open">Abertas</option>
          <option value="pending">Pendentes</option>
          <option value="closed">Fechadas</option>
        </select>
      </div>

      {/* Canal */}
      <div>
        <label htmlFor="channelFilter" className="block text-xs font-semibold mb-1">Canal</label>
        <label htmlFor="channelFilter" className="sr-only">
          Canal
        </label>
        <select
          id="channelFilter"
          aria-label="Filtro de canal"
          data-testid="channel-filter"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          value={value.channel}
          onChange={(e) => handleChange("channel", e.target.value)}
        >
          <option value="">Todos</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>

      {/* Conta */}
      {(value.channel === 'instagram' || value.channel === 'facebook') && (
        <div>
          <label htmlFor="accountFilter" className="block text-xs font-semibold mb-1">Conta</label>
          <label htmlFor="accountFilter" className="sr-only">
            Conta
          </label>
          <select
            id="accountFilter"
            aria-label="Filtro de conta"
            data-testid="account-filter"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={value.accountId || ''}
            onChange={(e) => handleChange('accountId', e.target.value)}
          >
            <option value="">Todas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name || a.username || a.external_account_id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tags (exemplo simples, pode vir da API no futuro) */}
      <div>
        <label className="block text-xs font-semibold mb-1">Tags</label>
        <div className="flex flex-wrap gap-2">
          {["vip", "retornar", "urgente"].map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 rounded-lg text-xs border ${
                value.tags.includes(tag)
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
