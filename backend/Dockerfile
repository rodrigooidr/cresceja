# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependências úteis para hooks que usam git/ssh (se não precisar, pode remover)
RUN apk add --no-cache git openssh-client

# 1) Copia apenas os manifests (melhor cache)
COPY package*.json ./

# 2) Copia scripts antes do npm ci (necessário para pre/postinstall encontrarem os arquivos)
#    Se o seu backend NÃO tiver a pasta /scripts, remova a linha abaixo.
COPY scripts ./scripts

# 3) Instala dependências de produção, determinístico
ENV NODE_ENV=production
RUN npm ci --omit=dev --no-audit --no-fund

# 4) Copia o restante do código
COPY . .

# 5) Prepara pasta de uploads com permissão correta
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# 6) Usa usuário não-root para rodar o app
USER node

EXPOSE 4000

CMD ["node", "server.js"]
