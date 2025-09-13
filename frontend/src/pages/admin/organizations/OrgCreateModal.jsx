import React from 'react';
import inboxApi from '../../../api/inboxApi';
import { OrgCreateFrontSchema } from '../../../validation/orgCreate.front';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import FormField from '../../../ui/form/FormField';

export default function OrgCreateModal({ open, onClose, onCreated }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(OrgCreateFrontSchema),
      defaultValues: {
        status: 'active',
        endereco: { country: 'BR', uf: 'SP' },
        ie_isento: false,
      },
    });

  const onSubmit = async (values) => {
    try {
      await inboxApi.post('admin/orgs', values, { meta: { scope: 'global' }});
      onCreated?.();
      onClose?.();
    } catch (e) {
      // 409 duplicata / 422 validação
    }
  };

  if (!open) return null;
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="font-semibold text-lg mb-3">Adicionar organização</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Empresa */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="CNPJ" name="cnpj" required error={errors.cnpj}>
              <input id="cnpj" {...register('cnpj')} className={`input input-bordered w-full ${errors.cnpj ? 'border-red-500' : ''}`} aria-invalid={errors.cnpj ? 'true' : 'false'} placeholder="00.000.000/0000-00" />
            </FormField>
            <FormField label="Razão Social" name="razao_social" required error={errors.razao_social}>
              <input id="razao_social" {...register('razao_social')} className={`input input-bordered w-full ${errors.razao_social ? 'border-red-500' : ''}`} aria-invalid={errors.razao_social ? 'true' : 'false'} />
            </FormField>
            <FormField label="Nome Fantasia" name="nome_fantasia" error={errors.nome_fantasia}>
              <input id="nome_fantasia" {...register('nome_fantasia')} className={`input input-bordered w-full ${errors.nome_fantasia ? 'border-red-500' : ''}`} aria-invalid={errors.nome_fantasia ? 'true' : 'false'} />
            </FormField>
            <FormField label="IE" name="ie" error={errors.ie}>
              <input id="ie" {...register('ie')} className={`input input-bordered w-full ${errors.ie ? 'border-red-500' : ''}`} aria-invalid={errors.ie ? 'true' : 'false'} />
            </FormField>
            <FormField label="Site" name="site" error={errors.site}>
              <input id="site" {...register('site')} className={`input input-bordered w-full ${errors.site ? 'border-red-500' : ''}`} aria-invalid={errors.site ? 'true' : 'false'} />
            </FormField>
            <FormField label="Status" name="status" required error={errors.status}>
              <select id="status" {...register('status')} className={`select select-bordered w-full ${errors.status ? 'border-red-500' : ''}`} aria-invalid={errors.status ? 'true' : 'false'}>
                <option value="active">Ativa</option>
                <option value="suspended">Suspensa</option>
                <option value="canceled">Cancelada</option>
              </select>
            </FormField>
            <FormField label="E-mail" name="email" error={errors.email}>
              <input id="email" {...register('email')} className={`input input-bordered w-full ${errors.email ? 'border-red-500' : ''}`} aria-invalid={errors.email ? 'true' : 'false'} />
            </FormField>
            <FormField label="Telefone (+55...)" name="phone_e164" error={errors.phone_e164}>
              <input id="phone_e164" {...register('phone_e164')} className={`input input-bordered w-full ${errors.phone_e164 ? 'border-red-500' : ''}`} aria-invalid={errors.phone_e164 ? 'true' : 'false'} />
            </FormField>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="CEP" name="endereco.cep" required error={errors.endereco?.cep}>
              <input id="endereco.cep" {...register('endereco.cep')} className={`input input-bordered w-full ${errors.endereco?.cep ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.cep ? 'true' : 'false'} />
            </FormField>
            <div className="col-span-2">
              <FormField label="Logradouro" name="endereco.logradouro" required error={errors.endereco?.logradouro}>
                <input id="endereco.logradouro" {...register('endereco.logradouro')} className={`input input-bordered w-full ${errors.endereco?.logradouro ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.logradouro ? 'true' : 'false'} />
              </FormField>
            </div>
            <FormField label="Número" name="endereco.numero" required error={errors.endereco?.numero}>
              <input id="endereco.numero" {...register('endereco.numero')} className={`input input-bordered w-full ${errors.endereco?.numero ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.numero ? 'true' : 'false'} />
            </FormField>
            <FormField label="Complemento" name="endereco.complemento" error={errors.endereco?.complemento}>
              <input id="endereco.complemento" {...register('endereco.complemento')} className={`input input-bordered w-full ${errors.endereco?.complemento ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.complemento ? 'true' : 'false'} />
            </FormField>
            <FormField label="Bairro" name="endereco.bairro" required error={errors.endereco?.bairro}>
              <input id="endereco.bairro" {...register('endereco.bairro')} className={`input input-bordered w-full ${errors.endereco?.bairro ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.bairro ? 'true' : 'false'} />
            </FormField>
            <FormField label="Cidade" name="endereco.cidade" required error={errors.endereco?.cidade}>
              <input id="endereco.cidade" {...register('endereco.cidade')} className={`input input-bordered w-full ${errors.endereco?.cidade ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.cidade ? 'true' : 'false'} />
            </FormField>
            <FormField label="UF" name="endereco.uf" required error={errors.endereco?.uf}>
              <input id="endereco.uf" {...register('endereco.uf')} className={`input input-bordered w-full ${errors.endereco?.uf ? 'border-red-500' : ''}`} aria-invalid={errors.endereco?.uf ? 'true' : 'false'} />
            </FormField>
          </div>

          {/* Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nome do responsável" name="responsavel.nome" required error={errors.responsavel?.nome}>
              <input id="responsavel.nome" {...register('responsavel.nome')} className={`input input-bordered w-full ${errors.responsavel?.nome ? 'border-red-500' : ''}`} aria-invalid={errors.responsavel?.nome ? 'true' : 'false'} />
            </FormField>
            <FormField label="CPF" name="responsavel.cpf" error={errors.responsavel?.cpf}>
              <input id="responsavel.cpf" {...register('responsavel.cpf')} className={`input input-bordered w-full ${errors.responsavel?.cpf ? 'border-red-500' : ''}`} aria-invalid={errors.responsavel?.cpf ? 'true' : 'false'} />
            </FormField>
            <FormField label="Email" name="responsavel.email" error={errors.responsavel?.email}>
              <input id="responsavel.email" {...register('responsavel.email')} className={`input input-bordered w-full ${errors.responsavel?.email ? 'border-red-500' : ''}`} aria-invalid={errors.responsavel?.email ? 'true' : 'false'} />
            </FormField>
            <FormField label="Telefone (+55...)" name="responsavel.phone_e164" error={errors.responsavel?.phone_e164}>
              <input id="responsavel.phone_e164" {...register('responsavel.phone_e164')} className={`input input-bordered w-full ${errors.responsavel?.phone_e164 ? 'border-red-500' : ''}`} aria-invalid={errors.responsavel?.phone_e164 ? 'true' : 'false'} />
            </FormField>
          </div>

          <div className="mt-4 flex justify-end">
            <button className="btn btn-secondary mr-2" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
