// frontend/src/contexts/OrgContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentOrg, getMyOrgs, setActiveOrg } from "../api/inboxApi";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

const globalScope =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
    ? window
    : {};

const START_BLANK = true;

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
  const [allOrgs, setAllOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const qRef = useRef("");
  const [hasMore, setHasMore] = useState(false);

  // Seleção atual (1 org)
  const [selected, setSelected] = useState(() => {
    if (START_BLANK) return null;
    try {
      return localStorage.getItem("active_org_id") || readTokenOrgId() || null;
    } catch {
      return null;
    }
  });
  const [orgChangeTick, setOrgChangeTick] = useState(0);
  const [org, setOrg] = useState(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState(null);

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

  const applyFilter = useCallback((items, query) => {
    const term = query?.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.slug]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, []);

  useEffect(() => {
    qRef.current = q;
  }, [q]);

  // Carrega lista (server-side)
  const refreshOrgs = useCallback(
    async () => {
      if (!isAuthenticated) {
        setLoading(false);
        setOrgs([]);
        setAllOrgs([]);
        setHasMore(false);
        setQ("");
        return;
      }

      setLoading(true);
      try {
        const data = await getMyOrgs();
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.orgs)
          ? data.orgs
          : Array.isArray(data)
          ? data
          : [];

        const items = rawItems.map((o) => ({
          id: o.id ?? o._id ?? null,
          name: o.company?.name ?? o.name ?? o.fantasy_name ?? "Sem nome",
          slug: o.slug ?? null,
        }));

        setAllOrgs(items);
        const activeQuery = qRef.current;
        setOrgs(applyFilter(items, activeQuery));
        setHasMore(false);

        const current = data?.currentOrgId ?? null;
        if (current && !selected) {
          setSelected(current);
          setActiveOrg(current);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[orgs] list fail:",
          err?.response?.status,
          err?.response?.data || err?.message
        );
        setOrgs([]);
        setAllOrgs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [applyFilter, isAuthenticated, selected]
  );

  const searchOrgs = useCallback(
    (query) => {
      setQ(query);
      setOrgs(applyFilter(allOrgs, query));
      return Promise.resolve();
    },
    [allOrgs, applyFilter]
  );

  const loadMoreOrgs = useCallback(() => {
    setHasMore(false);
    return Promise.resolve();
  }, []);

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
      setOrg(null);
      setOrgError(null);
      setOrgLoading(false);
      return;
    }
    // Se não for para iniciar em branco e o token já traz org, seleciona
    const tokOrg = readTokenOrgId();
    if (!START_BLANK && tokOrg) {
      setSelected(tokOrg);
      setActiveOrg(tokOrg);
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
    // 2) Seleção inválida → se token tiver org válida, aplica; caso contrário, mantém EM BRANCO
    const exists = selected && orgs.some((o) => o.id === selected);
    if (!exists) {
      const fromToken = readTokenOrgId();
      const tokenIsValid = fromToken && orgs.some((o) => o.id === fromToken);
      if (tokenIsValid) {
        setSelected(fromToken);
        setActiveOrg(fromToken);
      } else if (!START_BLANK && orgs[0]?.id) {
        // fallback antigo (desativado por START_BLANK): pegar a primeira
        setSelected(orgs[0].id);
        setActiveOrg(orgs[0].id);
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
      setOrg(null);
      setOrgError(null);
      announceOrgChanged(orgId);
      setOrgChangeTick((n) => n + 1);
    },
    [isAuthenticated, selected]
  );

  const refreshOrg = useCallback(async () => {
    if (!isAuthenticated || !selected) {
      setOrg(null);
      setOrgError(null);
      setOrgLoading(false);
      return null;
    }
    setOrgLoading(true);
    setOrgError(null);
    try {
      const data = await getCurrentOrg();
      setOrg(data ?? null);
      return data ?? null;
    } catch (err) {
      setOrg(null);
      setOrgError(err);
      throw err;
    } finally {
      setOrgLoading(false);
    }
  }, [isAuthenticated, selected]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOrg(null);
      setOrgError(null);
      setOrgLoading(false);
      return;
    }
    if (!selected) {
      setOrg(null);
      setOrgError(null);
      setOrgLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setOrgLoading(true);
      setOrgError(null);
      try {
        const data = await getCurrentOrg();
        if (cancelled) return;
        setOrg(data ?? null);
      } catch (err) {
        if (cancelled) return;
        setOrg(null);
        setOrgError(err);
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selected, orgChangeTick]);

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
      org,
      orgLoading,
      orgError,
      refreshOrg,
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
      org,
      orgLoading,
      orgError,
      refreshOrg,
    ]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (ctx) return ctx;

  // ✅ Fallback apenas em testes
  if (process.env.NODE_ENV === "test") {
    const testOrg = globalScope.__TEST_ORG__ || {
      id: "org1",
      name: "Org Test",
      features: {},
      plan: { limits: {} },
      channels: {},
    };
    // No fallback não mutamos estado real; devolvemos stubs
    return {
      org: testOrg,
      selected: testOrg.id,            // 🔴 muitos testes usam isso
      setSelected: () => {},           // no-op
      setOrg: () => {},
      refreshOrg: async () => testOrg,
      // stubs comuns p/ listas/UX
      orgs: [{ id: testOrg.id, name: testOrg.name }],
      loading: false,
      orgLoading: false,
      orgError: null,
      canSeeSelector: false,
      orgChangeTick: 0,
      searchOrgs: async () => ({ items: [{ id: testOrg.id, name: testOrg.name }], total: 1 }),
      loadMoreOrgs: async () => ({ items: [], total: 1 }),
      hasMore: false,
      q: "",
      publicMode: false,
    };
  }

  // Produção/dev continuam exigindo Provider
  throw new Error("useOrg must be used within OrgProvider");
}
