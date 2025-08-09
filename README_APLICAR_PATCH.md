# Patch: Atualização do .env.example (backend)

Este patch atualiza o arquivo `backend/.env.example` com a `DATABASE_URL` correta para o seu Docker:

DATABASE_URL=postgres://cresceja:cresceja123@localhost:5432/cresceja_db

## Como aplicar
1. Extraia este zip na raiz do seu projeto (ele contém a pasta `backend/.env.example`).
2. No backend, rode:
   cp .env.example .env
3. Edite JWT_SECRET para um valor mais seguro.
4. Inicie o backend:
   npm run dev
