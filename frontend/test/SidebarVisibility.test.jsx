import { screen, waitFor } from "@testing-library/react";
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
  const user = userEvent.setup();

  await global.renderAct(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

  const toggle = await screen.findByTestId("sidebar-toggle");

  await user.click(toggle);
  await waitFor(() => {
    expect(screen.getByTestId("sidebar")).toHaveAttribute("aria-expanded", "false");
  });

  await user.click(toggle);
  await waitFor(() => {
    expect(screen.getByTestId("sidebar")).toHaveAttribute("aria-expanded", "true");
  });
});

