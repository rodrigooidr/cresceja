import { useEffect, useMemo, useState } from "react";
import { lookupCEP, lookupCNPJ, patchAdminOrg, postAdminOrg } from "@/api/inboxApi";
import { useAuth } from "@/contexts/AuthContext";
import { hasGlobalRole } from "@/auth/roles";
import {
  isValidCEP,
  isValidCNPJ,
  isValidUF,
} from "@/validation/br";
import {
  onlyDigits,
  formatCNPJ,
  formatCEP,
  formatCPF,
  isValidCPF,
  formatPhoneBR,
  toE164BR,
} from "@/utils/brMasks";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "canceled", label: "Cancelada" },
];

const WHATSAPP_MODES = [
  { value: "none", label: "Desligado" },
  { value: "baileys", label: "Baileys" },
];

const emptyForm = {
  name: "",
  slug: "",
  status: "active",
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  email: "",
  phone_e164: "",
  site: "",
  ie: "",
  ie_isento: false,
  endereco: {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    country: "BR",
  },
  responsavel: {
    nome: "",
    cpf: "",
    email: "",
    phone_e164: "",
  },
  whatsapp_baileys_enabled: false,
  whatsapp_mode: "none",
  whatsapp_baileys_status: "",
  whatsapp_baileys_phone: "",
};

const maskCnpj = (value) => formatCNPJ(value || "");
const maskCep = (value) => formatCEP(value || "");
const maskCpf = (value) => formatCPF(value || "");
const maskPhone = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = onlyDigits(raw);
    if (digits.startsWith("55") && digits.length > 2) {
      return formatPhoneBR(digits.slice(2));
    }
    return digits ? `+${digits}` : "";
  }
  return formatPhoneBR(raw);
};

function mapOrgToForm(org) {
  if (!org) return { ...emptyForm };
  return {
    ...emptyForm,
    name: org.name || org.razao_social || "",
    slug: org.slug || "",
    status: org.status || "active",
    cnpj: maskCnpj(org.cnpj || ""),
    razao_social: org.razao_social || "",
    nome_fantasia: org.nome_fantasia || "",
    email: org.email || "",
    phone_e164: maskPhone(org.phone_e164 || org.phone || ""),
    site: org.site || "",
    ie: org.ie || "",
    ie_isento: !!org.ie_isento,
    endereco: {
      cep: maskCep(org.cep || ""),
      logradouro: org.logradouro || "",
      numero: org.numero || "",
      complemento: org.complemento || "",
      bairro: org.bairro || "",
      cidade: org.cidade || "",
      uf: org.uf || "",
      country: org.country || "BR",
    },
    responsavel: {
      nome: org.resp_nome || "",
      cpf: maskCpf(org.resp_cpf || ""),
      email: org.resp_email || "",
      phone_e164: maskPhone(org.resp_phone_e164 || ""),
    },
    whatsapp_baileys_enabled: !!org.whatsapp_baileys_enabled,
    whatsapp_mode: org.whatsapp_mode || "none",
    whatsapp_baileys_status: org.whatsapp_baileys_status || "",
    whatsapp_baileys_phone: org.whatsapp_baileys_phone || "",
  };
}

function readError(errors, field) {
  return errors[field] || "";
}

