import { useCallback } from 'react';

export default function useToastFallback(externalToast) {
  return useCallback((opts) => {
    const payload = typeof opts === 'string' ? { title: opts } : { ...opts };
    if (typeof externalToast === 'function') return externalToast(payload);
    if (window?.toast && typeof window.toast === 'function') return window.toast(payload);
    console.log('[toast]', payload.title || payload.description || payload); // último fallback
  }, [externalToast]);
}
