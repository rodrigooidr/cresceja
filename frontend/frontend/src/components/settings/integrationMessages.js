import { getIntegrationDictionary } from '@/i18n/integrations.js';

const dictionary = getIntegrationDictionary();

export function getIntegrationMessages() {
  return dictionary;
}

export function resolveIntegrationError(error, fallbackKey) {
  const errors = dictionary.errors || {};
  const generic = errors.generic || 'Falha ao completar a ação. Tente novamente.';
  return error?.response?.data?.message || error?.message || errors[fallbackKey] || generic;
}

export function getToastMessages(providerKey) {
  return (dictionary.toasts && dictionary.toasts[providerKey]) || {};
}
