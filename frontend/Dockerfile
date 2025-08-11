# syntax=docker/dockerfile:1.7

# -------- builder --------
FROM node:20-alpine AS builder
WORKDIR /app
ENV CI=true

# Copia APENAS os manifests do frontend (a partir da raiz do repo)
COPY frontend/package*.json ./
# Usa ci se existir lock; senão, install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copia o restante do código do frontend
COPY frontend/ ./
# CRA -> build; (se usar Vite, troque para "npm run build" que gera /dist)
RUN npm run build

# -------- runtime --------
FROM nginx:1.27-alpine AS runtime

# Config do Nginx (ficará visível pois o contexto é a raiz do repo)
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf

# Artefatos do frontend (CRA sai em /build; Vite seria /dist)
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
