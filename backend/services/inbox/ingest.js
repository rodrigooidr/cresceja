// Placeholder ingest service. In the real implementation this module would
// resolve organization and channel accounts and persist conversations and
// messages. For now it simply exposes the function expected by the webhook
// handler.

export async function ingestIncoming(evt) {
  // No-op placeholder to allow webhook processing during development.
  return evt;
}
