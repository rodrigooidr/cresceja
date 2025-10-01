// Reexporta o client e garante um alias de apiUrl compatível
import inboxApi, { API_BASE_URL } from './inboxApi';

// SEMPRE string (evita falhas em apiUrl.replace(...) nos testes)
export const apiUrl = typeof API_BASE_URL === 'string' ? API_BASE_URL : String(API_BASE_URL || '');

// Reexports usuais
export { default as inboxApi } from './inboxApi';
export * from './inboxApi';

// Default opcional (se algum teste fizer import default de '@/api')
export default inboxApi;
