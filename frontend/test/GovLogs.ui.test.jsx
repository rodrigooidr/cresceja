import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GovLogsPage from "../src/pages/marketing/GovLogsPage.jsx";
import inboxApi from "../src/api/inboxApi.js";
import { toCSV } from "../src/lib/csv.js";

describe("Governança & Logs – UI", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    // semente de logs
    return Promise.all([
      inboxApi.post("/gov/logs", { event: "marketing.approve.success", payload: { jobId: "j1", suggestionId: "s1", bulk: false } }),
      inboxApi.post("/gov/logs", { event: "marketing.approve.partial", payload: { jobId: "j2", suggestionId: "s2", bulk: true } }),
      inboxApi.post("/gov/logs", { event: "marketing.revert.success", payload: { jobId: "j1", suggestionId: "s1" } }),
    ]);
  });

  it("filtra por evento e busca por jobId", async () => {
    render(<GovLogsPage defaultLimit={50} />);
    await screen.findByTestId("gov-page");

    // filtro evento: parcial
    fireEvent.change(screen.getByTestId("filter-event"), { target: { value: "marketing.approve.partial" } });
    fireEvent.click(screen.getByTestId("btn-refresh"));
    await waitFor(() => {
      const rows = screen.getAllByTestId("log-row");
      expect(rows.length).toBeGreaterThan(0);
    });

    // busca por jobId j1
    fireEvent.change(screen.getByTestId("filter-event"), { target: { value: "" } }); // todos
    fireEvent.click(screen.getByTestId("btn-refresh"));
    await waitFor(() => screen.getAllByTestId("log-row"));
    fireEvent.change(screen.getByTestId("filter-query"), { target: { value: "j1" } });
    const filtered = screen.getAllByTestId("log-row");
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("gera CSV válido com cabeçalhos esperados", async () => {
    render(<GovLogsPage defaultLimit={10} />);
    await screen.findByTestId("gov-page");
    // Não clicamos export para não abrir download no teste, mas validamos a lib
    const sample = [
      { id: "1", ts: 1, time: "t1", event: "e", jobId: "j", suggestionId: "s", status: "", bulk: false, actorName: "", actorRole: "" },
    ];
    const csv = toCSV(sample, { headers: ["id","ts","time","event","jobId","suggestionId","status","bulk","actorName","actorRole"] });
    expect(csv.split("\n")[0]).toBe("id;ts;time;event;jobId;suggestionId;status;bulk;actorName;actorRole");
    expect(csv.split("\n")[1]).toContain("1;1;t1;e;j;s");
  });
});
