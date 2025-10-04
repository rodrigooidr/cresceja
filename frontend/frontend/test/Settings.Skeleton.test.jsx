import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import SettingsPage from "../src/pages/SettingsPage.jsx";
import { screen } from "@testing-library/react";

test("mostra skeleton enquanto org não carregou", async () => {
  global.setFeatureGate({}, {});
  renderWithRouterProviders(<SettingsPage />, {
    org: { selected: "org_test", orgs: [{ id: "org_test", name: "Org Test" }] },
  });
  expect(await screen.findByTestId("settings-skeleton")).toBeInTheDocument();
});

