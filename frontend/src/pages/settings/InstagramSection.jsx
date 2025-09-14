import React from "react";

export default function InstagramSection({ org }) {
  const ig = org?.channels?.instagram;
  const connected = !!ig?.token;

  return (
    <section data-testid="settings-instagram-section">
      <header className="mb-2">
        <h3>Instagram</h3>
      </header>

      <div className="flex gap-8 items-end">
        <button data-testid="ig-connect-btn" type="button">
          {connected ? "Reconectar" : "Conectar Instagram"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="accountId">
            Conta do Instagram
          </label>
          <select
            id="accountId"
            name="accountId"
            data-testid="ig-select-account"
            defaultValue={ig?.accountId || ""}
          >
            <option value="">Selecione a Conta…</option>
            {(ig?.accounts || []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.username}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
