import React from "react";
import ContentCalendar from "./ContentCalendar.jsx";
import inboxApi from "../../api/inboxApi.js";

const meta = {
  title: "Marketing/ContentCalendar",
  component: ContentCalendar,
  parameters: { layout: "fullscreen" },
};
export default meta;

function seedJobs() {
  // Mantém a mesma forma do mock GET /marketing/jobs (se sua UI ler de props, passe via args)
  return [
    { id: "j1", title: "Post A", suggestionId: "s1" },
    { id: "j2", title: "Post B", suggestionId: "s2" },
    { id: "j3", title: "Post C", suggestionId: "s3" },
  ];
}

// Util para resetar mock antes de cada story
function resetMock({ delay } = {}) {
  inboxApi.__mock?.reset?.();
  if (delay) inboxApi.__mock?.setDelay?.(delay);
}

export const Sucesso = {
  args: {
    currentUser: { role: "SuperAdmin" },
    jobs: seedJobs(),
  },
  render: (args) => {
    resetMock({ delay: 50 });
    window.toast = (opts) => console.log("toast:", opts); // visualiza no console
    return <ContentCalendar {...args} />;
  },
};

export const Parcial = {
  args: {
    currentUser: { role: "SuperAdmin" },
    jobs: seedJobs(),
  },
  render: (args) => {
    resetMock({ delay: 80 });
    // falha só nas sugestões s2 e s3 => gera parcial
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s(2|3)\/approve$/, { status: 503 });
    return <ContentCalendar {...args} />;
  },
};

export const RateLimitDepoisSucesso = {
  args: {
    currentUser: { role: "SuperAdmin" },
    jobs: seedJobs(),
  },
  render: (args) => {
    resetMock({ delay: 60 });
    // 2x 429 e depois sucesso na sugestão s2
    inboxApi.__mock.failNTimes(/\/marketing\/suggestions\/s2\/approve$/, 2, { status: 429, message: "rate limit" });
    return <ContentCalendar {...args} />;
  },
};

export const ErroCompleto = {
  args: {
    currentUser: { role: "SuperAdmin" },
    jobs: [{ id: "j9", title: "Falhar tudo", suggestionId: "s9" }],
  },
  render: (args) => {
    resetMock({ delay: 40 });
    inboxApi.__mock.failWith(/\/marketing\/jobs\/j9\/approve$/, { status: 503 });
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s9\/approve$/, { status: 503 });
    return <ContentCalendar {...args} />;
  },
};

export const AbortCorridaCliques = {
  args: {
    currentUser: { role: "SuperAdmin" },
    jobs: seedJobs(),
  },
  render: (args) => {
    resetMock({ delay: 150 });
    // opcional: induz parcial na 1ª tentativa – a 2ª vai abortar a 1ª
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s1\/approve$/, { status: 503 });
    return <ContentCalendar {...args} />;
  },
};
