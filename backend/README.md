# Backend

## Operações úteis

### Gerar um token JWT local

Use o mesmo `JWT_SECRET` configurado nos containers (por padrão `dev-change-me`). No diretório `backend/` execute:

```bash
node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({ sub: 'admin', scope: ['dev'] }, process.env.JWT_SECRET || 'dev-change-me', { expiresIn: '7d' }))"
```

O valor impresso pode ser usado nos testes manuais via `Authorization: Bearer <token>`.

### Limpar sessão no navegador

No console do DevTools execute:

```js
localStorage.removeItem('token');
localStorage.removeItem('authToken');
document.cookie = 'access_token=; Max-Age=0; path=/';
```

Isso força o app a pedir login novamente.

### Aplicar a migration de quotas manualmente

Caso o runner de migrations não esteja configurado, aplique direto no container PostgreSQL:

```bash
docker compose -p cresceja exec -T postgres \
  psql -U cresceja -d cresceja_db \
  -v "ON_ERROR_STOP=1" \
  -f /app/db/migrations/2025_10_07_quotas.sql
```

Ajuste o caminho do arquivo conforme o volume configurado.
