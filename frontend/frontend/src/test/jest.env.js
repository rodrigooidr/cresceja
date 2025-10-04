// Garante uma base válida nos testes do CRA/Jest
process.env.REACT_APP_API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

// Se precisar, dá pra expor também no window
if (typeof window !== 'undefined') {
  window.__API_BASE_URL__ = window.__API_BASE_URL__ || 'http://localhost:4000';
}
