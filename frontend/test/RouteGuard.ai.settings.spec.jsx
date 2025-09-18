import React from "react";
import AppRoutes from "@/routes/AppRoutes.jsx";
import RequireRole from "@/routes/guards/RequireRole.jsx";

jest.mock("@/pages/settings/OrgAIPage.jsx", () => () => <div data-testid="mock-orgai" />);

describe("Contrato da rota /settings/ai", () => {
  it("usa RequireRole com orgAdmin e superAdmin", () => {
    const list = Array.isArray(AppRoutes) ? AppRoutes : AppRoutes.routes || [];
    const aiRoute = list.find((route) => route.path === "/settings/ai");
    expect(aiRoute).toBeDefined();
    expect(aiRoute.element.type).toBe(RequireRole);
    expect(aiRoute.element.props.roles).toEqual(expect.arrayContaining(["orgAdmin", "superAdmin"]));
    const child = React.Children.only(aiRoute.element.props.children);
    expect(child).toBeTruthy();
  });
});
