import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import inboxApi, { setActiveOrg } from "../api/inboxApi";
import { useAuth } from "./AuthContext";

export const OrgContext = createContext(null);

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

  const canSeeSelector = useMemo(() => {
    if (!user) return false;
    if (user.role === "SuperAdmin" || user.role === "Support") return true;
    if (user.role === "OrgAdmin") return true; // condicional pelo count
    return false;
  }, [user]);

  const visibility = useMemo(() => {
    if (user?.role === "SuperAdmin" || user?.role === "Support") return "all";
    return "mine";
  }, [user]);

  const refreshOrgs = useCallback(
    async (q = "", page = 1) => {
      setLoading(true);
      try {
        const { data } = await inboxApi.get("/orgs", {
          params: { visibility, q, page, pageSize: 50 },
        });
        setOrgs(data.items || data);
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

  useEffect(() => {
    if (!loading) {
      if (user?.role === "OrgAdmin" && orgs.length === 1) {
        const only = orgs[0]?.id || null;
        if (only && selected !== only) {
          setSelected(only);
          setActiveOrg(only);
        }
      }
      if (canSeeSelector && orgs.length > 0) {
        const exists = orgs.some((o) => o.id === selected);
        if (!exists) {
          const next = orgs[0].id;
          setSelected(next);
          setActiveOrg(next);
        }
      }
    }
  }, [loading, orgs, selected, canSeeSelector, user?.role]);

  const choose = useCallback(async (orgId) => {
    setSelected(orgId);
    setActiveOrg(orgId);
    // opcional: await inboxApi.post('/session/org', { org_id: orgId });
  }, []);

  const value = useMemo(
    () => ({ orgs, loading, selected, setSelected: choose, canSeeSelector }),
    [orgs, loading, selected, choose, canSeeSelector]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = React.useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

