let orgIdProvider = null;

export function setOrgIdHeaderProvider(fn) {
  orgIdProvider = typeof fn === "function" ? fn : null;
}

export function computeOrgId() {
  // 1) Provider (runtime)
  if (orgIdProvider) {
    try {
      const v = orgIdProvider();
      if (v != null && v !== "") return String(v);
    } catch {}
  }
  // 2) localStorage (persistência da seleção)
  try {
    const v = localStorage.getItem("activeOrgId") ?? localStorage.getItem("active_org_id");
    if (v != null && v !== "") return String(v);
  } catch {}
  // 3) fallback de testes
  const t = globalThis.__TEST_ORG__?.id;
  if (t != null && t !== "") return String(t);

  return undefined;
}

export function applyOrgIdHeader(headers = {}) {
  if (headers["X-Org-Id"] == null) {
    const v = computeOrgId();
    if (v != null) headers["X-Org-Id"] = v;
  }
  return headers;
}
