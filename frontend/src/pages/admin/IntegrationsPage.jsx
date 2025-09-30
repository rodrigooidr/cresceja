import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import AdminSplitPage from '@/ui/admin/AdminSplitPage';
import AdminSectionCard from '@/ui/admin/AdminSectionCard';
import AdminHeaderActions from '@/ui/admin/AdminHeaderActions';
import useToastFallback from '@/hooks/useToastFallback';
import {
  connectProvider,
  disconnectProvider,
  getAllStatus,
  subscribeProvider,
  testProvider,
} from '@/api/integrationsApi';

const PHONE_REGEX = /^\+?\d{10,15}$/;

const PROVIDER_CONFIG = {
  whatsapp_cloud: {
    label: 'WhatsApp Cloud',
    description: 'Conecte-se ao WhatsApp Business Cloud via Meta Developers.',
    defaultValues: {
      phone_number_id: '',
      wa_token: '',
      display_phone_number: '',
      test_to: '',
    },
    connectSchema: z.object({
      phone_number_id: z.string().nonempty('Phone Number ID é obrigatório'),
      wa_token: z.string().min(20, 'Token inválido'),
      display_phone_number: z.string().optional(),
    }),
    buildConnectPayload: (form) => ({
      phone_number_id: form.phone_number_id.trim(),
      wa_token: form.wa_token.trim(),
      display_phone_number: form.display_phone_number?.trim() || undefined,
    }),
    testSchema: z
      .object({
        to: z
          .string()
          .regex(PHONE_REGEX, 'Informe um telefone válido com DDI e DDD (ex.: +5541999999999)')
          .optional(),
      })
      .optional(),
    buildTestPayload: (form) => {
      const cleaned = form.test_to?.trim();
      return cleaned ? { to: cleaned } : {};
    },
    checklist: [
      {
        label: 'Criar app “WhatsApp Business” no Meta Developers.',
        done: (status) => status?.status === 'connected',
      },
      {
        label: 'Copiar Phone Number ID e Token de acesso.',
        done: (status) => Boolean(status?.meta?.phone_number_id),
      },
      {
        label: 'Colar no formulário e clicar em “Conectar”.',
        done: (status) => status?.status === 'connected',
      },
      {
        label: 'Clicar em “Assinar Webhooks” e confirmar que ficou “Assinado”.',
        done: (status) => Boolean(status?.subscribed),
      },
      {
        label: 'Clicar em “Testar” e enviar mensagem para um número seu.',
        done: (status) => Boolean(status?.meta?.last_test_at),
      },
    ],
    metaItems: (meta) => [
      { label: 'Phone Number ID', value: meta?.phone_number_id },
      { label: 'Telefone exibido', value: meta?.display_phone_number },
      { label: 'Empresa', value: meta?.business_name },
      { label: 'Último teste', value: formatMaybeDate(meta?.last_test_at) },
      { label: 'Assinado em', value: formatMaybeDate(meta?.last_subscribe_at) },
    ],
    prefillFromStatus: (current, status) => {
      if (!status) return current;
      const source = status.meta || {};
      let changed = false;
      const next = { ...current };
      if (!next.phone_number_id && source.phone_number_id) {
        next.phone_number_id = source.phone_number_id;
        changed = true;
      }
      if (!next.display_phone_number && source.display_phone_number) {
        next.display_phone_number = source.display_phone_number;
        changed = true;
      }
      return changed ? next : current;
    },
    fieldGroups: [
      {
        title: 'Credenciais',
        fields: [
          {
            name: 'phone_number_id',
            label: 'Phone Number ID',
            placeholder: 'ex.: 123456789012345',
            required: true,
          },
          {
            name: 'display_phone_number',
            label: 'Telefone exibido',
            placeholder: 'ex.: +55 41 99999-9999',
          },
          {
            name: 'wa_token',
            label: 'Token de acesso',
            type: 'password',
            required: true,
            placeholder: 'Copie do Meta Developers',
          },
        ],
      },
      {
        title: 'Teste rápido',
        fields: [
          {
            name: 'test_to',
            label: 'Número de teste',
            placeholder: 'ex.: +5541999999999',
          },
        ],
      },
    ],
  },
  whatsapp_session: {
    label: 'WhatsApp Session (Baileys)',
    description: 'Conecte um servidor de sessão (Baileys ou similar) para usar a API local.',
    defaultValues: {
      session_host: '',
      session_key: '',
      test_path: '/health',
    },
    connectSchema: z.object({
      session_host: z.string().url('Informe uma URL válida'),
      session_key: z.string().min(4, 'Chave obrigatória'),
    }),
    buildConnectPayload: (form) => ({
      session_host: form.session_host.trim(),
      session_key: form.session_key.trim(),
    }),
    testSchema: z
      .object({
        path: z.string().optional(),
      })
      .optional(),
    buildTestPayload: (form) => ({
      path: form.test_path?.trim() || undefined,
    }),
    checklist: [
      {
        label: 'Subir o servidor de sessão com URL pública.',
        done: (status) => Boolean(status?.meta?.session_host),
      },
      {
        label: 'Informar Session Host e Session Key e clicar em “Conectar”.',
        done: (status) => status?.status === 'connected',
      },
      {
        label: 'Assinar webhooks para receber eventos da sessão.',
        done: (status) => Boolean(status?.subscribed),
      },
      {
        label: 'Testar (ping/QR/status) para validar a sessão.',
        done: (status) => Boolean(status?.meta?.last_test_at),
      },
    ],
    metaItems: (meta) => [
      { label: 'Host da sessão', value: meta?.session_host },
      { label: 'Último teste', value: formatMaybeDate(meta?.last_test_at) },
      { label: 'Status teste', value: meta?.last_test_status },
    ],
    prefillFromStatus: (current, status) => {
      if (!status) return current;
      const meta = status.meta || {};
      if (!current.session_host && meta.session_host) {
        return { ...current, session_host: meta.session_host };
      }
      return current;
    },
    fieldGroups: [
      {
        title: 'Servidor',
        fields: [
          {
            name: 'session_host',
            label: 'Session Host',
            placeholder: 'ex.: https://session.example.com',
            required: true,
          },
          {
            name: 'session_key',
            label: 'Session Key',
            type: 'password',
            required: true,
          },
        ],
      },
      {
        title: 'Teste',
        fields: [
          {
            name: 'test_path',
            label: 'Endpoint de saúde',
            placeholder: '/health',
          },
        ],
      },
    ],
  },
  meta: {
    label: 'Facebook / Instagram (Meta)',
    description: 'Gerencie a autenticação via Meta para Facebook Pages e Instagram Business.',
    defaultValues: {
      page_id: '',
      page_name: '',
      instagram_business_account: '',
      user_access_token: '',
    },
    connectSchema: z
      .object({
        user_access_token: z.string().min(10, 'Token inválido').optional(),
        page_id: z.string().optional(),
        page_name: z.string().optional(),
        instagram_business_account: z.string().optional(),
      })
      .refine((data) => Object.values(data).some(Boolean), {
        message: 'Preencha ao menos um campo',
      }),
    buildConnectPayload: (form) => ({
      user_access_token: form.user_access_token?.trim() || undefined,
      page_id: form.page_id?.trim() || undefined,
      page_name: form.page_name?.trim() || undefined,
      instagram_business_account: form.instagram_business_account?.trim() || undefined,
    }),
    testSchema: z
      .object({
        simulate: z.boolean().optional(),
      })
      .optional(),
    buildTestPayload: () => ({ simulate: true }),
    checklist: [
      {
        label: 'Clique em “Conectar via Facebook” para iniciar o OAuth.',
        done: (status) => status?.status === 'connected',
      },
      {
        label: 'Escolha a Página e Instagram Business desejados.',
        done: (status) => Boolean(status?.meta?.page_id),
      },
      {
        label: 'Confirmar webhooks ativos para Página/Instagram.',
        done: (status) => Boolean(status?.subscribed),
      },
      {
        label: 'Testar listagem de páginas/postagens (mock).',
        done: (status) => Boolean(status?.meta?.last_test_at),
      },
    ],
    metaItems: (meta) => [
      { label: 'Página', value: meta?.page_name || meta?.page_id },
      {
        label: 'Instagram Business',
        value: meta?.instagram_business_account,
      },
      { label: 'Último teste', value: formatMaybeDate(meta?.last_test_at) },
      { label: 'Assinado em', value: formatMaybeDate(meta?.subscribed_at) },
    ],
    prefillFromStatus: (current, status) => {
      if (!status) return current;
      const meta = status.meta || {};
      let changed = false;
      const next = { ...current };
      if (!next.page_id && meta.page_id) {
        next.page_id = meta.page_id;
        changed = true;
      }
      if (!next.page_name && meta.page_name) {
        next.page_name = meta.page_name;
        changed = true;
      }
      if (!next.instagram_business_account && meta.instagram_business_account) {
        next.instagram_business_account = meta.instagram_business_account;
        changed = true;
      }
      return changed ? next : current;
    },
    fieldGroups: [
      {
        title: 'Credenciais Meta',
        fields: [
          {
            name: 'user_access_token',
            label: 'User Access Token',
            type: 'password',
            placeholder: 'Opcional (caso finalize OAuth no backend)',
          },
          {
            name: 'page_id',
            label: 'Page ID',
          },
          {
            name: 'page_name',
            label: 'Nome da página',
          },
          {
            name: 'instagram_business_account',
            label: 'Instagram Business ID',
          },
        ],
      },
    ],
  },
  google_calendar: {
    label: 'Google Calendar',
    description: 'Integre agendas do Google para agendamentos automáticos.',
    defaultValues: {
      code: '',
      access_token: '',
      refresh_token: '',
      expiry_date: '',
      account_email: '',
    },
    connectSchema: z
      .object({
        code: z.string().optional(),
        access_token: z.string().optional(),
        refresh_token: z.string().optional(),
        expiry_date: z.string().optional(),
        account_email: z.string().email('Informe um e-mail válido').optional(),
      })
      .refine((data) => !!data.code || (data.access_token && data.refresh_token), {
        message: 'Informe o code do OAuth ou access/refresh token',
      }),
    buildConnectPayload: (form) => ({
      code: form.code?.trim() || undefined,
      access_token: form.access_token?.trim() || undefined,
      refresh_token: form.refresh_token?.trim() || undefined,
      expiry_date: form.expiry_date?.trim() || undefined,
      account_email: form.account_email?.trim() || undefined,
    }),
    testSchema: z
      .object({
        calendar_id: z.string().optional(),
      })
      .optional(),
    buildTestPayload: () => ({ }),
    checklist: [
      {
        label: 'Clique em “Conectar via Google” e finalize o OAuth.',
        done: (status) => status?.status === 'connected',
      },
      {
        label: 'Escolha a conta da organização.',
        done: (status) => Boolean(status?.meta?.account_email),
      },
      {
        label: 'Confirmar webhook assinados.',
        done: (status) => Boolean(status?.subscribed),
      },
      {
        label: 'Executar teste criando evento temporário.',
        done: (status) => Boolean(status?.meta?.last_test_at),
      },
    ],
    metaItems: (meta) => [
      { label: 'Conta conectada', value: meta?.account_email },
      { label: 'Expira em', value: formatMaybeDate(meta?.expiry_date) },
      { label: 'Último refresh', value: formatMaybeDate(meta?.last_token_refresh) },
      { label: 'Último teste', value: formatMaybeDate(meta?.last_test_at) },
    ],
    prefillFromStatus: (current, status) => {
      if (!status) return current;
      const meta = status.meta || {};
      let changed = false;
      const next = { ...current };
      if (!next.account_email && meta.account_email) {
        next.account_email = meta.account_email;
        changed = true;
      }
      if (!next.expiry_date && meta.expiry_date) {
        next.expiry_date = meta.expiry_date;
        changed = true;
      }
      return changed ? next : current;
    },
    fieldGroups: [
      {
        title: 'Tokens',
        fields: [
          { name: 'code', label: 'Code (OAuth)', placeholder: 'Troca única' },
          { name: 'access_token', label: 'Access Token', type: 'password' },
          { name: 'refresh_token', label: 'Refresh Token', type: 'password' },
          { name: 'expiry_date', label: 'Expiry Date', placeholder: '2025-12-31T23:59:59Z' },
          { name: 'account_email', label: 'E-mail da conta' },
        ],
      },
    ],
  },
};

