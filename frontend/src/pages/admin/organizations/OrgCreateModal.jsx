import React, { useState } from "react";
import validateCNPJ, { onlyDigits } from "../../../utils/br/validateCNPJ";

export default function OrgCreateModal({ open, onClose }) {
  const [form, setForm] = useState({ name: "", cnpj: "" });
  const [errors, setErrors] = useState({ name: "", cnpj: "" });

  if (!open) return null;

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
    if (name === "cnpj") {
      // validação “live” opcional: limpa erro enquanto digita
      if (errors.cnpj) setErrors((s) => ({ ...s, cnpj: "" }));
    }
  }

  function validate() {
    const next = { name: "", cnpj: "" };
    if (!form.name.trim()) next.name = "Nome é obrigatório";
    if (!validateCNPJ(form.cnpj)) next.cnpj = "CNPJ inválido";
    setErrors(next);
    return !next.name && !next.cnpj;
  }

  async function onSubmit(ev) {
    ev.preventDefault(); // evita HTML validation bloquear render do erro
    // validação síncrona garante que o teste não timeoute
    if (!validate()) return;
    // ...chamada à API real aqui, se necessário...
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="org-create-title">
      <form onSubmit={onSubmit} noValidate>
        <h2 id="org-create-title">Criar organização</h2>

        <div className="mb-4">
          <label htmlFor="orgName">Nome</label>
          <input
            id="orgName"
            name="name"
            value={form.name}
            onChange={onChange}
            aria-invalid={errors.name ? "true" : "false"}
          />
          {errors.name && (
            <p
              role="alert"
              data-testid="name-error"
              className="text-red-600"
            >
              {errors.name}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="cnpj">CNPJ</label>
          <input
            id="cnpj"
            name="cnpj"
            value={form.cnpj}
            onChange={onChange}
            inputMode="numeric"
            aria-invalid={errors.cnpj ? "true" : "false"}
            placeholder="00.000.000/0000-00"
          />
          {errors.cnpj && (
            <p
              role="alert"
              data-testid="cnpj-error"
              className="text-red-600"
            >
              {errors.cnpj}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit">Salvar</button>
        </div>
      </form>
    </div>
  );
}
