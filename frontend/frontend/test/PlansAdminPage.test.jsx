import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/dom";
import PlansPage from "@/pages/admin/plans/PlansPage";
import * as api from "@/api/inboxApi";

const clone = (value) => JSON.parse(JSON.stringify(value));

const baseResponse = {
  plans: [
    { id: "plan-basic", name: "Starter", price_cents: 9900, currency: "BRL", is_active: true },
    { id: "plan-pro", name: "Pro", price_cents: 19900, currency: "BRL", is_active: true },
  ],
  feature_defs: [
    { code: "whatsapp_numbers", label: "WhatsApp", type: "number", category: "canais", sort_order: 10 },
    { code: "ai_generation", label: "Geração IA", type: "boolean", category: "ia", sort_order: 20 },
  ],
  plan_features: [
    {
      plan_id: "plan-basic",
      feature_code: "whatsapp_numbers",
      value: { value: 1 },
      ai_meter_code: null,
      ai_monthly_quota: null,
    },
    {
      plan_id: "plan-basic",
      feature_code: "ai_generation",
      value: { value: true },
      ai_meter_code: "content_tokens",
      ai_monthly_quota: 5000,
    },
  ],
};

beforeEach(() => {
  jest.spyOn(api, "adminListPlans").mockResolvedValue(clone(baseResponse));
  jest.spyOn(api, "adminUpdatePlan").mockResolvedValue({ data: { ok: true } });
  jest.spyOn(api, "adminCreatePlan").mockResolvedValue({ data: { plan: { id: "plan-new" } } });
  jest.spyOn(api, "adminDuplicatePlan").mockResolvedValue({ data: { plan: { id: "plan-copy" } } });
  jest.spyOn(api, "adminDeletePlan").mockResolvedValue({ data: { deleted: true } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("carrega e lista planos", async () => {
  await act(async () => {
    render(<PlansPage />);
  });

  const starterLabel = await screen.findByText("Starter");
  expect(starterLabel).toBeInTheDocument();
  expect(screen.getByText("Pro")).toBeInTheDocument();
  expect(screen.getByText(/R\$\s*199,00/)).toBeInTheDocument();
});

test("edita feature com campos de IA e salva", async () => {
  const response = clone(baseResponse);
  response.feature_defs = [
    { code: "ai_generation", label: "Geração IA", type: "boolean", category: "ia", sort_order: 10 },
    { code: "assistants", label: "Assistentes", type: "number", category: "ia", sort_order: 20 },
  ];
  response.plan_features = [
    {
      plan_id: "plan-basic",
      feature_code: "ai_generation",
      value: { value: true },
      ai_meter_code: "content_tokens",
      ai_monthly_quota: 1000,
    },
    {
      plan_id: "plan-basic",
      feature_code: "assistants",
      value: { value: 5 },
      ai_meter_code: null,
      ai_monthly_quota: null,
    },
  ];
  api.adminListPlans.mockResolvedValue(response);

  await act(async () => {
    render(<PlansPage />);
  });
  const starterButton = (await screen.findByText("Starter")).closest("button");
  if (starterButton) fireEvent.click(starterButton);

  const iaCheckbox = screen.getByLabelText(/Geração IA/i, { selector: "input" });
  fireEvent.click(iaCheckbox); // desmarca

  const meterSelect = screen.getByLabelText(/Medidor de IA/i);
  fireEvent.change(meterSelect, { target: { value: "assist_tokens" } });

  const quotaInput = screen.getByPlaceholderText("Ex.: 50000");
  fireEvent.change(quotaInput, { target: { value: "2000" } });

  const assistantsInput = screen.getByPlaceholderText("Ex.: 10");
  fireEvent.change(assistantsInput, { target: { value: "12" } });

  const saveButton = screen.getByRole("button", { name: /salvar/i });
  await waitFor(() => expect(saveButton).toBeEnabled());
  await act(async () => {
    fireEvent.click(saveButton);
  });

  await waitFor(() => expect(api.adminUpdatePlan).toHaveBeenCalled());
  await waitFor(() => expect(api.adminListPlans).toHaveBeenCalledTimes(2));
  const payload = api.adminUpdatePlan.mock.calls[0][1];
  expect(payload.features).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        feature_code: "ai_generation",
        value_bool: false,
        ai_meter_code: "assist_tokens",
        ai_monthly_quota: 2000,
      }),
      expect.objectContaining({
        feature_code: "assistants",
        value_number: 12,
      }),
    ])
  );
});

test("cria novo plano pelo modal", async () => {
  await act(async () => {
    render(<PlansPage />);
  });
  const starterButton = (await screen.findByText("Starter")).closest("button");
  if (starterButton) fireEvent.click(starterButton);

  const newButton = screen.getByRole("button", { name: /novo/i });
  fireEvent.click(newButton);

  const modal = await screen.findByRole("dialog");
  const nameInput = within(modal).getByLabelText(/Nome/i);
  const priceInput = within(modal).getByLabelText(/Preço/i);
  const currencySelect = within(modal).getByLabelText(/Moeda/i);

  fireEvent.change(nameInput, { target: { value: "Plano IA" } });
  fireEvent.change(priceInput, { target: { value: "12900" } });
  fireEvent.change(currencySelect, { target: { value: "USD" } });

  const createButton = within(modal).getByRole("button", { name: /criar/i });
  await act(async () => {
    fireEvent.click(createButton);
  });

  await waitFor(() => expect(api.adminCreatePlan).toHaveBeenCalled());
  expect(api.adminCreatePlan).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Plano IA",
      price_cents: 12900,
      currency: "USD",
    })
  );
  await waitFor(() => expect(api.adminListPlans).toHaveBeenCalledTimes(2));
});

test("duplica plano selecionado", async () => {
  await act(async () => {
    render(<PlansPage />);
  });
  const starterButton = (await screen.findByText("Starter")).closest("button");
  if (starterButton) fireEvent.click(starterButton);

  const duplicateButton = screen.getByRole("button", { name: /duplicar/i });
  await act(async () => {
    fireEvent.click(duplicateButton);
  });

  await waitFor(() => expect(api.adminDuplicatePlan).toHaveBeenCalledWith("plan-basic"));
  await waitFor(() => expect(api.adminListPlans).toHaveBeenCalledTimes(2));
});

test("exclui plano quando confirmado", async () => {
  const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
  await act(async () => {
    render(<PlansPage />);
  });
  const starterButton = (await screen.findByText("Starter")).closest("button");
  if (starterButton) fireEvent.click(starterButton);

  const deleteButton = screen.getByRole("button", { name: /excluir/i });
  await act(async () => {
    fireEvent.click(deleteButton);
  });

  await waitFor(() => expect(api.adminDeletePlan).toHaveBeenCalledWith("plan-basic"));
  await waitFor(() => expect(api.adminListPlans).toHaveBeenCalledTimes(2));
  confirmSpy.mockRestore();
});
