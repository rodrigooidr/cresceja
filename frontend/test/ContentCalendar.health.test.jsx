import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ContentCalendar from "../src/pages/marketing/ContentCalendar.jsx";
import inboxApi from "../src/api/inboxApi";

const jobsFixture = [
  { id: "j1", title: "Sucesso", suggestionId: "s1" },
  { id: "j2", title: "Parcial", suggestionId: "s2" },
  { id: "j3", title: "RateLimit", suggestionId: "s3" },
  { id: "j4", title: "Cancel/Atalhos/Undo", suggestionId: "s4" },
];

function mount() {
  return render(
    <MemoryRouter>
      <ContentCalendar
        currentUser={{ role: "OrgOwner", roles: ["SuperAdmin"] }}
        jobs={jobsFixture}
        bulkConcurrency={2}
        undoTtlMs={1500}
      />
    </MemoryRouter>
  );
}

describe("ContentCalendar – Health check canário", () => {
  let originalToast;
  let originalAnalytics;

  beforeEach(() => {
    jest.useRealTimers();
    originalToast = window.toast;
    originalAnalytics = window.analytics;
    inboxApi.__mock?.reset?.();
    inboxApi.__mock?.setDelay?.(50);
    window.toast = jest.fn();
    window.analytics = { track: jest.fn() };
  });

  afterEach(() => {
    window.toast = originalToast;
    window.analytics = originalAnalytics;
  });

  it("percorre sucesso → parcial → rate-limit(retry) → cancel → atalhos → undo", async () => {
    mount();

    const job1 = await screen.findByTestId("job-checkbox-j1");
    const job2 = await screen.findByTestId("job-checkbox-j2");
    const job3 = await screen.findByTestId("job-checkbox-j3");
    const job4 = await screen.findByTestId("job-checkbox-j4");

    await waitFor(() => {
      expect(job1).not.toBeDisabled();
      expect(job2).not.toBeDisabled();
      expect(job3).not.toBeDisabled();
      expect(job4).not.toBeDisabled();
    });

    fireEvent.click(job1);
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(() => expect(screen.getByTestId("bulk-bar")).toBeInTheDocument());
    await waitFor(() => expect(window.toast).toHaveBeenCalled(), { timeout: 15000 });
    await waitFor(() => expect(job1).not.toBeDisabled(), { timeout: 5000 });
    window.toast.mockClear();

    inboxApi.__mock.reset();
    inboxApi.__mock.setDelay(50);
    inboxApi.__mock.failWith(/\/marketing\/suggestions\/s2\/approve$/, { status: 503 });

    fireEvent.click(job2);
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(() => expect(job2).not.toBeDisabled(), { timeout: 5000 });
    expect(job2).toBeChecked();
    const suggestionRetries = inboxApi.post.mock.calls.filter(([url]) =>
      /\/marketing\/suggestions\/s2\/approve$/.test(url)
    );
    expect(suggestionRetries.length).toBeGreaterThan(1);
    window.toast.mockClear();

    inboxApi.__mock.reset();
    inboxApi.__mock.setDelay(50);
    inboxApi.__mock.failNTimes(/\/marketing\/suggestions\/s3\/approve$/, 2, { status: 429 });

    fireEvent.click(job3);
    fireEvent.click(screen.getByTestId("bulk-start"));

    await waitFor(() => expect(window.toast).toHaveBeenCalled(), { timeout: 15000 });
    await waitFor(() => expect(job3).not.toBeDisabled(), { timeout: 5000 });
    window.toast.mockClear();

    inboxApi.__mock.reset();
    inboxApi.__mock.setDelay(200);
    fireEvent.click(job4);
    fireEvent.click(screen.getByTestId("bulk-start"));
    const cancelBtn = await screen.findByTestId("bulk-cancel");
    fireEvent.click(cancelBtn);
    await waitFor(() => expect(screen.getByTestId("bulk-bar")).toBeInTheDocument());
    await waitFor(() => expect(job4).not.toBeDisabled(), { timeout: 5000 });

    fireEvent.keyDown(document, { key: "a", ctrlKey: true });
    expect(screen.getByTestId("job-checkbox-j1")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j2")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j3")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j4")).toBeChecked();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("job-checkbox-j1")).not.toBeChecked();

    fireEvent.click(job4);
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });
    await screen.findByTestId("bulk-bar");
    await waitFor(() => expect(job4).not.toBeDisabled(), { timeout: 5000 });

    inboxApi.__mock.reset();
    inboxApi.__mock.setDelay(30);

    fireEvent.click(job1);
    fireEvent.click(screen.getByTestId("bulk-start"));
    await waitFor(() => expect(window.toast).toHaveBeenCalled(), { timeout: 15000 });

    const undoCall = window.toast.mock.calls.find(
      ([arg]) => arg && arg.action && typeof arg.action.onClick === "function"
    );
    expect(undoCall).toBeTruthy();
    undoCall[0].action.onClick();
  }, 20000);
});
