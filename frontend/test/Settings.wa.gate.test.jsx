import { renderWithRouterProviders } from "./utils/renderWithRouterProviders.jsx";
import SettingsPage from "../src/pages/SettingsPage.jsx";
import { screen } from "@testing-library/react";

describe("Settings WhatsApp gate", () => {
  test("whatsapp visível com limit -1", async () => {
    global.setFeatureGate({ whatsapp: true }, { wa_numbers: -1 });
    renderWithRouterProviders(<SettingsPage />, {
      org: { selected: "org_test", orgs: [{ id: "org_test", name: "Org Test" }] },
    });
    expect(await screen.findByTestId("settings-whatsapp-section")).toBeInTheDocument();
  });

  test("whatsapp visível com flag string", async () => {
    global.setFeatureGate({ whatsapp: "enabled" }, { wa_numbers: 1 });
    renderWithRouterProviders(<SettingsPage />, {
      org: { selected: "org_test", orgs: [{ id: "org_test", name: "Org Test" }] },
    });
    expect(await screen.findByTestId("settings-whatsapp-section")).toBeInTheDocument();
  });

  test("esconde quando não há plan/limits", async () => {
    global.setFeatureGate({ whatsapp: true }, {});
    renderWithRouterProviders(<SettingsPage />, {
      org: { selected: "org_test", orgs: [{ id: "org_test", name: "Org Test" }] },
    });
    await screen.findByTestId("settings-skeleton");
    expect(screen.queryByTestId("settings-whatsapp-section")).toBeNull();
  });
});

