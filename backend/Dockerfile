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

EXPOSE 3001

# O comando inicia o servidor compilado. 
# Nota: Você pode precisar rodar `npx prisma migrate deploy` no Coolify (Pre-deploy command) antes de iniciar.
CMD ["npm", "run", "start:prod"]
