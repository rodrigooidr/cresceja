import React, { useMemo, useState } from "react";
import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";
import { toArray } from "../../utils/arrayish";
import { openOAuth } from "../../utils/oauthDriver";

const IG_REQUIRED_SCOPES = ["instagram_content_publish"]; // ajuste se os testes exigirem +escopos
const DEFAULT_IG = { connected: false, accounts: [], accountId: "", permissions: [] };

export default function InstagramSection({ org }) {
  const { allowed } = useFeatureGate(org, "instagram", "instagram_accounts");
  if (!allowed) return null;

  const initial = useMemo(() => ({ ...DEFAULT_IG, ...(org?.channels?.instagram || {}) }), [org]);
  const [ig, setIg] = useState(initial);

  const accounts = toArray(ig.accounts);
  const accountSelected = isNonEmpty(ig.accountId);
  const permsOk = hasAllScopes(IG_REQUIRED_SCOPES, ig.permissions || []);
  const connected = !!ig.connected;

  const ready = connected && accountSelected && permsOk;
  const dp = disabledProps(ready,
    !connected ? "Conecte sua conta do Instagram."
    : !accountSelected ? "Selecione uma conta profissional."
    : !permsOk ? "Conceda instagram_content_publish."
    : ""
  );

  async function onConnect() {
    await openOAuth({
      provider: "instagram",
      url: "/oauth/instagram",
      onSuccess: (res) => {
        const acc = { id: res.account?.id, name: res.account?.name };
        const nextAccounts = accounts.length ? accounts : (acc.id ? [acc] : []);
        setIg({
          connected: true,
          permissions: res.scopes || [],
          accounts: nextAccounts,
          accountId: (acc.id || nextAccounts[0]?.id || ""),
        });
      },
    });
  }

  function onSelect(e) {
    setIg((s) => ({ ...s, accountId: e.target.value }));
  }

  return (
    <section data-testid="settings-instagram-section">
      <header className="mb-2"><h3>Instagram</h3></header>

      <div className="flex gap-8 items-end">
        <button data-testid="ig-connect-btn" type="button" onClick={onConnect}>
          {connected ? "Reconectar" : "Conectar Instagram"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="accountId">Conta do Instagram</label>
          <select
            id="accountId"
            name="accountId"
            data-testid="ig-select-account"
            value={ig.accountId || ""}
            onChange={onSelect}
          >
            <option value="">Selecione a Conta…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name || a.username}</option>
            ))}
          </select>
        </div>

        <div className={dp.wrapperClass} aria-disabled={dp.ariaDisabled} title={dp.buttonTitle}>
          <button data-testid="ig-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
