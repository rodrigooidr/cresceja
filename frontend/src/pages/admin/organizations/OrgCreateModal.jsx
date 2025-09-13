import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import inboxApi from "../../../api/inboxApi";

const schema = z
  .object({
    name: z.string().min(1, "Obrigatório"),
    cnpj: z.string().min(1, "Obrigatório"),
    contact: z.string().min(1, "Obrigatório"),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: "Informe e-mail ou telefone",
    path: ["email"],
  });

export default function OrgCreateModal({ onClose, onCreated }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const [error, setError] = useState(null);

  const onSubmit = async (data) => {
    setError(null);
    try {
      await inboxApi.post("admin/orgs", data, { meta: { scope: "global" } });
      onCreated?.();
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Erro");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form
        className="bg-white p-6 rounded shadow-md space-y-2 w-96"
        onSubmit={handleSubmit(onSubmit)}
      >
        <h2 className="text-xl font-semibold mb-2">Nova organização</h2>
        <input
          className="input input-bordered w-full"
          placeholder="Razão social"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-red-600 text-sm">{errors.name.message}</p>
        )}
        <input
          className="input input-bordered w-full"
          placeholder="CNPJ"
          {...register("cnpj")}
        />
        {errors.cnpj && (
          <p className="text-red-600 text-sm">{errors.cnpj.message}</p>
        )}
        <input
          className="input input-bordered w-full"
          placeholder="Contato responsável"
          {...register("contact")}
        />
        {errors.contact && (
          <p className="text-red-600 text-sm">{errors.contact.message}</p>
        )}
        <input
          className="input input-bordered w-full"
          placeholder="E-mail"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-red-600 text-sm">{errors.email.message}</p>
        )}
        <input
          className="input input-bordered w-full"
          placeholder="Telefone"
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-red-600 text-sm">{errors.phone.message}</p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Criar
          </button>
        </div>
      </form>
    </div>
  );
}

