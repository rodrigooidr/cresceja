import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";

const FB_REQUIRED_SCOPES = ["pages_manage_posts", "pages_read_engagement"];

export default function FacebookSection({ org }) {
  const { allowed } = useFeatureGate(org, "facebook", "facebook_pages");
  if (!allowed) return null;

  const fb = org?.channels?.facebook || {};
  const connected = !!fb.connected;
  const pageSelected = isNonEmpty(fb?.page?.id);
  const permsOk = hasAllScopes(FB_REQUIRED_SCOPES, fb?.permissions);

  // Pronto para testar/publicar
  const ready = connected && pageSelected && permsOk;

  const tip = !connected
    ? "Conecte sua conta do Facebook."
    : !pageSelected
      ? "Selecione uma Página para publicar."
      : !permsOk
        ? "Permissões insuficientes: conceda pages_manage_posts e pages_read_engagement."
        : "";

  const dp = disabledProps(ready, tip);

  return (
    <section data-testid="settings-facebook-section">
      <header className="mb-2">
        <h3>Facebook</h3>
      </header>

      {!permsOk && (
        <p data-testid="fb-perms-warning" className="text-amber-600">
          Permissões insuficientes. Requer: {FB_REQUIRED_SCOPES.join(", ")}.
        </p>
      )}

      <div className="flex gap-8 items-end">
        <button data-testid="fb-connect-btn" type="button">
          {connected ? "Reconectar" : "Conectar Facebook"}
        </button>

        <select data-testid="fb-select-page" defaultValue={fb?.page?.id || ""}>
          <option value="">Selecione a Página…</option>
          {(fb?.pages || []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div
          className={dp.wrapperClass}
          aria-disabled={dp.ariaDisabled}
          title={dp.buttonTitle}
        >
          <button data-testid="fb-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>

        {connected && (
          <button data-testid="fb-disconnect-btn" type="button" className="ml-auto">
            Desconectar
          </button>
        )}
      </div>
    </section>
  );
}
