import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import inboxApi, { setActiveOrg } from "../api/inboxApi";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

// pequeno helper para avisar a app toda que a org mudou
function announceOrgChanged(orgId) {
  try {
    window.dispatchEvent(new CustomEvent("org:changed", { detail: { orgId } }));
  } catch {}
}

function readTokenOrgId() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1] || ""));
    return payload?.org_id || null;
  } catch {
    return null;
  }
}

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem("active_org_id") || null;
    } catch {
      return null;
    }
  });
  const [orgChangeTick, setOrgChangeTick] = useState(0);

  // SuperAdmin/Support sempre; OrgOwner/OrgAdmin podem ver seletor (condicional ao número de empresas)
  const canSeeSelector = useMemo(() => {
    if (!user) return false;
    const r = user.role;
    return ["SuperAdmin", "Support", "OrgOwner", "OrgAdmin"].includes(r);
  }, [user]);

  const visibility = useMemo(() => {
    if (user?.role === "SuperAdmin" || user?.role === "Support") return "all";
    return "mine";
  }, [user]);

  const refreshOrgs = useCallback(
    async (q = "", page = 1) => {
      setLoading(true);
      try {
        // meta.scope='global' => NÃO enviar X-Org-Id nesta chamada
        const { data } = await inboxApi.get("/orgs", {
          params: { visibility, q, page, pageSize: 50 },
          meta: { scope: "global" },
        });
        setOrgs(data.items || data || []);
      } catch {
        setOrgs([]);
      } finally {
        setLoading(false);
      }
    },
    [visibility]
  );

  useEffect(() => {
    (async () => {
      await refreshOrgs();
    })();
  }, [refreshOrgs]);

  // Autocorreção da seleção
  useEffect(() => {
    if (loading) return;

    // 1) OrgOwner/OrgAdmin com 1 empresa: fixa e oculta seletor
    if (["OrgOwner", "OrgAdmin"].includes(user?.role) && orgs.length === 1) {
      const only = orgs[0]?.id || null;
      if (only && selected !== only) {
        setSelected(only);
        setActiveOrg(only);
        return;
      }
    }

    // 2) Se não há seleção ou perdeu acesso, escolher uma válida
    const exists = selected && orgs.some((o) => o.id === selected);
    if (!exists) {
      const fromToken = readTokenOrgId();
      const tokenIsValid = fromToken && orgs.some((o) => o.id === fromToken);
      const next = tokenIsValid ? fromToken : (orgs[0]?.id || null);
      if (next) {
        setSelected(next);
        setActiveOrg(next); // atualiza axios + localStorage
      }
    }
  }, [loading, orgs, selected, user?.role]);

  const choose = useCallback(
    async (orgId) => {
      // garante seleção única (apenas 1 por vez)
      if (!orgId || orgId === selected) return;
      setSelected(orgId);
      setActiveOrg(orgId);
      // notifica app inteira
      announceOrgChanged(orgId);
      setOrgChangeTick((n) => n + 1);
      // opcional: auditar a troca
      // await inboxApi.post('/session/org', { org_id: orgId }, { meta: { scope: 'global' } });
    },
    [selected]
  );

  const value = useMemo(
    () => ({ orgs, loading, selected, setSelected: choose, canSeeSelector, orgChangeTick }),
    [orgs, loading, selected, choose, canSeeSelector, orgChangeTick]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
