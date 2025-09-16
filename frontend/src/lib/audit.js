import inboxApi from "../api/inboxApi.js";

/**
 * Registra evento de auditoria.
 * @param {string} event - nome do evento (ex: 'marketing.approve.success')
 * @param {object} payload - dados complementares (ids, status, etc.)
 * @param {object} [actor] - { id, name, role } do usuário (opcional)
 * @param {object} [config]
 */
export async function audit(event, payload = {}, actor = null, config = {}) {
  try {
    await inboxApi.post("/gov/logs", { event, payload, actor }, config);
  } catch {
    // não quebra o fluxo principal
  }
}

/** Consulta logs (mock) */
export async function fetchLogs({ event, limit = 100 } = {}) {
  const qs = new URLSearchParams();
  if (event) qs.set("event", event);
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString();
  const url = query ? `/gov/logs?${query}` : "/gov/logs";
  try {
    const { data } = await inboxApi.get(url);
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}
