# Calendar Reminders & No-Show

## Endpoints protegidos (RBAC)
- `POST /api/calendar/events/:id/remind` (orgAdmin, superAdmin)
- `POST /api/calendar/noshow/sweep` (orgAdmin, superAdmin, support)
- `GET /api/audit/logs` (orgAdmin, superAdmin)

Respostas e códigos:
- `200 { idempotent: false|true }` para remind
- `429 { error: "RATE_LIMIT", retryAfterSec }`
- `424 { error: "WHATSAPP_NOT_CONFIGURED" }`
- `403/401` conforme permissão/autenticação

## Idempotência
Lembretes são deduplicados por janela `REMIND_DEDUP_WINDOW_MIN` usando hash `sha256(eventId|channel|recipient|bucket)`.

## Cron de No-Show
Ative com `NOSHOW_SWEEP_CRON` (ex: `*/5 * * * *`). O serviço marca eventos `pending` cujo horário já passou + `NOSHOW_GRACE_MINUTES`.

## Auditoria
Ações registradas em `audit_logs`:
- `calendar.remind.sent` (payload: event_id, channel, recipient, provider_message_id)
- `calendar.no_show.sweep` (payload: ids, count, cron)

## Testes
Backend:

```
NODE_OPTIONS=--experimental-vm-modules npx jest --config backend/jest.config.cjs --runInBand
```

Frontend:

```
npx jest --config frontend/jest.config.cjs --runInBand
```

## Smoke manual
1. Dispare `POST /api/calendar/events/:id/remind` duas vezes < 10min → 2ª retorna `{ idempotent:true }`.
2. Veja a tabela de auditoria na página Governança.
3. Habilite o cron e verifique eventos marcados como `no_show`.
