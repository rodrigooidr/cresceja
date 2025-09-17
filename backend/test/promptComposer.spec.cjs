/* eslint-disable no-undef */
let composeSystemPrompt;

beforeAll(async () => {
  ({ composeSystemPrompt } = await import('../services/ai/promptComposer.js'));
});

describe('composeSystemPrompt', () => {
  test('gera prompt com guardrails e contexto ativos', () => {
    const profile = {
      orgName: 'Clínica Aurora',
      vertical: 'Saúde Odontológica',
      languages: ['pt-BR', 'en-US'],
      businessHours: {
        timezone: 'America/Sao_Paulo',
        schedule: [
          { days: ['Seg', 'Ter'], open: '09:00', close: '18:00' },
          { days: ['Qua'], note: 'Atendimento remoto mediante agendamento.' },
          { days: ['Sab'], closed: true }
        ]
      },
      tools: [{ name: 'Agenda Inteligente', description: 'Gerencia consultas e confirmações.' }],
      guardrails: { custom: ['Nunca confirme procedimentos sem consultar o prontuário.'] },
      policies: { statements: ['Confirmar identidade antes de alterar agendamentos.'] },
      fewShot: [
        {
          user: 'Preciso remarcar minha consulta de limpeza.',
          assistant: 'Claro! Vou verificar as próximas datas disponíveis e já confirmo com você.'
        }
      ],
      context: [{ title: 'Campanha', body: 'Oferecer check-up anual sem aplicar descontos.' }]
    };

    const policy = {
      statements: ['Seguir protocolo LGPD e registrar consentimento.'],
      disclaimer: 'Jamais solicitar senhas ou códigos de verificação.'
    };

    const tools = [{ name: 'CRM', description: 'Histórico dos pacientes com consentimento.' }];
    const context = ['Lead VIP captado pelo Instagram.'];

    const { system, guardPreset } = composeSystemPrompt({
      profile,
      context,
      tools,
      policy,
      presetKey: 'estrito',
      nowISO: '2025-09-17T15:30:00.000Z',
      tz: 'America/Sao_Paulo'
    });

    expect(guardPreset).toMatchObject({ label: 'Guardrails estritos' });
    expect(system).toContain('Clínica Aurora');
    expect(system).toContain('Saúde Odontológica');
    expect(system).toContain('Guardrails ativos');
    expect(system).toContain('Ferramentas disponíveis');
    expect(system).toMatchSnapshot();
  });
});
