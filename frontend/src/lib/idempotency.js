export function newIdempotencyKey() {
  try {
    return crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `id-${Math.random().toString(36).slice(2)}`;
  }
}
