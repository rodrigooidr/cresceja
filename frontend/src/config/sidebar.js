const sidebar = [
  {
    section: 'Inbox',
    items: [
      { label: 'Inbox', to: '/inbox', minRole: 'Agent', perm: 'inbox:view' }
    ]
  },
  {
    section: 'CRM',
    items: [
      { label: 'Leads', to: '/app/crm/leads', minRole: 'Agent' },
      { label: 'Pipeline', to: '/app/crm/pipeline', minRole: 'Agent' },
      { label: 'Clients', to: '/app/crm/clients', minRole: 'Agent' },
      { label: 'Onboarding', to: '/app/crm/onboarding', minRole: 'Agent' },
      { label: 'NPS', to: '/app/crm/nps', minRole: 'Manager' }
    ]
  },
  {
    section: 'Conteúdo',
    items: [
      { label: 'Studio', to: '/app/content/studio', minRole: 'Agent', feature: 'contentStudio' },
      {
        label: 'Calendário',
        to: '/marketing/calendar',
        minRole: 'Agent',
        perm: 'marketing:view',
      }
    ]
  },
  {
    section: 'Marketing',
    items: [
      { label: 'Lists', to: '/app/marketing/lists', minRole: 'Agent' },
      { label: 'Templates', to: '/app/marketing/templates', minRole: 'Agent' },
      { label: 'Calendário de Conteúdo', to: '/app/marketing/calendar', minRole: 'Agent' },
      { label: 'Campaigns', to: '/app/marketing/campaigns', minRole: 'Manager' },
      { label: 'Automations', to: '/app/marketing/automations', minRole: 'Manager' }
    ]
  },
  {
    section: 'Calendários',
    items: [
      { label: 'Calendários', to: '/app/calendars', minRole: 'Agent' }
    ]
  },
  {
    section: 'Relatórios',
    items: [
      { label: 'Relatórios', to: '/app/reports', minRole: 'Manager' }
    ]
  },
  {
    section: 'Governança',
    items: [
      { label: 'Governança & Logs', to: '/settings/governanca', minRole: 'Manager', perm: 'audit:view' },
      { label: 'Métricas', to: '/settings/governanca/metricas', minRole: 'Manager', perm: 'telemetry:view' },
    ],
  },
  {
    section: 'Configurações',
    items: [
      { label: 'Usuários', to: '/app/settings/users', minRole: 'Manager' },
      { label: 'Canais', to: '/app/settings/channels', minRole: 'Manager' },
      { label: 'Permissões', to: '/app/settings/permissions', minRole: 'Manager' },
      { label: 'Plano', to: '/app/settings/plan', minRole: 'OrgOwner' }
    ]
  },
  {
    section: 'Admin',
    items: [
      { label: 'Orgs', to: '/admin/orgs', minRole: 'Support' },
      { label: 'Billing', to: '/admin/billing', minRole: 'SuperAdmin' },
      { label: 'Support', to: '/admin/support', minRole: 'SuperAdmin' }
    ]
  }
];

export default sidebar;
