import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import PlansPage from "@/pages/admin/plans/PlansPage";
import * as api from "@/api/inboxApi";

afterEach(() => {
  jest.restoreAllMocks();
});

test("carrega e lista planos", async () => {
  jest.spyOn(api, "adminListPlans").mockResolvedValue([
    { id: "p1", name: "Starter", currency: "BRL", monthly_price: 79 },
    { id: "p2", name: "Pro", currency: "BRL", monthly_price: 199 },
  ]);
  jest.spyOn(api, "adminGetPlanFeatures").mockResolvedValue([
    { code: "posts", label: "Posts", type: "number", value: 10 },
  ]);

  render(<PlansPage />);

  const items = await screen.findAllByTestId("plan-item");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Starter");
});

test("abre plano, altera feature e salva", async () => {
  jest.spyOn(api, "adminListPlans").mockResolvedValue([
    { id: "p1", name: "Starter", currency: "BRL", monthly_price: 79 },
  ]);
  jest.spyOn(api, "adminGetPlanFeatures").mockResolvedValue([
    { code: "posts", label: "Posts", type: "number", value: 10 },
    { code: "whatsapp", label: "WhatsApp", type: "boolean", value: true },
  ]);
  const putSpy = jest.spyOn(api, "adminPutPlanFeatures").mockResolvedValue({ ok: true });

  render(<PlansPage />);

  await waitFor(() => expect(api.adminGetPlanFeatures).toHaveBeenCalled());

  const postsInput = await screen.findByTestId("feature-input-posts");
  fireEvent.change(postsInput, { target: { value: "25" } });

  const saveButton = screen.getByTestId("btn-save-features");
  await waitFor(() => expect(saveButton).not.toBeDisabled());
  fireEvent.click(saveButton);
  await waitFor(() => expect(putSpy).toHaveBeenCalledTimes(1));
  expect(putSpy.mock.calls[0][1]).toEqual([
    { code: "posts", type: "number", value: 25 },
    { code: "whatsapp", type: "boolean", value: true },
  ]);
});
