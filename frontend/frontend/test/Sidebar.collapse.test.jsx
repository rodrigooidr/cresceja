import { screen, waitFor } from "@testing-library/react";
import Sidebar from "../src/ui/layout/Sidebar.jsx";
import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";

test("esconde link quando gate bloqueia", async () => {
  global.setFeatureGate({ instagram: false }, { instagram_accounts: 0 });
  renderWithRouterProviders(<Sidebar />);
  await waitFor(() => {
    expect(screen.queryByTestId("nav-instagram")).toBeNull();
  });
});

