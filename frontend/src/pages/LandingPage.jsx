// frontend/src/pages/LandingPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow p-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Cresce<span className="text-blue-600">Já</span>
        </h1>

        <p className="text-gray-600 mt-2">
          Teste grátis por <strong>14 dias</strong>. Preencha para começar:
        </p>

        <form className="mt-6 grid gap-4">
          <input
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Seu nome"
          />
          <input
            type="email"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="E-mail"
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="WhatsApp"
          />

          <button
            type="button"
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-blue-700 transition"
          >
            Quero testar
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600">
          Já tem conta? <Link to="/login" className="text-blue-600 hover:underline">Entrar</Link>
        </div>
      </div>
    </main>
  );
}
