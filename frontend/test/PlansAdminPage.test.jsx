import { render, screen, waitFor } from "@testing-library/react";
import PlansPage from "@/pages/admin/plans/PlansPage";
import * as api from "@/api/inboxApi";

afterEach(() => {
  jest.restoreAllMocks();
});

test("carrega e lista planos", async () => {
  jest.spyOn(api, "adminListPlans").mockResolvedValue([
    { id: "p1", name: "Starter", currency: "BRL", monthly_price: 79, is_active: true },
  ]);
  jest.spyOn(api, "adminGetPlanFeatures").mockResolvedValue([]);

  render(<PlansPage />);

  await waitFor(() => expect(screen.getByText("Starter")).toBeInTheDocument());
});
