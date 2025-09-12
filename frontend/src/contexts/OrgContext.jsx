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
      // Se não estiver autenticado, ignore qualquer seleção persistida
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
      // Sem login → modo público (nada a carregar)
      if (!isAuthenticated) {
        setLoading(false);
        setOrgs([]);
        setHasMore(false);
        return;
      }

      setLoading(true);
      try {
        const { data } = await inboxApi.get("/orgs", {
          params: { visibility, q: qArg, page: p, pageSize },
          meta: { scope: "global" }, // não força X-Org-Id (mas exige auth)
        });

        const items = data?.items ?? (Array.isArray(data) ? data : []);
        const total =
          typeof data?.total === "number" ? data.total : items.length;

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
        // 401/403 em modo autenticado: trate como falha de carga, mas sem quebrar a UI
        if (mode === "replace") setOrgs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, visibility, q]
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
    // Se público, finalize rápido para não travar render da landing
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
      // útil para saber se está no modo público
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
