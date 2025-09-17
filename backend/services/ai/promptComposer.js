import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { getGuardPreset } from './policyEngine.js';

const template = readFileSync(new URL('./presets/systemPrompt.base.txt', import.meta.url), 'utf8');

const DEFAULT_LANG = 'pt-BR';

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function renderBusinessHours(businessHours) {
  if (!businessHours) {
    return '- Não informado';
  }
  if (typeof businessHours === 'string') {
    return businessHours;
  }

  if (Array.isArray(businessHours)) {
    const rows = businessHours
      .map((slot) => {
        if (!slot) return null;
        const days = ensureArray(slot.days || slot.day)
          .map((d) => `${d}`.trim())
          .filter(Boolean)
          .join(' / ');
        const prefix = days ? `${days}: ` : '';
        if (slot.closed) {
          return `- ${prefix}fechado`;
        }
        if (slot.open && slot.close) {
          return `- ${prefix}${slot.open} - ${slot.close}`;
        }
        if (slot.note) {
          return `- ${prefix}${slot.note}`;
        }
        if (slot.text) {
          return `- ${slot.text}`;
        }
        return null;
      })
      .filter(Boolean);
    return rows.length ? rows.join('\n') : '- Não informado';
  }

  if (businessHours.weekly && typeof businessHours.weekly === 'object') {
    const rows = Object.entries(businessHours.weekly)
      .map(([day, slot]) => {
        if (!slot) return null;
        if (slot === 'closed' || slot.closed) {
          return `- ${day}: fechado`;
        }
        if (typeof slot === 'string') {
          return `- ${day}: ${slot}`;
        }
        if (slot.open && slot.close) {
          return `- ${day}: ${slot.open} - ${slot.close}`;
        }
        return null;
      })
      .filter(Boolean);
    return rows.length ? rows.join('\n') : '- Não informado';
  }

  return '- Não informado';
}

function renderList(items, { emptyMessage = '- Nenhum item configurado.' } = {}) {
  const list = ensureArray(items);
  if (!list.length) return emptyMessage;
  return list.map((item) => `- ${item}`).join('\n');
}

function renderTools(tools, extraTools) {
  const merged = [...ensureArray(tools), ...ensureArray(extraTools)];
  return merged.length ? merged.map((tool) => {
    if (typeof tool === 'string') return `- ${tool}`;
    if (!tool) return null;
    const name = tool.name || tool.key || 'Ferramenta';
    const description = tool.description || tool.purpose || '';
    return `- ${name}${description ? `: ${description}` : ''}`;
  }).filter(Boolean).join('\n') : '- Nenhuma ferramenta integrada no momento.';
}

function renderPolicies(profilePolicies, policy) {
  const statements = [
    ...ensureArray(profilePolicies?.statements || profilePolicies),
    ...ensureArray(policy?.statements),
    policy?.summary,
    profilePolicies?.summary,
    policy?.disclaimer,
    profilePolicies?.disclaimer
  ].filter(Boolean);
  return statements.length ? statements.map((line) => `- ${line}`).join('\n') : '- Seguir políticas padrão de atendimento e LGPD.';
}

function renderContext(contextItems, extraContext) {
  const merged = [...ensureArray(contextItems), ...ensureArray(extraContext)];
  if (!merged.length) return '- Sem contexto adicional fornecido.';
  return merged.map((item, idx) => {
    if (typeof item === 'string') {
      return `- ${item}`;
    }
    if (!item) return null;
    const title = item.title || item.heading || `Contexto ${idx + 1}`;
    const value = item.body || item.text || item.content || '';
    return `- ${title}: ${value}`.trim();
  }).filter(Boolean).join('\n');
}

function renderFewShot(samples) {
  const list = ensureArray(samples);
  if (!list.length) {
    return '- Sem exemplos adicionais.';
  }
  return list.map((sample, index) => {
    if (typeof sample === 'string') {
      return `Exemplo ${index + 1}:\n${sample}`;
    }
    const user = sample.user ?? sample.prompt ?? sample.input ?? 'Usuário';
    const assistant = sample.assistant ?? sample.output ?? sample.response ?? 'Assistente';
    return `Exemplo ${index + 1}:\nUsuário: ${user}\nAssistente: ${assistant}`;
  }).join('\n\n');
}

function replaceTokens(base, replacements) {
  return Object.entries(replacements).reduce((acc, [token, value]) => acc.replaceAll(`{{${token}}}`, value), base);
}

export function composeSystemPrompt({
  profile = {},
  context = [],
  tools = [],
  policy = {},
  presetKey,
  nowISO,
  tz
} = {}) {
  const guardPreset = getGuardPreset(presetKey || profile.guardPreset || profile.guardrails?.preset);
  const timezone = tz || profile.timezone || profile.businessHours?.timezone || 'UTC';
  const now = nowISO
    ? DateTime.fromISO(nowISO, { zone: timezone })
    : DateTime.now().setZone(timezone);
  const nowFormatted = now.isValid
    ? now.setLocale(profile.locale || DEFAULT_LANG).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
    : (nowISO || new Date().toISOString());

  const languages = ensureArray(profile.languages || profile.language)
    .map((lang) => lang.toString())
    .filter(Boolean)
    .join(', ');

  const guardrailBullets = renderList([
    ...(guardPreset?.guardrails || []),
    ...ensureArray(profile.guardrails?.custom || profile.guardrails?.notes)
  ], { emptyMessage: '- Guardrails padrão ativos.' });

  const replacements = {
    ORG_NAME: profile.orgName || profile.name || 'sua empresa',
    VERTICAL: profile.vertical || profile.segment || 'atendimento geral',
    LANGUAGES: languages || DEFAULT_LANG,
    NOW: nowFormatted,
    TIMEZONE: timezone,
    BUSINESS_HOURS: renderBusinessHours(profile.businessHours?.schedule || profile.businessHours?.slots || profile.businessHours || profile.schedule),
    TOOLS: renderTools(profile.tools, tools),
    POLICIES: renderPolicies(profile.policies, policy),
    GUARDRAILS: guardrailBullets,
    CONTEXT: renderContext(profile.context, context),
    FEW_SHOT: renderFewShot(profile.fewShot || profile.examples || policy?.fewShot)
  };

  const system = replaceTokens(template, replacements)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { system, guardPreset };
}

export default { composeSystemPrompt };
