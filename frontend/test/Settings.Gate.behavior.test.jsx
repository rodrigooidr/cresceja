import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import Sidebar from "../src/ui/layout/Sidebar.jsx";
import { screen, render, waitFor } from "@testing-library/react";
import FeatureRoute from "../src/routes/FeatureRoute.jsx";
import { MemoryRouter, Routes, Route } from "react-router-dom";

test("sidebar esconde item quando limit=0", async () => {
  global.setFeatureGate({ whatsapp: true }, { wa_numbers: 0 });
  renderWithRouterProviders(<Sidebar />);
  await screen.findByTestId("sidebar");
  expect(screen.queryByTestId("nav-whatsapp")).toBeNull();
});

test("rota de whatsapp bloqueia e redireciona", async () => {
  const org = { features: { whatsapp: true }, plan: { limits: { wa_numbers: 0 } } };
  render(
    <MemoryRouter initialEntries={["/settings/whatsapp"]}>
      <Routes>
        <Route
          path="/settings/whatsapp"
          element={
            <FeatureRoute
              org={org}
              featureKey="whatsapp"
              limitKey="wa_numbers"
              fallback="/upgrade"
            >
              <div data-testid="wa-ok" />
            </FeatureRoute>
          }
        />
        <Route path="/upgrade" element={<div data-testid="upgrade-page" />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(screen.getByTestId("upgrade-page")).toBeInTheDocument();
  });
});

test("ilimitado (-1) mantém visível", async () => {
  global.setFeatureGate({ instagram: true }, { instagram_accounts: -1 });
  renderWithRouterProviders(<Sidebar />);
  expect(await screen.findByTestId("nav-instagram")).toBeInTheDocument();
});