export default function AdminOrgEditModal({ open, mode = "edit", org, onClose, onSaved }) {
  const { user } = useAuth();
  const canManageBaileys = hasGlobalRole(["SuperAdmin", "Support"], user);

  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cepLookupLoading, setCepLookupLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const isCreate = mode === "create";

  const setFieldError = (field, message) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    setForm(mapOrgToForm(org));
    setErrors({});
    setFeedback("");
    setGlobalError("");
    setCnpjLookupLoading(false);
    setCepLookupLoading(false);
  }, [open, org]);

  const statusOptions = useMemo(() => STATUS_OPTIONS, []);

  if (!open) return null;

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const setNestedField = (section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    const key = `${section}.${field}`;
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleInputChange = (field) => (event) => {
    setField(field, event.target.value);
  };

  const handleCheckboxChange = (field) => (event) => {
    setField(field, event.target.checked);
  };

  const handleAddressChange = (field) => (event) => {
    setNestedField("endereco", field, event.target.value);
  };

  const handleResponsavelChange = (field) => (event) => {
    setNestedField("responsavel", field, event.target.value);
  };

  const handleCnpjChange = (event) => {
    setField("cnpj", maskCnpj(event.target.value));
  };

  const handleCepChange = (event) => {
    setNestedField("endereco", "cep", maskCep(event.target.value));
  };

  const handleCpfChange = (event) => {
    setNestedField("responsavel", "cpf", maskCpf(event.target.value));
  };

  const handleCpfBlur = () => {
    const digits = onlyDigits(form.responsavel.cpf);
    if (!digits) {
      setFieldError("responsavel.cpf", "CPF inválido");
      return;
    }
    if (digits.length !== 11) {
      setFieldError("responsavel.cpf", "CPF deve ter 11 dígitos");
      return;
    }
    if (!isValidCPF(digits)) {
      setFieldError("responsavel.cpf", "CPF inválido");
      return;
    }
    clearFieldError("responsavel.cpf");
  };

  const handleCompanyPhoneChange = (event) => {
    setField("phone_e164", formatPhoneBR(event.target.value));
  };

  const handleCompanyPhoneBlur = () => {
    if (!form.phone_e164) {
      clearFieldError("phone_e164");
      return;
    }
    const normalized = toE164BR(form.phone_e164);
    if (!normalized) {
      setFieldError("phone_e164", "Telefone inválido");
    } else {
      clearFieldError("phone_e164");
    }
  };

  const handleResponsavelPhoneChange = (event) => {
    setNestedField("responsavel", "phone_e164", formatPhoneBR(event.target.value));
  };

  const handleResponsavelPhoneBlur = () => {
    if (!form.responsavel.phone_e164) {
      clearFieldError("responsavel.phone_e164");
      return;
    }
    const normalized = toE164BR(form.responsavel.phone_e164);
    if (!normalized) {
      setFieldError("responsavel.phone_e164", "Telefone inválido");
    } else {
      clearFieldError("responsavel.phone_e164");
    }
  };

  const applyCnpjData = (data) => {
    if (!data) return;
    setForm((prev) => {
      const next = { ...prev };
      if (data.cnpj) next.cnpj = maskCnpj(data.cnpj);
      if (data.razao_social && !prev.razao_social)
        next.razao_social = data.razao_social;
      if (data.nome_fantasia && !prev.nome_fantasia)
        next.nome_fantasia = data.nome_fantasia;
      if (data.email && !prev.email) next.email = data.email;

      const end = data.endereco || {};
      const currentEndereco = { ...prev.endereco };
      if (end.cep && !prev.endereco.cep) currentEndereco.cep = maskCep(end.cep);
      if (end.logradouro && !prev.endereco.logradouro)
        currentEndereco.logradouro = end.logradouro;
      if (end.bairro && !prev.endereco.bairro)
        currentEndereco.bairro = end.bairro;
      if (end.cidade && !prev.endereco.cidade)
        currentEndereco.cidade = end.cidade;
      if (end.uf && !prev.endereco.uf) currentEndereco.uf = end.uf;
      next.endereco = currentEndereco;

      return next;
    });
  };

  const applyCepData = (data) => {
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      endereco: {
        ...prev.endereco,
        cep: data.cep ? maskCep(data.cep) : prev.endereco.cep,
        logradouro: data.logradouro || prev.endereco.logradouro,
        bairro: data.bairro || prev.endereco.bairro,
        cidade: data.cidade || prev.endereco.cidade,
        uf: data.uf || prev.endereco.uf,
        country: data.country || prev.endereco.country || "BR",
      },
    }));
  };

  const handleCnpjBlur = async () => {
    const digits = onlyDigits(form.cnpj);
    if (!digits) return;
    if (digits.length !== 14) {
      setFieldError("cnpj", "CNPJ deve ter 14 dígitos");
      return;
    }
    if (!isValidCNPJ(digits)) {
      setFieldError("cnpj", "CNPJ inválido");
      return;
    }
    clearFieldError("cnpj");
    setCnpjLookupLoading(true);
    try {
      const data = await lookupCNPJ(digits);
      applyCnpjData(data);
      setFeedback("Dados do CNPJ preenchidos automaticamente.");
    } catch (err) {
      setFieldError("cnpj", "Não foi possível consultar CNPJ");
      const message = err?.response?.data?.error || err?.message || "";
      if (message) setGlobalError(message);
    } finally {
      setCnpjLookupLoading(false);
    }
  };

  const handleCepBlur = async () => {
    const digits = onlyDigits(form.endereco.cep);
    if (!digits) return;
    if (digits.length !== 8) {
      setFieldError("endereco.cep", "CEP deve ter 8 dígitos");
      return;
    }
    if (!isValidCEP(digits)) {
      setFieldError("endereco.cep", "CEP inválido");
      return;
    }
    clearFieldError("endereco.cep");
    setCepLookupLoading(true);
    try {
      const data = await lookupCEP(digits);
      applyCepData(data);
    } catch (err) {
      setFieldError("endereco.cep", "Não foi possível consultar CEP");
      const message = err?.response?.data?.error || err?.message || "";
      if (message) setGlobalError(message);
    } finally {
      setCepLookupLoading(false);
    }
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Nome é obrigatório";

    const cnpjDigits = onlyDigits(form.cnpj);
    if (!cnpjDigits || cnpjDigits.length !== 14)
      nextErrors.cnpj = "CNPJ deve ter 14 dígitos";
    else if (!isValidCNPJ(cnpjDigits)) nextErrors.cnpj = "CNPJ inválido";

    if (!form.responsavel.nome.trim())
      nextErrors["responsavel.nome"] = "Informe o nome do responsável";

    const cpfDigits = onlyDigits(form.responsavel.cpf);
    if (!cpfDigits || cpfDigits.length !== 11)
      nextErrors["responsavel.cpf"] = "CPF deve ter 11 dígitos";
    else if (!isValidCPF(cpfDigits))
      nextErrors["responsavel.cpf"] = "CPF inválido";

    const cepDigits = onlyDigits(form.endereco.cep);
    if (!cepDigits || cepDigits.length !== 8)
      nextErrors["endereco.cep"] = "CEP inválido";
    else if (!isValidCEP(cepDigits)) nextErrors["endereco.cep"] = "CEP inválido";

    if (!form.endereco.logradouro.trim())
      nextErrors["endereco.logradouro"] = "Logradouro obrigatório";
    if (!form.endereco.numero.trim()) nextErrors["endereco.numero"] = "Número obrigatório";
    if (!form.endereco.bairro.trim()) nextErrors["endereco.bairro"] = "Bairro obrigatório";
    if (!form.endereco.cidade.trim()) nextErrors["endereco.cidade"] = "Cidade obrigatória";
    if (!form.endereco.uf.trim() || !isValidUF(form.endereco.uf))
      nextErrors["endereco.uf"] = "UF inválida";

    const orgPhoneE164 = form.phone_e164 ? toE164BR(form.phone_e164) : null;
    if (form.phone_e164 && !orgPhoneE164)
      nextErrors.phone_e164 = "Telefone inválido";

    const respPhoneE164 = form.responsavel.phone_e164
      ? toE164BR(form.responsavel.phone_e164)
      : null;
    if (form.responsavel.phone_e164 && !respPhoneE164)
      nextErrors["responsavel.phone_e164"] = "Telefone inválido";

    if (!form.email && !orgPhoneE164)
      nextErrors.email = "Informe e-mail ou telefone da empresa";

    if (!form.responsavel.email && !respPhoneE164)
      nextErrors["responsavel.email"] = "Responsável: informe e-mail ou telefone";

    if (form.whatsapp_baileys_enabled && !form.whatsapp_baileys_phone)
      nextErrors.whatsapp_baileys_phone = "Informe o telefone do WhatsApp";

    setErrors(nextErrors);
    return {
      valid: Object.keys(nextErrors).length === 0,
      orgPhoneE164,
      respPhoneE164,
    };
  };

  const buildCreatePayload = ({ orgPhoneE164, respPhoneE164 }) => {
    const cnpjDigits = onlyDigits(form.cnpj);
    const cepDigits = onlyDigits(form.endereco.cep);
    const cpfDigits = onlyDigits(form.responsavel.cpf);
    return {
      cnpj: cnpjDigits,
      razao_social: form.razao_social || form.name,
      nome_fantasia: form.nome_fantasia || form.name,
      ie: form.ie || null,
      ie_isento: !!form.ie_isento,
      site: form.site || null,
      email: form.email || null,
      phone_e164: orgPhoneE164 || null,
      status: form.status || "active",
      endereco: {
        cep: cepDigits,
        logradouro: form.endereco.logradouro,
        numero: form.endereco.numero,
        complemento: form.endereco.complemento || null,
        bairro: form.endereco.bairro,
        cidade: form.endereco.cidade,
        uf: form.endereco.uf.toUpperCase(),
        country: form.endereco.country || "BR",
      },
      responsavel: {
        nome: form.responsavel.nome,
        cpf: cpfDigits,
        email: form.responsavel.email || null,
        phone_e164: respPhoneE164 || null,
      },
    };
  };

  const buildUpdatePayload = ({ orgPhoneE164, respPhoneE164 }) => {
    const cepDigits = onlyDigits(form.endereco.cep);
    const cpfDigits = onlyDigits(form.responsavel.cpf);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      status: form.status,
      email: form.email || null,
      phone_e164: orgPhoneE164 || null,
      razao_social: form.razao_social || null,
      nome_fantasia: form.nome_fantasia || null,
      site: form.site || null,
      ie: form.ie || null,
      ie_isento: !!form.ie_isento,
      cep: cepDigits || null,
      logradouro: form.endereco.logradouro || null,
      numero: form.endereco.numero || null,
      complemento: form.endereco.complemento || null,
      bairro: form.endereco.bairro || null,
      cidade: form.endereco.cidade || null,
      uf: form.endereco.uf ? form.endereco.uf.toUpperCase() : null,
      country: form.endereco.country || "BR",
      resp_nome: form.responsavel.nome || null,
      resp_cpf: cpfDigits || null,
      resp_email: form.responsavel.email || null,
      resp_phone_e164: respPhoneE164 || null,
    };

    if (canManageBaileys) {
      payload.whatsapp_baileys_enabled = !!form.whatsapp_baileys_enabled;
      payload.whatsapp_mode = form.whatsapp_mode || "none";
      payload.whatsapp_baileys_status = form.whatsapp_baileys_status || null;
      payload.whatsapp_baileys_phone = form.whatsapp_baileys_phone || null;
    }

    return payload;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setFeedback("");
    setGlobalError("");
    const { valid, orgPhoneE164, respPhoneE164 } = validateForm();
    if (!valid) return;

    setSaving(true);
    try {
      if (isCreate) {
        const payload = buildCreatePayload({ orgPhoneE164, respPhoneE164 });
        const response = await postAdminOrg(payload);
        const createdId = response?.id || null;
        setFeedback("Organização criada com sucesso.");
        onSaved?.({ id: createdId });
      } else if (org?.id) {
        const payload = buildUpdatePayload({ orgPhoneE164, respPhoneE164 });
        await patchAdminOrg(org.id, payload);
        setFeedback("Organização atualizada.");
        onSaved?.();
      }
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Falha ao salvar.";
      setGlobalError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isCreate ? "Nova organização" : "Editar organização"}
            </h2>
            {!isCreate && org?.name && <p className="text-sm text-gray-500">{org.name}</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-gray-500 hover:text-gray-700"
            disabled={saving}
          >
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
          {globalError && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{globalError}</div>
          )}
          {feedback && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div>
          )}

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Dados básicos</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-gray-600">Nome</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.name}
                  onChange={handleInputChange("name")}
                  required
                />
                {readError(errors, "name") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "name")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Slug</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.slug}
                  onChange={handleInputChange("slug")}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Status</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.status}
                  onChange={handleInputChange("status")}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Empresa</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-gray-600">CNPJ</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.cnpj}
                  onChange={handleCnpjChange}
                  onBlur={handleCnpjBlur}
                  placeholder="00.000.000/0000-00"
                />
                {cnpjLookupLoading && (
                  <span className="mt-1 block text-xs text-gray-500">Buscando dados…</span>
                )}
                {readError(errors, "cnpj") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "cnpj")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Razão social</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.razao_social}
                  onChange={handleInputChange("razao_social")}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Nome fantasia</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.nome_fantasia}
                  onChange={handleInputChange("nome_fantasia")}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Site</span>
                <input
                  type="url"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.site}
                  onChange={handleInputChange("site")}
                  placeholder="https://"
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">E-mail</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.email}
                  onChange={handleInputChange("email")}
                />
                {readError(errors, "email") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "email")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Telefone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.phone_e164}
                  onChange={handleCompanyPhoneChange}
                  onBlur={handleCompanyPhoneBlur}
                  placeholder="(11) 99999-9999"
                />
                {readError(errors, "phone_e164") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "phone_e164")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Inscrição estadual</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.ie}
                  onChange={handleInputChange("ie")}
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.ie_isento}
                  onChange={handleCheckboxChange("ie_isento")}
                  className="h-4 w-4"
                />
                IE isento
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Endereço</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-gray-600">CEP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.cep}
                  onChange={handleCepChange}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                />
                {cepLookupLoading && (
                  <span className="mt-1 block text-xs text-gray-500">Carregando endereço…</span>
                )}
                {readError(errors, "endereco.cep") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.cep")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Logradouro</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.logradouro}
                  onChange={handleAddressChange("logradouro")}
                />
                {readError(errors, "endereco.logradouro") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.logradouro")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Número</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.numero}
                  onChange={handleAddressChange("numero")}
                />
                {readError(errors, "endereco.numero") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.numero")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Complemento</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.complemento}
                  onChange={handleAddressChange("complemento")}
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Bairro</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.bairro}
                  onChange={handleAddressChange("bairro")}
                />
                {readError(errors, "endereco.bairro") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.bairro")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Cidade</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.cidade}
                  onChange={handleAddressChange("cidade")}
                />
                {readError(errors, "endereco.cidade") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.cidade")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">UF</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.endereco.uf}
                  onChange={handleAddressChange("uf")}
                  placeholder="SP"
                  maxLength={2}
                />
                {readError(errors, "endereco.uf") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "endereco.uf")}</span>
                )}
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Responsável</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-gray-600">Nome</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.responsavel.nome}
                  onChange={handleResponsavelChange("nome")}
                />
                {readError(errors, "responsavel.nome") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "responsavel.nome")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">CPF</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.responsavel.cpf}
                  onChange={handleCpfChange}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                />
                {readError(errors, "responsavel.cpf") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "responsavel.cpf")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">E-mail</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.responsavel.email}
                  onChange={handleResponsavelChange("email")}
                />
                {readError(errors, "responsavel.email") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "responsavel.email")}</span>
                )}
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Telefone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.responsavel.phone_e164}
                  onChange={handleResponsavelPhoneChange}
                  onBlur={handleResponsavelPhoneBlur}
                  placeholder="(11) 99999-9999"
                />
                {readError(errors, "responsavel.phone_e164") && (
                  <span className="mt-1 block text-xs text-red-600">{readError(errors, "responsavel.phone_e164")}</span>
                )}
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">WhatsApp (Baileys)</h3>
              {!canManageBaileys && (
                <span className="text-xs text-gray-400">Apenas leitura</span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.whatsapp_baileys_enabled}
                  onChange={handleCheckboxChange("whatsapp_baileys_enabled")}
                  disabled={!canManageBaileys}
                  className="h-4 w-4"
                />
                Habilitar WhatsApp (Baileys)
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Modo</span>
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.whatsapp_mode}
                  onChange={handleInputChange("whatsapp_mode")}
                  disabled={!canManageBaileys}
                >
                  {WHATSAPP_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-gray-600">Status</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.whatsapp_baileys_status}
                  onChange={handleInputChange("whatsapp_baileys_status")}
                  readOnly={!canManageBaileys}
                />
              </label>
              {form.whatsapp_baileys_enabled && (
                <label className="text-sm md:col-span-2">
                  <span className="text-gray-600">Telefone (E.164)</span>
                  <input
                    type="tel"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.whatsapp_baileys_phone}
                    onChange={handleInputChange("whatsapp_baileys_phone")}
                    readOnly={!canManageBaileys}
                    placeholder="+5511999999999"
                  />
                  {readError(errors, "whatsapp_baileys_phone") && (
                    <span className="mt-1 block text-xs text-red-600">{readError(errors, "whatsapp_baileys_phone")}</span>
                  )}
                </label>
              )}
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-300"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
