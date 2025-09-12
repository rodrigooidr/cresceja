import React from "react";
import { render, screen } from "@testing-library/react";
import PlansAdminPage from "../src/pages/admin/PlansAdminPage.jsx";

jest.mock("../src/hooks/useActiveOrgGate", () => jest.fn(() => ({ allowed: true })));
jest.mock("../src/api/inboxApi", () => ({
  get: jest.fn(() => Promise.resolve({ data: { plans: [], feature_defs: [], plan_features: [] } })),
  post: jest.fn(),
  put: jest.fn(),
}));
jest.mock("../src/components/PricingTable", () => (props) => <div data-testid="pricing-table" {...props} />);

test("loads plans and renders preview", async () => {
  const inboxApi = require("../src/api/inboxApi");
  render(<PlansAdminPage minRole="SuperAdmin" />);
  const called = inboxApi.get.mock.calls.some(([url]) => url === "/admin/plans");
  expect(called).toBe(true);
  const el = await screen.findByTestId("pricing-table");
  expect(el.getAttribute("endpoint")).toBe("/public/plans");
});
