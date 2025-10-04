
import AppRoutes from '@/routes/AppRoutes';
import { ROUTE_CONTRACT } from '@/routes/contract';

describe('Contrato de Rotas', () => {
  test('todas as rotas do contrato estão registradas', () => {
    const list = Array.isArray(AppRoutes) ? AppRoutes : AppRoutes.routes || [];
    const paths = list.map((r) => r.path);
    for (const { path } of ROUTE_CONTRACT) {
      expect(paths).toContain(path);
    }
  });
});
