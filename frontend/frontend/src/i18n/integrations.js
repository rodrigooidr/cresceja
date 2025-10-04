import messages from './integrations.json';

export const DEFAULT_INTEGRATIONS_LOCALE = 'pt-BR';

export function getIntegrationDictionary(locale = DEFAULT_INTEGRATIONS_LOCALE) {
  return messages[locale] || messages[DEFAULT_INTEGRATIONS_LOCALE] || {};
}

export function translateIntegration(path, { locale = DEFAULT_INTEGRATIONS_LOCALE, fallback, vars } = {}) {
  const dictionary = getIntegrationDictionary(locale);
  const value = path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dictionary);
  if (typeof value === 'string') {
    if (!vars) return value;
    return value.replace(/{{\s*(\w+)\s*}}/g, (_match, token) => {
      if (Object.prototype.hasOwnProperty.call(vars, token)) {
        return String(vars[token]);
      }
      return '';
    });
  }
  return value !== undefined ? value : fallback;
}
