const sidebar = [
  {
    section: 'Inbox',
    items: [
      { label: 'Inbox', to: '/inbox', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'], perm: 'inbox:view' },
    ],
  },
  {
    section: 'CRM',
    items: [
      { label: 'Leads', to: '/app/crm/leads', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Pipeline', to: '/app/crm/pipeline', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Clients', to: '/app/crm/clients', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Onboarding', to: '/app/crm/onboarding', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'NPS', to: '/app/crm/nps', orgRoles: ['OrgAdmin', 'OrgOwner'] },
    ],
  },
  {
    section: 'Conteúdo',
    items: [
      {
        label: 'Studio',
        to: '/app/content/studio',
        orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'],
        feature: 'contentStudio',
      },
      {
        label: 'Calendário',
        to: '/marketing/calendar',
        orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'],
        perm: 'marketing:view',
      },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { label: 'Lists', to: '/app/marketing/lists', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Templates', to: '/app/marketing/templates', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Calendário de Conteúdo', to: '/app/marketing/calendar', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] },
      { label: 'Campaigns', to: '/app/marketing/campaigns', orgRoles: ['OrgAdmin', 'OrgOwner'] },
      { label: 'Automations', to: '/app/marketing/automations', orgRoles: ['OrgAdmin', 'OrgOwner'] },
    ],
  },
  {
    section: 'Calendários',
    items: [{ label: 'Calendários', to: '/app/calendars', orgRoles: ['OrgAgent', 'OrgAdmin', 'OrgOwner'] }],
  },
  {
    section: 'Relatórios',
    items: [{ label: 'Relatórios', to: '/app/reports', orgRoles: ['OrgAdmin', 'OrgOwner'] }],
  },
  {
    section: 'Governança',
    items: [
      { label: 'Governança & Logs', to: '/settings/governanca', orgRoles: ['OrgAdmin', 'OrgOwner'], perm: 'audit:view' },
      { label: 'Métricas', to: '/settings/governanca/metricas', orgRoles: ['OrgAdmin', 'OrgOwner'], perm: 'telemetry:view' },
    ],
  },
  {
    section: 'Configurações',
    items: [
      { label: 'Usuários', to: '/app/settings/users', orgRoles: ['OrgAdmin', 'OrgOwner'] },
      { label: 'Canais', to: '/app/settings/channels', orgRoles: ['OrgAdmin', 'OrgOwner'] },
      { label: 'Permissões', to: '/app/settings/permissions', orgRoles: ['OrgAdmin', 'OrgOwner'] },
      { label: 'Agenda & Serviços', to: '/settings/agenda', orgRoles: ['OrgAdmin', 'OrgOwner'], perm: 'settings:agenda' },
      {
        label: 'Meu Plano',
        to: '/settings/plan',
        orgRoles: ['OrgAdmin', 'OrgOwner'],
        globalRoles: ['SuperAdmin'],
      },
    ],
  },
];

export default sidebar;
