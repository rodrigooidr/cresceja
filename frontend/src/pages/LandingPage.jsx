import inboxApi from "../api/inboxApi";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import TrialDaysLabel from "../components/TrialDaysLabel";
import { useTrial } from "../contexts/TrialContext";
import PricingTable from "../components/PricingTable";

function hasToken() {
  try { return !!localStorage.getItem("token"); } catch { return false; }
}

export default function LandingPage() {
  const { trialDays } = useTrial();
  const [lead, setLead] = useState({ name: "", email: "", whatsapp: "" });
  const [status, setStatus] = useState({ loading: false, ok: null, msg: "" });

  const submitLead = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, ok: null, msg: "" });
    try {
      await inboxApi.post("/leads", lead);
      setStatus({
        loading: false,
        ok: true,
        msg: "Recebido! Vamos falar com você em instantes.",
      });
      setLead({ name: "", email: "", whatsapp: "" });
    } catch (err) {
      setStatus({
        loading: false,
        ok: false,
        msg: "Não consegui enviar agora. Você pode tentar novamente ou falar com a gente pelo e-mail.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAV */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-2xl font-extrabold">
            Cresce<span className="text-blue-600">Já</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#beneficios" className="hover:text-blue-600">Benefícios</a>
            <a href="#como-funciona" className="hover:text-blue-600">Como funciona</a>
            <a href="#modulos" className="hover:text-blue-600">Módulos</a>
            <a href="#planos" className="hover:text-blue-600">Planos</a>
            <a href="#faq" className="hover:text-blue-600">FAQ</a>
            <Link to="/lgpd" className="hover:text-blue-600">LGPD</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="px-3 py-2 text-sm rounded-lg hover:bg-gray-100">Entrar</Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Testar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight">
              Atendimento e Marketing com <span className="text-blue-600">IA que converte</span>
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Centralize WhatsApp, Instagram e Facebook, colete contatos automaticamente e feche vendas
              mais rápido. Tudo com governança, aprovação de conteúdo e controle de créditos de IA.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                {/* CTA dinâmico */}
                Começar agora <TrialDaysLabel />
              </Link>
              <a href="#demo" className="px-5 py-3 rounded-xl border font-medium hover:bg-gray-50">
                Ver demo
              </a>
              <a
                href="mailto:rodrigooidr@hotmail.com?subject=CresceJ%C3%A1%20-%20Quero%20falar%20com%20vendas"
                className="px-5 py-3 rounded-xl border font-medium hover:bg-gray-50"
              >
                Falar com vendas
              </a>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Sem cartão agora • Cancele quando quiser • Suporte humano
            </div>
          </div>

          {/* FORM DE LEAD */}
          <div id="contato" className="border rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold">Receba uma demonstração guiada</h3>
            <p className="text-gray-600 text-sm mt-1">
              Preencha e nossa equipe entra em contato. Resposta rápida!
            </p>

            <form className="mt-4 grid gap-3" onSubmit={submitLead}>
              <input
                type="text"
                required
                placeholder="Seu nome"
                className="border rounded-lg px-3 py-2"
                value={lead.name}
                onChange={(e) => setLead({ ...lead, name: e.target.value })}
              />
              <input
                type="email"
                required
                placeholder="E-mail"
                className="border rounded-lg px-3 py-2"
                value={lead.email}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
              />
              <input
                type="tel"
                placeholder="WhatsApp (DDD + número)"
                className="border rounded-lg px-3 py-2"
                value={lead.whatsapp}
                onChange={(e) => setLead({ ...lead, whatsapp: e.target.value })}
              />
              <button
                disabled={status.loading}
                className="rounded-lg bg-blue-600 text-white font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
              >
                {status.loading ? "Enviando..." : "Quero uma demo"}
              </button>
              {status.msg && (
                <div className={`text-sm ${status.ok ? "text-green-600" : "text-amber-600"}`}>
                  {status.msg} Ou escreva para{" "}
                  <a className="underline" href="mailto:rodrigooidr@hotmail.com">
                    rodrigooidr@hotmail.com
                  </a>.
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section className="border-y bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-gray-600 flex flex-wrap items-center gap-6 justify-center">
          <span>Confiado por equipes comerciais e de atendimento</span>
          <span className="inline-block h-1 w-1 rounded-full bg-gray-300" />
          <span>Tempo médio de resposta ↓ 57%</span>
          <span className="inline-block h-1 w-1 rounded-full bg-gray-300" />
          <span>Conversão de leads ↑ 23%</span>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section id="beneficios" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-black">Por que usar o Cresce<span className="text-blue-600">Já</span>?</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            { t: "Omnichannel real", d: "WhatsApp, Instagram e Facebook em um só lugar. Histórico centralizado por cliente." },
            { t: "IA que coleta e qualifica", d: "Perguntas inteligentes para capturar dados e enviar direto ao seu CRM." },
            { t: "Aprovação e governança", d: "Fluxo de aprovação de conteúdo e trilha de auditoria para segurança e compliance." },
            { t: "Marketing integrado", d: "Crie posts, e-mails e campanhas com IA — e aprove com 1 clique." },
            { t: "Relatórios e créditos", d: "Acompanhe uso de IA, custos e ROI, com controle fino de créditos." },
            { t: "Onboarding guiado", d: "Passo a passo simples para conectar canais e começar em minutos." },
          ].map((b) => (
            <div key={b.t} className="p-6 border rounded-2xl hover:shadow-sm">
              <h3 className="font-bold">{b.t}</h3>
              <p className="text-gray-600 mt-1 text-sm">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-black">Como funciona</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {[
              { n: "1", t: "Conecte seus canais", d: "WhatsApp, Instagram e Facebook via onboarding guiado." },
              { n: "2", t: "Ative a IA", d: "Coleta automática de dados com tom humano e engraçado quando fizer sentido." },
              { n: "3", t: "Converta mais", d: "Oportunidades entram no CRM e você fecha com rapidez." },
            ].map((s) => (
              <div key={s.n} className="p-6 border rounded-2xl">
                <div className="text-blue-600 font-black text-2xl">{s.n}</div>
                <div className="font-semibold mt-2">{s.t}</div>
                <div className="text-sm text-gray-600 mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-black">Módulos do produto</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            { t: "Atendimento Omnichannel", link: "/omnichannel/chat", d: "Inbox unificada, filas e SLA." },
            { t: "CRM",                link: "/crm/oportunidades", d: "Kanban, estágios e agendamentos." },
            { t: "Marketing + IA",     link: "/marketing",         d: "Criação e aprovação de conteúdo." },
            { t: "Aprovação & Logs",   link: "/governanca",        d: "Rastreabilidade e segurança." },
            { t: "Créditos de IA",     link: "/creditos",          d: "Controle de consumo e limites." },
            { t: "Onboarding",         link: "/onboarding",        d: "Conexão de canais e templates." },
          ].map((m) => (
            <Link key={m.t} to={m.link} className="p-6 border rounded-2xl hover:shadow-sm block">
              <div className="font-bold">{m.t}</div>
              <div className="text-sm text-gray-600 mt-1">{m.d}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-black">Demonstração rápida</h2>
        <p className="text-gray-600 mt-2">
            Veja o fluxo do cliente e como a IA coleta dados e cria oportunidades.
          </p>
          <div className="mt-6 border rounded-2xl aspect-video bg-white grid place-items-center">
            <span className="text-sm text-gray-500">Coloque aqui um vídeo curto da demo quando quiser.</span>
          </div>
        </div>
      </section>

      {/* PLANOS (DINÂMICO) */}
      <section id="planos" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-black">Planos simples, foco em resultado</h2>
        <div className="mt-8">
          {/* PricingTable carrega de /api/public/plans e já exibe preços e módulos por plano */}
          <PricingTable />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-black">Perguntas frequentes</h2>
          <div className="mt-6 grid md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <div className="font-semibold">Preciso de cartão para o teste?</div>
              <p className="text-gray-600">Não. Só criar a conta e começar.</p>
            </div>
            <div>
              <div className="font-semibold">Posso usar meu número pessoal de WhatsApp no teste?</div>
              <p className="text-gray-600">Sim, oferecemos modo de teste seguro para você experimentar sem trocar de número.</p>
            </div>
            <div>
              <div className="font-semibold">Como a IA coleta dados?</div>
              <p className="text-gray-600">Com prompts otimizados e linguagem natural, registrando tudo no CRM.</p>
            </div>
            <div>
              <div className="font-semibold">Tenho governança e aprovação?</div>
              <p className="text-gray-600">Sim. Fluxos de aprovação e logs completos para auditoria.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-sm">
          <div>© {new Date().getFullYear()} CresceJá — Todos os direitos reservados</div>
          <div className="flex items-center gap-4">
            <a href="#contato" className="hover:text-blue-600">Contato</a>
            <Link to="/lgpd" className="hover:text-blue-600">LGPD</Link>
            <a href="mailto:rodrigooidr@hotmail.com" className="hover:text-blue-600">E-mail</a>
          </div>
        </div>
      </footer>
    </div>
  );
}



