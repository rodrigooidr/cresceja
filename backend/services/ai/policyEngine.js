import guardPresets from './presets/guardrails.presets.json' with { type: 'json' };
import policyMessages from './presets/policy.messages.json' with { type: 'json' };

const DEFAULT_PRESET_KEY = 'estrito';

function resolveGuardPreset(presetKey = DEFAULT_PRESET_KEY) {
  if (presetKey && guardPresets[presetKey]) {
    return guardPresets[presetKey];
  }
  return guardPresets[DEFAULT_PRESET_KEY];
}

function resolveMessages(preset) {
  const messagesKey = preset?.messagesKey;
  if (messagesKey && policyMessages[messagesKey]) {
    return policyMessages[messagesKey];
  }
  return policyMessages['pt-BR'] || policyMessages.default || {};
}

function matchRule({ text, rule }) {
  if (!rule?.patterns?.length) return null;
  for (const pattern of rule.patterns) {
    const regex = new RegExp(pattern, 'i');
    const match = regex.exec(text);
    if (match) {
      const excerptWindow = rule.excerpts ?? 120;
      const start = Math.max(0, match.index - Math.floor(excerptWindow / 2));
      const end = Math.min(text.length, start + excerptWindow);
      return {
        type: rule.type,
        excerpt: text.slice(start, end).trim()
      };
    }
  }
  return null;
}

export function preCheck({ input = '', presetKey = DEFAULT_PRESET_KEY } = {}) {
  const guardPreset = resolveGuardPreset(presetKey);
  const text = typeof input === 'string' ? input : String(input ?? '');
  if (!text.trim()) {
    return { violation: null, guardPreset };
  }

  const messages = resolveMessages(guardPreset);
  for (const rule of guardPreset?.preCheck?.rules ?? []) {
    const result = matchRule({ text, rule });
    if (result) {
      return {
        violation: result.type,
        message: messages[result.type] || messages.default || null,
        guardPreset,
        excerpt: result.excerpt
      };
    }
  }

  return { violation: null, guardPreset };
}

export function postCheck({ output = '', guardPreset: providedGuardPreset } = {}) {
  const guardPreset = providedGuardPreset || resolveGuardPreset();
  const text = typeof output === 'string' ? output : String(output ?? '');
  if (!text.trim()) {
    return { violation: null, guardPreset };
  }

  const { maxChars, violationType = 'length' } = guardPreset?.postCheck || {};
  if (maxChars && text.length > maxChars) {
    const messages = resolveMessages(guardPreset);
    return {
      violation: violationType,
      message: messages[violationType] || messages.default || null,
      guardPreset,
      limit: maxChars,
      overflow: text.length - maxChars
    };
  }

  return { violation: null, guardPreset };
}

export function getGuardPreset(presetKey = DEFAULT_PRESET_KEY) {
  return resolveGuardPreset(presetKey);
}

export default {
  preCheck,
  postCheck,
  getGuardPreset
};
