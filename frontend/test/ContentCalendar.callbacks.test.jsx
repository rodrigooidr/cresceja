import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("../src/api");
jest.mock("../src/api/inboxApi.js");

import ContentCalendar from "../src/pages/marketing/ContentCalendar.jsx";
import api from "../src/api";
import inboxApi from "../src/api/inboxApi.js";
import { campaignsFixture, suggestionsFixture } from "./fixtures/calendar.fixtures.js";
import {
  registerContentCalendarRoutes,
  setupContentCalendarRoutes,
} from "./utils/mockContentCalendarRoutes.js";

function setupApiMocks() {
  api.get.mockImplementation((url) => {
    if (url === "/marketing/content/jobs") {
      return Promise.resolve({
        data: {
          items: [
            { id: "job-1", title: "Job 1", suggestionId: "sug-1" },
            { id: "job-2", title: "Job 2", suggestionId: "sug-1" },
          ],
        },
      });
    }
    if (/\/orgs\/[^/]+\/campaigns$/.test(url)) {
      return Promise.resolve({ data: { items: campaignsFixture() } });
    }
    if (/\/orgs\/[^/]+\/campaigns\/[^/]+\/suggestions/.test(url)) {
      return Promise.resolve({ data: { items: suggestionsFixture() } });
    }
    return Promise.resolve({ data: {} });
  });
  api.post.mockImplementation((url, payload, config) => inboxApi.post(url, payload, config));
  api.patch.mockResolvedValue({ data: { ok: true } });
}

describe("ContentCalendar – onApproved + i18n", () => {
  setupContentCalendarRoutes();
  beforeEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    inboxApi.__mock?.reset?.();
    registerContentCalendarRoutes();
    setupApiMocks();
    window.toast = jest.fn();
  });

  afterEach(() => {
    window.toast = undefined;
  });

  it("chama onApproved com resultado ok e usa textos do dicionário", async () => {
    const onApproved = jest.fn();
    const t = {
      approve: "Approve",
      approving: "Approving…",
      approved_ok: "Approved!",
      partial_error: "Partial.",
      rate_limited: "Too many attempts.",
      full_error: "Failed.",
      partial_alert: "Partial alert.",
      retry: "Retry",
    };

    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    render(<ContentCalendar currentUser={superAdmin} onApproved={onApproved} t={t} />);
    await screen.findByText("Sugestão IG/FB #1");
    const btn = await screen.findByTestId("btn-approve");
    expect(btn).toHaveTextContent("Approve");
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeEnabled());
    await waitFor(() => expect(onApproved).toHaveBeenCalled(), { timeout: 5000 });
    expect(onApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: expect.any(String),
        suggestionId: expect.any(String),
        result: expect.objectContaining({ ok: true }),
      })
    );

    const called = window.toast.mock.calls.find(([arg]) => (arg?.title || "") === "Approved!");
    expect(called).toBeTruthy();
  });

  it("propaga resultado parcial para o callback", async () => {
    inboxApi.__mock.failWith(/\/orgs\/.*\/suggestions\/.*\/approve$/, { status: 503 });
    const onApproved = jest.fn();

    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    render(<ContentCalendar currentUser={superAdmin} onApproved={onApproved} />);
    await screen.findByText("Sugestão IG/FB #1");
    const btn = await screen.findByTestId("btn-approve");
    fireEvent.click(btn);

    await waitFor(() => expect(onApproved).toHaveBeenCalled(), { timeout: 10000 });
    const call = onApproved.mock.calls.pop()?.[0];
    expect(call?.result?.partial).toBe(true);
  });
});
