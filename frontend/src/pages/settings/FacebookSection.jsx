import React, { useMemo, useState } from "react";
import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";
import { toArray } from "../../utils/arrayish";
import { openOAuth } from "../../utils/oauthDriver";

const FB_REQUIRED_SCOPES = ["pages_manage_posts", "pages_read_engagement"];
const DEFAULT_FB = { connected: false, pages: [], page: null, permissions: [] };

export default function FacebookSection({ org }) {
  const { allowed } = useFeatureGate(org, "facebook", "facebook_pages");
  if (!allowed) return null;

  const initial = useMemo(() => ({ ...DEFAULT_FB, ...(org?.channels?.facebook || {}) }), [org]);
  const [fb, setFb] = useState(initial);

  const pages = toArray(fb.pages);
  const pageSelected = isNonEmpty(fb?.page?.id);
  const permsOk = hasAllScopes(FB_REQUIRED_SCOPES, fb.permissions || []);
  const connected = !!fb.connected;

  const ready = connected && pageSelected && permsOk;
  const dp = disabledProps(ready,
    !connected ? "Conecte sua conta do Facebook."
    : !pageSelected ? "Selecione uma Página."
    : !permsOk ? "Conceda pages_manage_posts e pages_read_engagement."
    : ""
  );

  async function onConnect() {
    await openOAuth({
      provider: "facebook",
      url: "/oauth/facebook",
      onSuccess: (res) => {
        const candidate = { id: res.account?.id, name: res.account?.name };
        const nextPages = pages.length ? pages : (candidate.id ? [candidate] : []);
        setFb({
          connected: true,
          permissions: res.scopes || [],
          pages: nextPages,
          page: nextPages[0] || null,
        });
      },
    });
  }

  function onSelectPage(e) {
    const id = e.target.value;
    const p = pages.find((x) => String(x.id) === String(id)) || null;
    setFb((s) => ({ ...s, page: p }));
  }

  return (
    <section data-testid="settings-facebook-section">
      <header className="mb-2"><h3>Facebook</h3></header>

      <div className="flex gap-8 items-end">
        <button data-testid="fb-connect-btn" type="button" onClick={onConnect}>
          {connected ? "Reconectar" : "Conectar Facebook"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="pageId">Página do Facebook</label>
          <select
            id="pageId"
            name="pageId"
            data-testid="fb-select-page"
            value={fb?.page?.id || ""}
            onChange={onSelectPage}
          >
            <option value="">Selecione a Página…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className={dp.wrapperClass} aria-disabled={dp.ariaDisabled} title={dp.buttonTitle}>
          <button data-testid="fb-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
