import AppRoutes from '@/routes/AppRoutes.jsx';
import { ROUTE_CONTRACT } from '@/routes/contract.js';

test('todas as rotas do contrato estão registradas', () => {
  const routes = (Array.isArray(AppRoutes) ? AppRoutes : AppRoutes.routes || []).map(
    (r) => r.path
  );
  for (const { path } of ROUTE_CONTRACT) {
    expect(routes).toContain(path);
  }
});
