import React from "react";

export default function FacebookSection({ org }) {
  const fb = org?.channels?.facebook;
  const connected = !!fb?.token;

  return (
    <section data-testid="settings-facebook-section">
      <header className="mb-2">
        <h3>Facebook</h3>
      </header>

      <div className="flex gap-8 items-end">
        <button data-testid="fb-connect-btn" type="button">
          {connected ? "Reconectar" : "Conectar Facebook"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="pageId">
            Página do Facebook
          </label>
          <select
            id="pageId"
            name="pageId"
            data-testid="fb-select-page"
            defaultValue={fb?.page?.id || ""}
          >
            <option value="">Selecione a Página…</option>
            {(fb?.pages || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
