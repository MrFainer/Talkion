# Base image
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar dependências
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desabilita telemetria do Next.js durante o build
ENV NEXT_TELEMETRY_DISABLED 1

# Build da aplicação
RUN npm run build

# Runner (Imagem de produção)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Copia apenas os arquivos necessários para rodar a aplicação
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expõe a porta
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]
