// src/pages/Auth/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { setAuthToken } from "../../api/inboxApi"; // <- garante Authorization no inboxApi da Inbox

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    try {
      // seu contexto pode retornar boolean OU { token, user }
      const result = await login(email.trim(), password);

      // 1) se veio token no retorno do login, aplica no inboxApi
      if (result && typeof result === "object" && result.token) {
        setAuthToken(result.token);
      } else {
        // 2) fallback: muitos logins salvam no localStorage
        const saved = localStorage.getItem("token");
        if (saved) setAuthToken(saved);
      }

      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Não foi possível entrar.";
      setErro(msg);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-xl font-bold mb-4">Entrar</h1>

        {erro && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-3">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              type="email"
              className="border p-2 rounded w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Senha</label>
            <input
              type="password"
              className="border p-2 rounded w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <div className="text-sm text-gray-600 mt-3">
            Não tem conta?{" "}
            <Link to="/register" className="text-blue-600">
              Criar conta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
