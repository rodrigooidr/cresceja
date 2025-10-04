import React from "react";
import { render } from "@testing-library/react";
import useApproval from "../src/pages/marketing/hooks/useApproval.js";
import inboxApi from "../src/api/inboxApi.js";

function Harness({ onReady }) {
  const hook = useApproval();
  React.useEffect(() => {
    onReady?.(hook);
  }, [hook, onReady]);
  return <div />;
}

describe("useApproval – bulk approvals", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    inboxApi.__mock.setDelay(40);
    jest.useRealTimers();
  });

  it("processa em lote com concorrência limitada e reporta progresso", async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({ jobId: `j${index + 1}`, suggestionId: `s${index + 1}` }));
    const progressEvents = [];
    const itemEvents = [];
    const hookRef = { current: null };

    render(<Harness onReady={(value) => { hookRef.current = value; }} />);
    const { approveMany } = hookRef.current;

    const { promise } = approveMany({
      items,
      concurrency: 2,
      onProgress: (progress) => progressEvents.push(progress),
      onItem: (item) => itemEvents.push(item),
    });

    const summary = await promise;
    expect(summary.total).toBe(5);
    expect(summary.ok + summary.partial + summary.fail).toBe(5);
    expect(progressEvents.length).toBeGreaterThanOrEqual(5);
    expect(itemEvents).toHaveLength(5);
  });

  it("suporta cenários parciais e retorna estatísticas corretas", async () => {
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s3\/approve$/, { status: 503 });
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s5\/approve$/, { status: 503 });

    const items = ["1", "2", "3", "4", "5"].map((value) => ({ jobId: `j${value}`, suggestionId: `s${value}` }));
    let hook;
    render(<Harness onReady={(value) => { hook = value; }} />);
    const { promise } = hook.approveMany({ items, concurrency: 3 });

    const summary = await promise;
    expect(summary.total).toBe(5);
    expect(summary.partial).toBe(2);
    expect(summary.ok + summary.partial + summary.fail).toBe(5);
    expect(summary.results[2]).toEqual(expect.objectContaining({
      index: 2,
      jobId: "j3",
      suggestionId: "s3",
      result: expect.objectContaining({ partial: true }),
    }));
  });

  it("permite cancelar em andamento (abort) e marca aborted=true", async () => {
    inboxApi.__mock.setDelay(120);
    const items = Array.from({ length: 8 }, (_, index) => ({ jobId: `j${index + 1}`, suggestionId: `s${index + 1}` }));
    let hook;
    render(<Harness onReady={(value) => { hook = value; }} />);

    const { promise, abort } = hook.approveMany({ items, concurrency: 3 });
    setTimeout(() => abort(), 60);

    const summary = await promise;
    expect(summary.aborted).toBe(true);
    expect(summary.ok + summary.partial + summary.fail).toBeLessThan(items.length);
  });
});
