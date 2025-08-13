# -------- builder --------
FROM node:20-alpine AS builder
WORKDIR /app

# Só manifests
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Só o código necessário pro build
COPY public ./public
COPY src ./src
# (se existirem)
COPY tailwind.config.js ./tailwind.config.js
COPY postcss.config.js ./postcss.config.js
# (se usar TS)
# COPY tsconfig.json ./tsconfig.json

# CRA: não tratar warnings como erro
RUN CI= npm run build

# -------- runtime --------
FROM nginx:1.27-alpine AS runtime
# A config do Nginx virá pelo bind-mount do compose
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