const PROVIDER_KEYS = Object.keys(PROVIDER_CONFIG);

function createInitialForms() {
  return PROVIDER_KEYS.reduce((acc, key) => {
    acc[key] = { ...PROVIDER_CONFIG[key].defaultValues };
    return acc;
  }, {});
}

function formatMaybeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleString('pt-BR');
  } catch {
    return date.toISOString();
  }
}

function sanitizePayload(payload) {
  return Object.entries(payload || {}).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    if (typeof value === 'string' && value.trim() === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function Checklist({ items, status }) {
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const done = item.done?.(status);
        return (
          <li key={idx} className="flex items-start gap-2">
            <span className={`mt-1 text-lg ${done ? 'text-green-600' : 'text-gray-400'}`}>
              {done ? '✅' : '⬜️'}
            </span>
            <span>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function MetaList({ metaItems }) {
  const filtered = metaItems.filter((item) => item.value);
  if (!filtered.length) return <p className="text-muted">Nenhum dado disponível ainda.</p>;
  return (
    <dl className="grid grid-cols-1 gap-y-2">
      {filtered.map((item) => (
        <div key={item.label} className="flex justify-between gap-4">
          <dt className="text-muted">{item.label}</dt>
          <dd className="text-right font-medium break-all">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusBadge({ status }) {
  const label = status?.status || 'desconhecido';
  const map = {
    connected: 'bg-green-100 text-green-700',
    disconnected: 'bg-gray-100 text-gray-700',
    error: 'bg-red-100 text-red-700',
  };
  const cls = map[label] || 'bg-gray-100 text-gray-700';
  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${cls}`}>{label}</span>;
}

function Sidebar({ active, setActive, statuses }) {
  return (
    <nav className="space-y-2">
      {PROVIDER_KEYS.map((key) => {
        const cfg = PROVIDER_CONFIG[key];
        const status = statuses[key];
        const state = status?.status === 'connected' ? 'bg-green-500' : status?.status === 'error' ? 'bg-red-500' : 'bg-gray-300';
        return (
          <button
            key={key}
            type="button"
            className={`w-full rounded-lg border px-3 py-2 text-left hover:border-primary ${
              active === key ? 'border-primary bg-primary/5' : 'border-gray-200'
            }`}
            onClick={() => setActive(key)}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${state}`} />
              <span className="font-medium">{cfg.label}</span>
            </div>
            <div className="text-xs text-muted">{cfg.description}</div>
          </button>
        );
      })}
    </nav>
  );
}

export default function IntegrationsPage() {
  const [forms, setForms] = useState(() => createInitialForms());
  const [formErrors, setFormErrors] = useState({});
  const [statuses, setStatuses] = useState({});
  const [active, setActive] = useState(PROVIDER_KEYS[0]);
  const [loadingMap, setLoadingMap] = useState({});
  const [loadingStatus, setLoadingStatus] = useState(false);
  const toast = useToastFallback();

  const activeConfig = PROVIDER_CONFIG[active];
  const activeStatus = statuses[active];

  const formState = forms[active] || {};
  const fieldErrors = formErrors[active] || {};

  const setLoading = (provider, action, value) => {
    const key = `${provider}:${action}`;
    setLoadingMap((prev) => ({ ...prev, [key]: value }));
  };

  const isLoading = (provider, action) => Boolean(loadingMap[`${provider}:${action}`]);

  const refreshStatus = async () => {
    try {
      setLoadingStatus(true);
      const data = await getAllStatus();
      const next = {};
      for (const item of data?.providers || []) {
        next[item.provider] = item;
      }
      setStatuses(next);
    } catch (err) {
      console.error(err);
      toast({ title: 'Falha ao carregar status das integrações.' });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    if (!Object.keys(statuses).length) return;
    setForms((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of PROVIDER_KEYS) {
        const cfg = PROVIDER_CONFIG[key];
        const status = statuses[key];
        if (cfg.prefillFromStatus) {
          const updated = cfg.prefillFromStatus(prev[key], status);
          if (updated !== prev[key]) {
            next[key] = updated;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [statuses]);

  const updateField = (provider, field, value) => {
    setForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const handleConnect = async () => {
    const cfg = activeConfig;
    if (!cfg) return;
    const payload = cfg.buildConnectPayload ? cfg.buildConnectPayload(formState) : formState;
    const cleaned = sanitizePayload(payload);
    const validation = cfg.connectSchema?.safeParse(cleaned) ?? { success: true, data: cleaned };
    if (!validation.success) {
      const errors = formatFieldErrors(validation.error);
      setFormErrors((prev) => ({ ...prev, [active]: errors }));
      toast({ title: 'Dados inválidos', description: 'Revise os campos destacados.' });
      return;
    }
    setFormErrors((prev) => ({ ...prev, [active]: {} }));
    setLoading(active, 'connect', true);
    try {
      await connectProvider(active, validation.data);
      toast({ title: `${cfg.label} conectado com sucesso.` });
      await refreshStatus();
    } catch (err) {
      console.error(err);
      toast({ title: 'Falha ao conectar integração.', description: err?.response?.data?.message || err.message });
    } finally {
      setLoading(active, 'connect', false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(active, 'subscribe', true);
    try {
      await subscribeProvider(active);
      toast({ title: 'Webhooks assinados com sucesso.' });
      await refreshStatus();
    } catch (err) {
      console.error(err);
      toast({ title: 'Falha ao assinar webhooks.', description: err?.response?.data?.message || err.message });
    } finally {
      setLoading(active, 'subscribe', false);
    }
  };

  const handleTest = async () => {
    const cfg = activeConfig;
    const payload = cfg.buildTestPayload ? cfg.buildTestPayload(formState) : {};
    const cleaned = sanitizePayload(payload);
    const validation = cfg.testSchema?.safeParse(cleaned) ?? { success: true, data: cleaned };
    if (!validation.success) {
      const errors = formatFieldErrors(validation.error);
      setFormErrors((prev) => ({ ...prev, [active]: { ...prev[active], ...errors } }));
      toast({ title: 'Dados inválidos para teste.' });
      return;
    }
    setLoading(active, 'test', true);
    try {
      const response = await testProvider(active, validation.data);
      const detail = response?.detail?.message || 'Teste executado.';
      toast({ title: detail });
      await refreshStatus();
    } catch (err) {
      console.error(err);
      toast({ title: 'Falha ao executar teste.', description: err?.response?.data?.message || err.message });
    } finally {
      setLoading(active, 'test', false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(active, 'disconnect', true);
    try {
      await disconnectProvider(active);
      toast({ title: 'Integração desconectada.' });
      await refreshStatus();
    } catch (err) {
      console.error(err);
      toast({ title: 'Falha ao desconectar.', description: err?.response?.data?.message || err.message });
    } finally {
      setLoading(active, 'disconnect', false);
    }
  };

  const disableActions = activeStatus?.status !== 'connected';
  const disableDisconnect = !activeStatus || activeStatus.status === 'disconnected';

  const sidebar = (
    <Sidebar active={active} setActive={setActive} statuses={statuses} />
  );

  return (
    <AdminSplitPage
      title="Integrações"
      sidebar={sidebar}
      actions={
        <AdminHeaderActions
          onNew={refreshStatus}
          saving={loadingStatus}
          labels={{ new: loadingStatus ? 'Atualizando…' : 'Atualizar status' }}
        />
      }
    >
      <AdminSectionCard
        title={activeConfig.label}
        subtitle={activeConfig.description}
        right={<StatusBadge status={activeStatus} />}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {activeConfig.fieldGroups.map((group) => (
              <div key={group.title} className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{group.title}</h3>
                {group.fields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label className="form-label">{field.label}</label>
                    <input
                      type={field.type || 'text'}
                      value={formState[field.name] ?? ''}
                      onChange={(e) => updateField(active, field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="form-control"
                    />
                    {fieldErrors[field.name] ? (
                      <small className="text-danger">{fieldErrors[field.name]}</small>
                    ) : field.required ? (
                      <small className="text-muted">Obrigatório.</small>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={isLoading(active, 'connect')}
              >
                {isLoading(active, 'connect') ? 'Conectando…' : 'Conectar / Atualizar'}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={handleSubscribe}
                disabled={disableActions || isLoading(active, 'subscribe')}
              >
                {isLoading(active, 'subscribe') ? 'Assinando…' : 'Assinar Webhooks'}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={handleTest}
                disabled={disableActions || isLoading(active, 'test')}
              >
                {isLoading(active, 'test') ? 'Testando…' : 'Testar'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDisconnect}
                disabled={disableDisconnect || isLoading(active, 'disconnect')}
              >
                {isLoading(active, 'disconnect') ? 'Removendo…' : 'Desconectar'}
              </button>
            </div>
            <div className="rounded-md bg-muted/20 p-3 text-sm text-muted">
              Nunca exibimos tokens sensíveis nesta tela. Use este painel apenas para credenciais públicas e feedbacks de status.
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Checklist passo-a-passo</h3>
              <Checklist items={activeConfig.checklist} status={activeStatus} />
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Status e metadados</h3>
              <MetaList metaItems={activeConfig.metaItems(activeStatus?.meta || {})} />
              <div className="mt-3 text-sm text-muted">
                Assinado em webhooks: {activeStatus?.subscribed ? 'Sim' : 'Não'}
              </div>
              {activeStatus?.updated_at ? (
                <div className="text-sm text-muted">Atualizado em {formatMaybeDate(activeStatus.updated_at)}</div>
              ) : null}
            </div>
          </div>
        </div>
      </AdminSectionCard>
    </AdminSplitPage>
  );
}

function formatFieldErrors(zodError) {
  const formatted = {};
  const fieldErrors = zodError?.flatten?.().fieldErrors || {};
  for (const [key, list] of Object.entries(fieldErrors)) {
    if (Array.isArray(list) && list.length) {
      formatted[key] = list[0];
    }
  }
  return formatted;
}
