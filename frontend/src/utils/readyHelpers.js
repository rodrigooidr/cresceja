export function isNonEmpty(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return Boolean(v);
}

export function hasAllScopes(required = [], granted = []) {
  const g = new Set((granted || []).map((s) => s.toLowerCase()));
  return required.every((s) => g.has(s.toLowerCase()));
}

// Devolve classes/props para desativar UI quando !ready
export function disabledProps(ready, title) {
  return {
    wrapperClass: !ready ? "opacity-50 pointer-events-none select-none" : "",
    buttonDisabled: !ready,
    buttonTitle: title || "",
    ariaDisabled: !ready,
  };
}

