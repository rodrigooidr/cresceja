import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function LandingPage() {
  const [lead, setLead] = useState({ name: '', email: '', whatsapp: '' });
  const [mensagem, setMensagem] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/leads', lead);
      setMensagem('Cadastro realizado com sucesso!');
      setLead({ name: '', email: '', whatsapp: '' });
    } catch (err) {
      setMensagem('Erro ao enviar. Tente novamente.');
    }
  };


  return (
    <div className="font-sans">
      {/* Hero */}
      <section className="bg-blue-700 text-white py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">CresceJá: IA para PMEs com controle humano</h1>
        <p className="text-lg mb-6">Automatize atendimento, marketing e redes sociais com segurança, governança e resultados.</p>
        <Link to="/register">
          <button className="bg-white text-blue-700 font-semibold px-6 py-3 rounded shadow hover:bg-gray-100 transition">
            Teste grátis por 14 dias
          </button>
        </Link>

        <div className="mt-10 max-w-md mx-auto bg-white rounded shadow p-6 text-gray-800">
          <h3 className="text-lg font-semibold mb-4">Cadastre-se para testar grátis</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="text" placeholder="Nome" value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} className="w-full border p-2 rounded" required />
            <input type="email" placeholder="E-mail" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} className="w-full border p-2 rounded" required />
            <input type="text" placeholder="WhatsApp" value={lead.whatsapp} onChange={e => setLead({ ...lead, whatsapp: e.target.value })} className="w-full border p-2 rounded" required />
            <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded w-full">Quero testar</button>
          </form>
          {mensagem && <p className="text-sm mt-3">{mensagem}</p>}
        </div>

      </section>

      {/* Comparativo */}
      <section className="py-16 bg-gray-100 text-center px-4">
        <h2 className="text-2xl font-bold mb-6">Comparativo</h2>
        <div className="overflow-auto">
          <table className="mx-auto text-left border bg-white rounded shadow">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3">Recursos</th>
                <th className="p-3">CresceJá</th>
                <th className="p-3">RD Station + TakeBlip</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="p-3">IA com moderação humana</td><td className="p-3">✅</td><td className="p-3">❌</td></tr>
              <tr><td className="p-3">Atendimento + Conteúdo + CRM integrados</td><td className="p-3">✅</td><td className="p-3">❌</td></tr>
              <tr><td className="p-3">Testes A/B automáticos</td><td className="p-3">✅</td><td className="p-3">❌</td></tr>
              <tr><td className="p-3">Repurpose automático de conteúdo</td><td className="p-3">✅</td><td className="p-3">❌</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Demonstração */}
      <section className="py-16 text-center px-4">
        <h2 className="text-2xl font-bold mb-4">Veja como funciona</h2>
        <img src="/demo-screenshot.png" alt="Demonstração do sistema" className="mx-auto rounded shadow max-w-xl" />
        <p className="text-sm text-gray-500 mt-2">Editor visual, IA integrada e governança completa.</p>
      </section>

      {/* Depoimentos */}
      <section className="bg-gray-50 py-16 text-center px-4">
        <h2 className="text-2xl font-bold mb-8">Quem usa, recomenda</h2>
        <blockquote className="max-w-xl mx-auto italic text-lg text-gray-700">“Reduzimos 40% do tempo com postagens. A IA funciona muito bem e não sai nada sem aprovação!”</blockquote>
        <p className="text-sm mt-2 text-gray-500">– Juliana, Padaria Doce Sabor</p>
      </section>

      {/* Planos */}
      <section className="py-20 bg-blue-50 text-center px-4">
        <h2 className="text-2xl font-bold mb-6">Escolha seu plano</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-white rounded shadow p-6">
            <h3 className="font-bold text-xl mb-2">Free</h3>
            <p className="text-gray-600 mb-4">R$0/mês</p>
            <ul className="text-sm text-left mb-4">
              <li>✅ 1 canal (WhatsApp)</li>
              <li>❌ Geração IA</li>
              <li>❌ Repurpose</li>
            </ul>
            <Link to="/register"><button className="bg-blue-600 text-white px-4 py-2 rounded">Começar</button></Link>
          </div>
          <div className="bg-white rounded shadow p-6 border-2 border-blue-600">
            <h3 className="font-bold text-xl mb-2">Pro+</h3>
            <p className="text-gray-600 mb-4">R$189/mês</p>
            <ul className="text-sm text-left mb-4">
              <li>✅ Ilimitado</li>
              <li>✅ IA Generativa</li>
              <li>✅ Repurpose Automático</li>
              <li>✅ Suporte prioritário</li>
            </ul>
            <Link to="/register"><button className="bg-blue-600 text-white px-4 py-2 rounded">Assinar</button></Link>
          </div>
          <div className="bg-white rounded shadow p-6">
            <h3 className="font-bold text-xl mb-2">Enterprise</h3>
            <p className="text-gray-600 mb-4">Sob demanda</p>
            <ul className="text-sm text-left mb-4">
              <li>✅ Créditos customizados</li>
              <li>✅ Gerente dedicado</li>
              <li>✅ Recursos exclusivos</li>
            </ul>
            <Link to="/register"><button className="bg-blue-600 text-white px-4 py-2 rounded">Solicitar</button></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;