// frontend/src/contexts/OrgContext.jsx
import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import inboxApi, { setActiveOrg } from "../api/inboxApi";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

// avisa a app toda que a org mudou
function announceOrgChanged(orgId) {
  try {
    window.dispatchEvent(new CustomEvent("org:changed", { detail: { orgId } }));
  } catch {}
}

function readTokenOrgId() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const payload = JSON.parse(atob((t.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.org_id || null;
  } catch {
    return null;
  }
}

export function OrgProvider({ children }) {
  const { user } = useAuth();

  // lista e estado de busca/paginação (server-side)
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);

  // org selecionada (1 por vez)
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem("active_org_id") || readTokenOrgId() || null;
    } catch {
      return null;
    }
  });
  const [orgChangeTick, setOrgChangeTick] = useState(0);

  // quem enxerga o seletor
  const canSeeSelector = useMemo(() => {
    if (!user) return false;
    const r = user.role;
    return ["SuperAdmin", "Support", "OrgOwner", "OrgAdmin"].includes(r);
  }, [user]);

  // visibilidade da listagem
  const visibility = useMemo(() => {
    if (user?.role === "SuperAdmin" || user?.role === "Support") return "all";
    return "mine";
  }, [user]);

  // carrega lista (replace/append) com busca/paginação no servidor
  const refreshOrgs = useCallback(
    async (qArg = q, p = 1, mode = "replace") => {
      setLoading(true);
      try {
        const { data } = await inboxApi.get("/orgs", {
          params: { visibility, q: qArg, page: p, pageSize },
          meta: { scope: "global" }, // evita exigir X-Org-Id
        });
        const items = data.items || data || [];
        const total = typeof data.total === "number" ? data.total : items.length;

        setHasMore(p * pageSize < total);
        setPage(p);
        setQ(qArg);

        if (mode === "append") {
          setOrgs((prev) => {
            const seen = new Set(prev.map((o) => o.id));
            const next = items.filter((o) => !seen.has(o.id));
            return [...prev, ...next];
          });
        } else {
          setOrgs(items);
        }
      } catch {
        if (mode === "replace") setOrgs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [visibility, q]
  );

  const searchOrgs = useCallback(
    (query) => refreshOrgs(query, 1, "replace"),
    [refreshOrgs]
  );

  const loadMoreOrgs = useCallback(
    () => {
      if (!hasMore || loading) return;
      return refreshOrgs(q, page + 1, "append");
    },
    [hasMore, loading, q, page, refreshOrgs]
  );

  // load inicial e quando a visibilidade mudar (ex.: troca de papel do usuário)
  useEffect(() => {
    (async () => {
      await refreshOrgs();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility]);

  // se o usuário logar/deslogar, revalida seleção
  useEffect(() => {
    const tokOrg = readTokenOrgId();
    if (tokOrg) {
      setSelected(tokOrg);
      setActiveOrg(tokOrg);
    } else {
      setSelected((prev) => prev || null);
    }
  }, [user?.id]);

  // autocorreção da seleção após carregar orgs
  useEffect(() => {
    if (loading) return;

    // 1) OrgOwner/OrgAdmin com 1 empresa: fixa
    if (["OrgOwner", "OrgAdmin"].includes(user?.role) && orgs.length === 1) {
      const only = orgs[0]?.id || null;
      if (only && selected !== only) {
        setSelected(only);
        setActiveOrg(only);
        return;
      }
    }

    // 2) se a seleção é inválida (ou vazia), escolher uma válida
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

  // troca de org (seleção única + broadcast)
  const choose = useCallback(
    async (orgId) => {
      if (!orgId || orgId === selected) return;
      setSelected(orgId);
      setActiveOrg(orgId);
      announceOrgChanged(orgId);
      setOrgChangeTick((n) => n + 1);
      // opcional: auditar a troca no backend
      // await inboxApi.post('/session/org', { org_id: orgId }, { meta: { scope: 'global' } });
    },
    [selected]
  );

  const value = useMemo(
    () => ({
      orgs,
      loading,
      selected,
      setSelected: choose,
      canSeeSelector,
      orgChangeTick,
      // busca/paginação expostas
      searchOrgs,
      loadMoreOrgs,
      hasMore,
      q,
    }),
    [orgs, loading, selected, choose, canSeeSelector, orgChangeTick, searchOrgs, loadMoreOrgs, hasMore, q]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
