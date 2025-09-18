
export const ROUTE_CONTRACT = [
  { path: "/inbox", perm: "inbox:view", id: "inbox" },
  { path: "/settings/governanca", perm: "audit:view", id: "gov-logs" },
  { path: "/settings/governanca/metricas", perm: "telemetry:view", id: "metrics" },
  { path: "/settings/agenda", perm: "org_admin", id: "calendar-settings" },
  { path: "/settings/ai", perm: "org_admin", id: "org-ai" },
  { path: "/marketing/calendar", perm: "marketing:view", id: "calendar" },
];

