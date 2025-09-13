// frontend/src/contexts/OrgContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import inboxApi, { setActiveOrg } from "../api/inboxApi";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

// Broadcast opcional (quem quiser ouvir “org:changed”)
function announceOrgChanged(orgId) {
  try {
    window.dispatchEvent(new CustomEvent("org:changed", { detail: { orgId } }));
  } catch {}
}

function readTokenOrgId() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const payload = JSON.parse(
      atob((t.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))
    );
    return payload?.org_id || null;
  } catch {
    return null;
  }
}

export function OrgProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  // Lista / paginação
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);

  // Seleção atual (1 org)
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem("active_org_id") || readTokenOrgId() || null;
    } catch {
      return null;
    }
  });
  const [orgChangeTick, setOrgChangeTick] = useState(0);

  // Quem vê o seletor
  const canSeeSelector = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    const r = user.role;
    return ["SuperAdmin", "Support", "OrgOwner", "OrgAdmin"].includes(r);
  }, [isAuthenticated, user]);

  // Visibilidade da listagem
  const visibility = useMemo(() => {
    if (!isAuthenticated) return null; // modo público: não busca
    if (user?.role === "SuperAdmin" || user?.role === "Support") return "all";
    return "mine";
  }, [isAuthenticated, user]);

  // Carrega lista (server-side)
  const refreshOrgs = useCallback(
    async (qArg = q, p = 1, mode = "replace") => {
      if (!isAuthenticated) {
        setLoading(false);
        setOrgs([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      try {
        const endpoint = visibility === "all" ? "admin/orgs" : "orgs/accessible"; // sem barra inicial
        const params = {
          q: qArg || undefined,
          search: qArg || undefined,
          limit: pageSize,
          page: p,
        };

        // Use inboxApi e marque escopo global (sem X-Org-Id)
        let data;
        try {
          ({ data } = await inboxApi.get(endpoint, {
            params,
            meta: { scope: "global" },
          }));
        } catch (err) {
          // Se /admin/orgs for 403, tenta /orgs/accessible
          if (visibility === "all" && err?.response?.status === 403) {
            ({ data } = await inboxApi.get("orgs/accessible", {
              params,
              meta: { scope: "global" },
            }));
          } else {
            throw err;
          }
        }

        // Normaliza vários formatos: {items,total} | {data,count} | array
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];

        // Garante {id,name} para o seletor
        const items = rawItems.map((o) => ({
          id: o.id ?? o._id,
          name: o.company?.name ?? o.name ?? o.fantasy_name ?? "Sem nome",
        }));

        const total =
          typeof data?.total === "number"
            ? data.total
            : typeof data?.count === "number"
            ? data.count
            : items.length;

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
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[orgs] list fail:",
          err?.response?.status,
          err?.response?.data || err?.message
        );
        if (mode === "replace") setOrgs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, visibility, q, pageSize]
  );

  const searchOrgs = useCallback(
    (query) => refreshOrgs(query, 1, "replace"),
    [refreshOrgs]
  );

  const loadMoreOrgs = useCallback(() => {
    if (!hasMore || loading) return;
    return refreshOrgs(q, page + 1, "append");
  }, [hasMore, loading, q, page, refreshOrgs]);

  // Load inicial / quando mudar autenticação ou visibilidade
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      setOrgs([]);
      setHasMore(false);
      return;
    }
    refreshOrgs();
  }, [isAuthenticated, visibility, refreshOrgs]);

  // Ao logar/deslogar, garante X-Org-Id coerente
  useEffect(() => {
    if (!isAuthenticated) {
      setSelected(null);
      setActiveOrg(null); // remove header e localStorage
      return;
    }
    const tokOrg = readTokenOrgId();
    if (tokOrg) {
      setSelected(tokOrg);
      setActiveOrg(tokOrg);
    } else {
      setSelected((prev) => prev || null);
    }
  }, [isAuthenticated, user?.id]);

  // Ajusta seleção após listar orgs (somente autenticado)
  useEffect(() => {
    if (!isAuthenticated || loading) return;

    // 1) Dono/Admin com 1 empresa → fixa
    if (["OrgOwner", "OrgAdmin"].includes(user?.role) && orgs.length === 1) {
      const only = orgs[0]?.id || null;
      if (only && selected !== only) {
        setSelected(only);
        setActiveOrg(only);
        return;
      }
    }

    // 2) Seleção inválida → escolher válida
    const exists = selected && orgs.some((o) => o.id === selected);
    if (!exists) {
      const fromToken = readTokenOrgId();
      const tokenIsValid = fromToken && orgs.some((o) => o.id === fromToken);
      const next = tokenIsValid ? fromToken : orgs[0]?.id || null;
      if (next) {
        setSelected(next);
        setActiveOrg(next);
      }
    }
  }, [isAuthenticated, loading, orgs, selected, user?.role]);

  // Troca de org
  const choose = useCallback(
    async (orgId) => {
      if (!isAuthenticated) return;
      if (!orgId || orgId === selected) return;
      setSelected(orgId);
      setActiveOrg(orgId);
      announceOrgChanged(orgId);
      setOrgChangeTick((n) => n + 1);
    },
    [isAuthenticated, selected]
  );

  const value = useMemo(
    () => ({
      orgs,
      loading,
      selected,
      setSelected: choose,
      canSeeSelector,
      orgChangeTick,
      searchOrgs,
      loadMoreOrgs,
      hasMore,
      q,
      publicMode: !isAuthenticated,
    }),
    [
      orgs,
      loading,
      selected,
      choose,
      canSeeSelector,
      orgChangeTick,
      searchOrgs,
      loadMoreOrgs,
      hasMore,
      q,
      isAuthenticated,
    ]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
