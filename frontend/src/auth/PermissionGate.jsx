import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function PermissionGate({
  allow,
  mode = 'hide',
  children,
  disabledFallback = null,
}) {
  const { user } = useAuth?.() ?? { user: null };
  const ok = typeof allow === 'function' ? allow(user) : !!allow;

  if (ok) return children;

  if (mode === 'disable') {
    return (
      disabledFallback ?? (
        <div aria-disabled="true" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {children}
        </div>
      )
    );
  }
  return null;
}
