import React from 'react';
import inboxApi from '../../../api/inboxApi';
import { OrgCreateFrontSchema } from '../../../validation/orgCreate.front';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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
            <div><label>CNPJ</label><input {...register('cnpj')} className="input input-bordered w-full"/><p className="text-error text-xs">{errors.cnpj?.message}</p></div>
            <div><label>Razão Social</label><input {...register('razao_social')} className="input input-bordered w-full"/></div>
            <div><label>Nome Fantasia</label><input {...register('nome_fantasia')} className="input input-bordered w-full"/></div>
            <div><label>IE</label><input {...register('ie')} className="input input-bordered w-full"/></div>
            <div><label>Site</label><input {...register('site')} className="input input-bordered w-full"/></div>
            <div><label>Status</label>
              <select {...register('status')} className="select select-bordered w-full">
                <option value="active">Ativa</option><option value="suspended">Suspensa</option><option value="canceled">Cancelada</option>
              </select>
            </div>
            <div><label>E-mail</label><input {...register('email')} className="input input-bordered w-full"/></div>
            <div><label>Telefone (+55...)</label><input {...register('phone_e164')} className="input input-bordered w-full"/></div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-3 gap-3">
            <div><label>CEP</label><input {...register('endereco.cep')} className="input input-bordered w-full"/></div>
            <div className="col-span-2"><label>Logradouro</label><input {...register('endereco.logradouro')} className="input input-bordered w-full"/></div>
            <div><label>Número</label><input {...register('endereco.numero')} className="input input-bordered w-full"/></div>
            <div><label>Complemento</label><input {...register('endereco.complemento')} className="input input-bordered w-full"/></div>
            <div><label>Bairro</label><input {...register('endereco.bairro')} className="input input-bordered w-full"/></div>
            <div><label>Cidade</label><input {...register('endereco.cidade')} className="input input-bordered w-full"/></div>
            <div><label>UF</label><input {...register('endereco.uf')} className="input input-bordered w-full"/></div>
          </div>

          {/* Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div><label>Nome do responsável</label><input {...register('responsavel.nome')} className="input input-bordered w-full"/></div>
            <div><label>CPF</label><input {...register('responsavel.cpf')} className="input input-bordered w-full"/></div>
            <div><label>Email</label><input {...register('responsavel.email')} className="input input-bordered w-full"/></div>
            <div><label>Telefone (+55...)</label><input {...register('responsavel.phone_e164')} className="input input-bordered w-full"/></div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={isSubmitting}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

