import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";

const IG_REQUIRED_SCOPES = ["instagram_content_publish"];

export default function InstagramSection({ org }) {
  const { allowed } = useFeatureGate(org, "instagram", "instagram_accounts");
  if (!allowed) return null;

  const ig = org?.channels?.instagram || {};
  const connected = !!ig.connected;
  const accountSelected = isNonEmpty(ig?.accountId);
  const permsOk = hasAllScopes(IG_REQUIRED_SCOPES, ig?.permissions);

  const ready = connected && accountSelected && permsOk;

  const tip = !connected
    ? "Conecte sua conta do Instagram (profissional)."
    : !accountSelected
      ? "Selecione uma conta profissional do Instagram."
      : !permsOk
        ? "Permissões insuficientes: conceda instagram_content_publish."
        : "";

  const dp = disabledProps(ready, tip);

  return (
    <section data-testid="settings-instagram-section">
      <header className="mb-2">
        <h3>Instagram</h3>
      </header>

      {!permsOk && (
        <p data-testid="ig-perms-warning" className="text-amber-600">
          Permissões insuficientes. Requer: {IG_REQUIRED_SCOPES.join(", ")}.
        </p>
      )}

      <div className="flex gap-8 items-end">
        <button data-testid="ig-connect-btn" type="button">
          {connected ? "Reconectar" : "Conectar Instagram"}
        </button>

        <select data-testid="ig-select-account" defaultValue={ig?.accountId || ""}>
          <option value="">Selecione a Conta…</option>
          {(ig?.accounts || []).map((a) => (
            <option key={a.id} value={a.id}>{a.name || a.username}</option>
          ))}
        </select>

        <div
          className={dp.wrapperClass}
          aria-disabled={dp.ariaDisabled}
          title={dp.buttonTitle}
        >
          <button data-testid="ig-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
