# CresceJá Inbox Omnichannel (Frontend)

## Instalação
1. `npm install`
2. Crie um arquivo `.env` na raiz com (opcional):
   ```
   REACT_APP_API_BASE_URL=http://localhost:4000/api
   ```
   Se não definir, esse valor é usado como padrão.

3. `npm start`

## Build para produção
`npm run build`

## Comandos principais
- `npm test -- --coverage --silent` – executa a suíte com cobertura garantindo os thresholds de marketing.
- `npm run test:health` – roda o health check canário do Content Calendar.
- `npm run storybook` – inicia o Storybook em modo desenvolvimento (porta 6006).
- `npm run build-storybook` – gera o Storybook estático para produção.

## Governança & Logs
- Acesse `http://localhost:3000/settings/governanca` para abrir a página de Governança & Logs diretamente.
- No Content Calendar, o link “Governança & Logs” leva para a mesma rota quando executado fora de produção.

## Recursos
- Login JWT (Context API)
- Axios com interceptor para enviar token
- Inbox com filtros (nome, telefone, categoria)
- Diferenciação de canal (WhatsApp/Instagram/Facebook)
- TailwindCSS

## Feature gates
- Seção visível somente se `feature` estiver habilitada **e** `limit > 0` ou `-1`.
- Mapeamento `feature → limitKey` centralizado em `featureLimitMap`.
- APIs mock: usar `__setFeatures`, `__setLimits`.
- Rotas e Sidebar também obedecem ao gate.
