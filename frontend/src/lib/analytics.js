export function track(event, props = {}) {
  try {
    if (window?.analytics?.track) window.analytics.track(event, props);
  } catch {
    /* noop */
  }
}
