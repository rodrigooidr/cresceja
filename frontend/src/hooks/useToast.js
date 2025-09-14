let injected;
export default function useToast() {
  if (injected) return injected;
  if (typeof window !== "undefined" && typeof window.toast === "function") {
    return { addToast: window.toast };
  }
  if (process.env.NODE_ENV === "test") {
    const fn = (...args) => { /* no-op */ };
    injected = { addToast: fn };
    return injected;
  }
  return { addToast: () => {} };
}
