import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import AdminSplitPage from '@/ui/admin/AdminSplitPage';
import AdminHeaderActions from '@/ui/admin/AdminHeaderActions';
import AdminSectionCard from '@/ui/admin/AdminSectionCard';
import {
  fetchAdminOrganization,
  fetchAdminOrganizations,
  createAdminOrganization,
  updateAdminOrganization,
  deleteAdminOrganization,
} from '@/api/admin/orgsApi';
import { useBrasilUtils } from '@/pages/admin/hooks/useBrasilUtils';

const phoneRegex = /^\+?\d{10,15}$/;
const slugRegex = /^[a-z0-9\-]+$/;

const orgSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  slug: z.string().min(2, 'Slug obrigatório').regex(slugRegex, 'Use letras minúsculas, números e hífen'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex, 'Telefone inválido').optional().or(z.literal('')),
  cnpj: z.string().regex(/^\d{14}$/u, 'CNPJ deve ter 14 dígitos').optional().or(z.literal('')),
  cep: z.string().regex(/^\d{8}$/u, 'CEP deve ter 8 dígitos').optional().or(z.literal('')),
  street: z.string().optional().or(z.literal('')),
  number: z.string().optional().or(z.literal('')),
  complement: z.string().optional().or(z.literal('')),
  neighborhood: z.string().optional().or(z.literal('')),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().length(2, 'UF deve ter 2 letras'),
  status: z.enum(['active', 'inactive']).default('active'),
  plan_name: z.string().optional().or(z.literal('')),
  plan_id: z.string().optional().or(z.literal('')),
  trial_ends_at: z.string().optional().or(z.literal('')),
});

const EMPTY_FORM = {
  name: '',
  slug: '',
  email: '',
  phone: '',
  cnpj: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  status: 'active',
  plan_name: '',
  plan_id: '',
  trial_ends_at: '',
};

const STATUS_FILTERS = [
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'all', label: 'Todas' },
];

function normalizePayload(values) {
  return {
    ...values,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    cnpj: values.cnpj ? values.cnpj.replace(/\D/g, '') : null,
    cep: values.cep ? values.cep.replace(/\D/g, '').slice(0, 8) : null,
    street: values.street?.trim() || null,
    number: values.number?.trim() || null,
    complement: values.complement?.trim() || null,
    neighborhood: values.neighborhood?.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim()?.toUpperCase() || null,
    plan_name: values.plan_name?.trim() || null,
    plan_id: values.plan_id?.trim() || null,
    trial_ends_at: values.trial_ends_at?.trim() || null,
  };
}

