# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# deps primeiro (cache)
COPY package*.json ./
RUN npm install --omit=dev

# código
COPY . .

# cria pasta persistente de uploads
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","server.js"]