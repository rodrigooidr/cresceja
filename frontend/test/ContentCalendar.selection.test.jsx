import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ContentCalendar from "../src/pages/marketing/ContentCalendar.jsx";
import inboxApi from "../src/api/inboxApi";

function mountWithJobs(jobs) {
  return render(<ContentCalendar currentUser={{ role: "SuperAdmin" }} jobs={jobs} />);
}

describe("ContentCalendar – Seleção avançada", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    localStorage.clear();
    window.toast = jest.fn();
  });

  afterEach(() => {
    window.toast = undefined;
  });

  it("Selecionar tudo / Tri-state / Limpar", () => {
    const jobs = [
      { id: "j1", title: "A", suggestionId: "s1" },
      { id: "j2", title: "B", suggestionId: "s2" },
      { id: "j3", title: "C", suggestionId: "s3" },
    ];
    mountWithJobs(jobs);

    const master = screen.getByTestId("master-checkbox");
    const j1 = screen.getByTestId("job-checkbox-j1");
    const j2 = screen.getByTestId("job-checkbox-j2");
    const j3 = screen.getByTestId("job-checkbox-j3");

    // Nenhum selecionado
    expect(master).not.toBeChecked();

    // Seleciona todos
    fireEvent.click(master);
    expect(j1).toBeChecked();
    expect(j2).toBeChecked();
    expect(j3).toBeChecked();
    expect(master).toBeChecked();

    // Desmarca um -> master vira indeterminate (checked = false)
    fireEvent.click(j2);
    expect(master).not.toBeChecked();

    // Clicar no master novamente seleciona todos
    fireEvent.click(master);
    expect(j1).toBeChecked();
    expect(j2).toBeChecked();
    expect(j3).toBeChecked();

    // Limpa todos clicando novamente
    fireEvent.click(master);
    expect(j1).not.toBeChecked();
    expect(j2).not.toBeChecked();
    expect(j3).not.toBeChecked();
    expect(master).not.toBeChecked();
  });

  it("Shift-click seleciona faixa", () => {
    const jobs = [
      { id: "j1", title: "A", suggestionId: "s1" },
      { id: "j2", title: "B", suggestionId: "s2" },
      { id: "j3", title: "C", suggestionId: "s3" },
      { id: "j4", title: "D", suggestionId: "s4" },
    ];
    mountWithJobs(jobs);

    const j1 = screen.getByTestId("job-checkbox-j1");
    const j3 = screen.getByTestId("job-checkbox-j3");

    // Clica j1 normal
    fireEvent.click(j1);

    // Shift-click j3 => deve marcar j1..j3
    fireEvent.click(j3, { shiftKey: true });

    expect(screen.getByTestId("job-checkbox-j1")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j2")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j3")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j4")).not.toBeChecked();
  });
});