export default function OrganizationsPage() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
    watch,
  } = useForm({
    resolver: zodResolver(orgSchema),
    defaultValues: EMPTY_FORM,
  });

  const { lookupCep, lookupCnpj } = useBrasilUtils({ setValue });

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (!term) return true;
      const name = item.name?.toLowerCase() || '';
      const slug = item.slug?.toLowerCase() || '';
      return name.includes(term) || slug.includes(term);
    });
  }, [items, search]);

  const selectOrganization = useCallback(
    async (id) => {
      if (!id) return;
      setActiveId(id);
      try {
        const org = await fetchAdminOrganization(id);
        if (org) {
          reset({ ...EMPTY_FORM, ...org, state: org.state || '' });
        }
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Falha ao carregar organização.');
      }
    },
    [reset],
  );

  const loadOrganizations = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const list = await fetchAdminOrganizations({ status: statusFilter });
      setItems(list);
      if (!activeId && list.length) {
        selectOrganization(list[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Falha ao carregar organizações.');
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [activeId, selectOrganization, statusFilter]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  

  const onSave = useCallback(
    async (values) => {
      setSaving(true);
      setError('');
      try {
        const payload = normalizePayload(values);
        let saved;
        if (activeId) {
          saved = await updateAdminOrganization(activeId, payload);
        } else {
          saved = await createAdminOrganization(payload);
        }
        if (saved?.id) {
          setActiveId(saved.id);
          reset({ ...EMPTY_FORM, ...saved, state: saved.state || '' });
        }
        await loadOrganizations();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Falha ao salvar.');
      } finally {
        setSaving(false);
      }
    },
    [activeId, loadOrganizations, reset],
  );

  const onDelete = useCallback(async () => {
    if (!activeId) return;
    if (!window.confirm('Deseja excluir esta organização?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteAdminOrganization(activeId);
      reset(EMPTY_FORM);
      setActiveId(null);
      await loadOrganizations();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Falha ao excluir.');
    } finally {
      setSaving(false);
    }
  }, [activeId, loadOrganizations, reset]);

  const onNew = useCallback(() => {
    reset(EMPTY_FORM);
    setActiveId(null);
  }, [reset]);

  const onDuplicate = useCallback(() => {
    const current = watch();
    reset({ ...current, name: current.name ? `${current.name} (cópia)` : '', slug: '' });
    setActiveId(null);
  }, [reset, watch]);

  const sidebar = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn btn-sm ${statusFilter === option.value ? 'btn-primary' : 'btn-light'}`}
            onClick={() => setStatusFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        className="form-control"
        placeholder="Buscar por nome…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {error && <div className="alert alert-danger text-sm">{error}</div>}
      {loadingList && <div className="text-sm text-muted">Carregando…</div>}
      {!loadingList && filteredItems.length === 0 && (
        <div className="text-sm text-muted">Nenhuma organização encontrada.</div>
      )}
      <div className="space-y-1">
        {filteredItems.map((org) => {
          const isActive = org.id === activeId;
          return (
            <button
              key={org.id}
              type="button"
              className={`w-full rounded border px-3 py-2 text-left transition ${
                isActive ? 'border-primary bg-primary/10' : 'border-transparent hover:border-primary'
              }`}
              onClick={() => selectOrganization(org.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium leading-tight">{org.name || 'Sem nome'}</div>
                  <div className="text-xs text-muted">{org.slug || '—'}</div>
                </div>
                <span className={`badge ${org.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                  {org.status === 'active' ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <AdminSplitPage
      title="Organizações"
      actions={
        <AdminHeaderActions
          onNew={onNew}
          onDuplicate={onDuplicate}
          onSave={handleSubmit(onSave)}
          onDelete={onDelete}
          saving={saving}
        />
      }
      sidebar={sidebar}
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
        <AdminSectionCard title="Identificação" subtitle="Nome, slug e status da organização.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nome</label>
              <input {...register('name')} className="form-control" placeholder="Ex.: Cresceja" />
              {errors.name && <small className="text-danger">{errors.name.message}</small>}
            </div>
            <div>
              <label className="form-label">Slug</label>
              <input {...register('slug')} className="form-control" placeholder="ex.: cresceja" />
              {errors.slug && <small className="text-danger">{errors.slug.message}</small>}
            </div>
            <div>
              <label className="form-label">Status</label>
              <select {...register('status')} className="form-select">
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </select>
            </div>
            <div>
              <label className="form-label">CNPJ</label>
              <div className="flex gap-2">
                <input
                  {...register('cnpj')}
                  className="form-control"
                  maxLength={14}
                  placeholder="Somente números"
                  onBlur={lookupCnpj}
                />
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => lookupCnpj(watch('cnpj'))}
                >
                  Buscar
                </button>
              </div>
              {errors.cnpj && <small className="text-danger">{errors.cnpj.message}</small>}
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Contato" subtitle="E-mail e telefone.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">E-mail</label>
              <input {...register('email')} className="form-control" placeholder="contato@empresa.com.br" />
              {errors.email && <small className="text-danger">{errors.email.message}</small>}
            </div>
            <div>
              <label className="form-label">Telefone</label>
              <input {...register('phone')} className="form-control" placeholder="+5541999998888" />
              {errors.phone && <small className="text-danger">{errors.phone.message}</small>}
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Endereço" subtitle="CEP, cidade e UF.">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">CEP</label>
              <div className="flex gap-2">
                <input
                  {...register('cep')}
                  className="form-control"
                  maxLength={8}
                  placeholder="Somente números"
                  onBlur={lookupCep}
                />
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => lookupCep(watch('cep'))}
                >
                  Buscar
                </button>
              </div>
              {errors.cep && <small className="text-danger">{errors.cep.message}</small>}
            </div>
            <div>
              <label className="form-label">Cidade</label>
              <input {...register('city')} className="form-control" />
              {errors.city && <small className="text-danger">{errors.city.message}</small>}
            </div>
            <div>
              <label className="form-label">UF</label>
              <input {...register('state')} className="form-control" maxLength={2} />
              {errors.state && <small className="text-danger">{errors.state.message}</small>}
            </div>
            <div className="col-span-2">
              <label className="form-label">Rua</label>
              <input {...register('street')} className="form-control" />
            </div>
            <div>
              <label className="form-label">Número</label>
              <input {...register('number')} className="form-control" />
            </div>
            <div>
              <label className="form-label">Bairro</label>
              <input {...register('neighborhood')} className="form-control" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Complemento</label>
              <input {...register('complement')} className="form-control" />
            </div>
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Plano e trial" subtitle="Plano associado e período de testes.">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Plano (ID)</label>
              <input {...register('plan_id')} className="form-control" placeholder="plan_xpto" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Plano (nome)</label>
              <input {...register('plan_name')} className="form-control" placeholder="Nome do plano" />
            </div>
            <div>
              <label className="form-label">Trial até</label>
              <input {...register('trial_ends_at')} className="form-control" placeholder="2024-12-31" />
            </div>
          </div>
        </AdminSectionCard>

        <div className="flex justify-end gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </AdminSplitPage>
  );
}
