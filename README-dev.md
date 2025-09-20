# Notas de desenvolvimento

## Dependências pinadas

Este monorepo usa `npm` workspaces e substitui `libsignal-node`/`libsignal` para `@whiskeysockets/baileys` diretamente por um commit específico (`e81ecfc32eb74951d789ab37f7e341ab66d5fff1`).

O pin garante compatibilidade com os binários nativos utilizados em produção. Ao atualizar, valide manualmente e ajuste o commit aqui documentado.
