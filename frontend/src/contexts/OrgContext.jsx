// frontend/src/contexts/OrgContext.jsx
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentOrg, getMyOrgs, setActiveOrg, switchOrg, listAdminOrgs as listAllOrgs, } from "../api/inboxApi";
import { getOrgIdFromStorage } from "../services/session.js";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

const globalScope =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : {};

const START_BLANK = false;

// --- persiste activeOrg para componentes legados (sidebar, etc.)
function persistActiveOrg(data) {
  try {
    if (data && data.id) {
      const minimal = {
        id: data.id,
        name: data.name ?? data.company?.name ?? null,
        slug: data.slug ?? null,
      };
      localStorage.setItem("activeOrg", JSON.stringify(minimal));
      localStorage.setItem("orgId", String(data.id));
    } else {
      localStorage.removeItem("activeOrg");
    }
  } catch { }
}

// Broadcast opcional (quem quiser ouvir “org:changed”)
function announceOrgChanged(orgId) {
  try {
    window.dispatchEvent(new CustomEvent("org:changed", { detail: { orgId } }));
  } catch { }
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

  // Patch do fetch: injeta Authorization e X-Org-Id sem mexer no body
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;
    const origFetch = window.fetch.bind(window);

    window.fetch = (input, init = {}) => {
      const cfg = { ...init };
      const headers = new Headers(init && init.headers ? init.headers : undefined);

      const token = localStorage.getItem("token");
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", "Bearer " + token);
      }

      try {
        const active = localStorage.getItem("activeOrg");
        if (active) {
          const org = JSON.parse(active);
          if (org?.id) headers.set("x-org-id", org.id);
        }
      } catch { }

      cfg.headers = headers;
      if (Object.prototype.hasOwnProperty.call(init, "body")) {
        cfg.body = init.body;
      }
      return origFetch(input, cfg);
    };

    return () => {
      window.fetch = origFetch;
    };
  }, []);

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
    return getOrgIdFromStorage() || readTokenOrgId() || null;
  });
  const [orgChangeTick, setOrgChangeTick] = useState(0);
  const [org, setOrg] = useState(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState(null);

  // Quem vê o seletor
  // Quem vê o seletor (robusto com fallback para token e user.roles)
  const canSeeSelector = useMemo(() => {
    if (!isAuthenticated) return false;

    const roles = new Set();
    if (user?.role) roles.add(String(user.role));
    (user?.roles || []).forEach((r) => r && roles.add(String(r)));

    try {
      const t = localStorage.getItem("token");
      if (t) {
        const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (p?.role) roles.add(String(p.role));
        (p?.roles || []).forEach((r) => r && roles.add(String(r)));
      }
    } catch { }

    const allowed = ["SuperAdmin", "Support", "OrgOwner", "OrgAdmin"];
    return allowed.some((a) => roles.has(a));
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

  function hasSuperPower(user) {
    const roles = new Set();
    if (user?.role) roles.add(String(user.role));
    (user?.roles || []).forEach(r => r && roles.add(String(r)));
    try {
      const t = localStorage.getItem("token");
      if (t) {
        const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (p?.role) roles.add(String(p.role));
        (p?.roles || []).forEach(r => r && roles.add(String(r)));
      }
    } catch { }
    return roles.has("SuperAdmin") || roles.has("Support");
  }

  // ===== lista de organizações (server-side)
  const refreshOrgs = useCallback(async () => {
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
      // SuperAdmin/Support -> lista TODAS as orgs
      const data = hasSuperPower(user)
        ? await listAllOrgs("active") // admin endpoint
        : await getMyOrgs();          // somente as do usuário
      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.orgs)
          ? data.orgs
          : Array.isArray(data)
            ? data
            : Array.isArray(data?.data)     // alguns endpoints retornam {data:[...]}
              ? data.data
              : [];

      const items = rawItems.map((o) => ({
        id: o.id ?? o._id ?? null,
        name: o.company?.name ?? o.name ?? o.fantasy_name ?? "Sem nome",
        slug: o.slug ?? null,
      }));

      setAllOrgs(items);
      setOrgs(applyFilter(items, qRef.current));
      setHasMore(false);

      // se ainda não há seleção e existir 1 org, seleciona
      if (!selected && items[0]?.id && !START_BLANK) {
        setSelected(items[0].id);
        setActiveOrg(items[0].id);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[orgs] list fail:", err?.response?.status, err?.response?.data || err?.message);
      setOrgs([]);
      setAllOrgs([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [applyFilter, isAuthenticated, selected, user]);

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
    // 2) Seleção inválida → se token tiver org válida, aplica; se não, mantém
    const exists = selected && orgs.some((o) => o.id === selected);
    if (!exists) {
      const fromToken = readTokenOrgId();
      const tokenIsValid = fromToken && orgs.some((o) => o.id === fromToken);
      if (tokenIsValid) {
        setSelected(fromToken);
        setActiveOrg(fromToken);
      } else if (!START_BLANK && orgs[0]?.id) {
        setSelected(orgs[0].id);
        setActiveOrg(orgs[0].id);
      }
    }
  }, [isAuthenticated, loading, orgs, selected, user?.role]);

  // ===== org atual
  const refreshOrg = useCallback(async () => {
    if (!isAuthenticated || !selected) {
      setOrg(null);
      setOrgError(null);
      setOrgLoading(false);
      try { localStorage.removeItem("activeOrg"); } catch { }
      return null;
    }
    setOrgLoading(true);
    setOrgError(null);
    try {
      const data = await getCurrentOrg();
      setOrg(data ?? null);
      persistActiveOrg(data); // ✅ persiste activeOrg
      try {
        const credits = data?.plan?.limits || data?.plan?.credits || [];
        const alerts = [];
        for (const c of credits) {
          const limit = Number(c?.limit ?? 0);
          const used = Number(c?.used ?? 0);
          if (limit > 0) {
            const pct = (used / limit) * 100;
            if (pct >= 90) {
              alerts.push(`${c?.meter}: ${pct.toFixed(0)}% do limite`);
            }
          }
        }
        if (alerts.length) {
          console.warn('[limits]', alerts.join(' | '));
        }
      } catch {}
      return data ?? null;
    } catch (err) {
      setOrg(null);
      setOrgError(err);
      try { localStorage.removeItem("activeOrg"); } catch { }
      throw err;
    } finally {
      setOrgLoading(false);
    }
  }, [isAuthenticated, selected]);

  // Troca de org
  const choose = useCallback(
    async (orgId) => {
      if (!isAuthenticated) return;
      if (!orgId || orgId === selected) return;
      try {
        await switchOrg(orgId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[org] switch_failed", err);
        throw err;
      }
      setSelected(orgId);
      setActiveOrg(orgId);
      setOrg(null);
      setOrgError(null);
      announceOrgChanged(orgId);
      setOrgChangeTick((n) => n + 1);

      // carrega e persiste
      try {
        const data = await refreshOrg();
        if (!data) persistActiveOrg({ id: orgId });
      } catch { }
    },
    [isAuthenticated, selected, refreshOrg]
  );

  // carrega org ao mudar seleção / tick
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
        persistActiveOrg(data);
      } catch (err) {
        if (cancelled) return;
        setOrg(null);
        setOrgError(err);
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
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

  // debug: inspeção rápida no console
  try { window.__orgctx__ = value; } catch { }

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
    return {
      org: testOrg,
      selected: testOrg.id,
      setSelected: () => { },
      setOrg: () => { },
      refreshOrg: async () => testOrg,
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

  throw new Error("useOrg must be used within OrgProvider");
}
