# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependências para builds que precisem de git/ssh
RUN apk add --no-cache git openssh-client

# Copia apenas os manifests primeiro (melhor cache de build)
COPY package*.json ./

# Define ambiente e instala dependências de produção, de forma determinística
ENV NODE_ENV=production
RUN npm ci --omit=dev --no-audit --no-fund

# Copia o resto do código
COPY . .

# Cria pasta persistente de uploads
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Usa usuário não-root
USER node

EXPOSE 4000

# força sobrescrita do arquivo com a versão atual
COPY middleware/requireRole.js ./middleware/requireRole.js

CMD ["node", "server.js"]
