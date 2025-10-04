import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ContentCalendar from "../src/pages/marketing/ContentCalendar.jsx";
import inboxApi from "../src/api/inboxApi";
import { fetchLogs } from "../src/lib/audit";

jest.setTimeout(15000);

describe("Governança & Logs – Aprovação e Undo", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    window.toast = jest.fn();
    jest.spyOn(Date, "now").mockReturnValue(1737072000000);
  });
  afterEach(() => {
    window.toast = undefined;
    Date.now.mockRestore?.();
  });

  it("loga undo (revert) com sucesso", async () => {
    const jobs = [{ id: "j4", title: "D", suggestionId: "s4" }];
    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    render(<ContentCalendar currentUser={superAdmin} jobs={jobs} undoTtlMs={1000} />);

    let undoAction = null;
    window.toast.mockImplementation((payload) => {
      undoAction = payload?.action?.onClick ?? null;
    });

    fireEvent.click(screen.getByTestId("job-checkbox-j4"));
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(async () => {
      const logs = await fetchLogs({ event: "marketing.approve.success" });
      expect(logs.some((l) => l?.payload?.jobId === "j4")).toBe(true);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(typeof undoAction).toBe("function");
    }, { timeout: 5000 });

    await act(async () => {
      undoAction?.();
    });

    await waitFor(async () => {
      const logs = await fetchLogs({ event: "marketing.revert.success" });
      expect(logs.some((l) => l?.payload?.jobId === "j4")).toBe(true);
    }, { timeout: 5000 });

    expect(window.toast).toHaveBeenCalled();
  });

  it("loga sucesso de aprovação", async () => {
    const jobs = [{ id: "j1", title: "A", suggestionId: "s1" }];
    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    render(<ContentCalendar currentUser={superAdmin} jobs={jobs} />);

    fireEvent.click(screen.getByTestId("job-checkbox-j1"));
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(async () => {
      const logs = await fetchLogs({ event: "marketing.approve.success" });
      expect(logs.length).toBeGreaterThan(0);
      const last = logs[logs.length - 1];
      expect(last.payload).toEqual(expect.objectContaining({ jobId: "j1", suggestionId: "s1" }));
    }, { timeout: 5000 });
  });

  it("loga parcial e erro corretamente", async () => {
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s2\/approve$/, { status: 503 });

    const jobs = [{ id: "j2", title: "B", suggestionId: "s2" }];
    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    const view = render(<ContentCalendar currentUser={superAdmin} jobs={jobs} />);

    fireEvent.click(screen.getByTestId("job-checkbox-j2"));
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(async () => {
      const logs = await fetchLogs({ event: "marketing.approve.partial" });
      expect(logs.some((l) => l?.payload?.jobId === "j2")).toBe(true);
    }, { timeout: 5000 });

    inboxApi.__mock.reset();
    inboxApi.__mock.failWith(/\/marketing\/jobs\/j3\/approve$/, { status: 503 });
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s3\/approve$/, { status: 503 });

    view.rerender(
      <ContentCalendar currentUser={{ role: "OrgOwner", roles: ["SuperAdmin"] }} jobs={[{ id: "j3", title: "C", suggestionId: "s3" }]} />
    );
    fireEvent.click(screen.getByTestId("job-checkbox-j3"));
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(async () => {
      const logs = await fetchLogs({ event: "marketing.approve.error" });
      expect(logs.some((l) => l?.payload?.jobId === "j3")).toBe(true);
    }, { timeout: 5000 });
  });

});
