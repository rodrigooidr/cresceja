import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContentCalendar from "../src/pages/marketing/ContentCalendar.jsx";
import inboxApi from "../src/api/inboxApi";
import { mockContentCalendarRoutes } from "./utils/mockContentCalendarRoutes.js";

describe("ContentCalendar – Undo + atalhos", () => {
  beforeEach(() => {
    inboxApi.__mock?.reset?.();
    mockContentCalendarRoutes();
    inboxApi.__mock.setDelay(20);
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    window.toast = jest.fn();
  });

  afterEach(() => {
    window.toast = undefined;
  });

  it("executa Undo chamando /marketing/revert", async () => {
    const jobs = [
      { id: "j1", title: "A", suggestionId: "s1" },
    ];
    const origPost = inboxApi.post;
    inboxApi.post = jest.fn(origPost);

    try {
      const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
      render(<ContentCalendar currentUser={superAdmin} jobs={jobs} undoTtlMs={1000} />);

      const cb = screen.getByTestId("job-checkbox-j1");
      fireEvent.click(cb);
      fireEvent.click(screen.getByTestId("bulk-start"));

      await waitFor(() => expect(window.toast).toHaveBeenCalled());
      const call = window.toast.mock.calls.find(([arg]) => (arg?.title || "").includes("Aprovado"));
      expect(call).toBeTruthy();

      const action = call[0]?.action;
      expect(action?.onClick).toBeInstanceOf(Function);
      action.onClick();

      await waitFor(() => {
        expect(inboxApi.post).toHaveBeenCalledWith(
          "/marketing/revert",
          expect.objectContaining({ jobId: "j1", suggestionId: "s1" }),
          expect.anything()
        );
      });
    } finally {
      inboxApi.post = origPost;
    }
  });

  it("atalhos Ctrl+A, Esc e Ctrl+Enter funcionam", async () => {
    const jobs = [
      { id: "j1", title: "A", suggestionId: "s1" },
      { id: "j2", title: "B", suggestionId: "s2" },
    ];
    const superAdmin = { role: "OrgOwner", roles: ["SuperAdmin"] };
    render(<ContentCalendar currentUser={superAdmin} jobs={jobs} />);

    fireEvent.keyDown(document, { key: "a", ctrlKey: true });
    expect(screen.getByTestId("job-checkbox-j1")).toBeChecked();
    expect(screen.getByTestId("job-checkbox-j2")).toBeChecked();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("job-checkbox-j1")).not.toBeChecked();
    expect(screen.getByTestId("job-checkbox-j2")).not.toBeChecked();

    fireEvent.click(screen.getByTestId("job-checkbox-j1"));
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true });

    await screen.findByTestId("bulk-bar");
  });
});
