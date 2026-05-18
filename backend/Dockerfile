# Base image
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar dependências (incluindo pacotes nativos para o Prisma caso necessário)
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera os arquivos do Prisma Client e compila o NestJS
RUN npx prisma generate
RUN npm run build

# Runner (Imagem de produção)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3001

# Adiciona o OpenSSL (necessário para o Prisma rodar no Alpine)
RUN apk add --no-cache openssl

# Copia os artefatos de build e as dependências
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3001

CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo \"DATABASE_URL não está definido no runtime\"; exit 1; fi; npx prisma migrate deploy && node dist/src/main.js"]
