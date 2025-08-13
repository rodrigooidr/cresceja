// src/contexts/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PrivateRoute({ children }) {
  const { token } = useAuth() || {};
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
