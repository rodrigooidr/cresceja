import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "../src/ui/layout/Sidebar.jsx";

const mockOrg = {
  orgs: [],
  loading: false,
  selected: null,
  setSelected: jest.fn(),
  canSeeSelector: false,
  publicMode: true,
  searchOrgs: jest.fn(),
  loadMoreOrgs: jest.fn(),
  hasMore: false,
  q: "",
};

jest.mock("../src/contexts/OrgContext.jsx", () => ({
  __esModule: true,
  useOrg: () => mockOrg,
}));

test("colapsa e expande sem warnings", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  await global.renderAct(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

  const toggle = screen.getByTestId("sidebar-toggle");

  await user.click(toggle);
  await global.actTick();
  expect(screen.getByTestId("sidebar")).toHaveAttribute("aria-expanded", "false");

  await user.click(toggle);
  await global.actTick();
  expect(screen.getByTestId("sidebar")).toHaveAttribute("aria-expanded", "true");
});

