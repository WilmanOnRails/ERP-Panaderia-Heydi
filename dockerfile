# ==========================================
# 1. Etapa de dependencias (Install dependencies)
# ==========================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Instalar pnpm globalmente (según tu pnpm-lock.yaml)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de gestión de paquetes
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDependencies para compilar Prisma y Next.js)
RUN pnpm install --frozen-lockfile


# ==========================================
# 2. Etapa de compilación (Build application)
# ==========================================
FROM node:18-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar dependencias instaladas y código fuente
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar el cliente de Prisma (vital si usas Prisma ORM)
RUN npx prisma generate

# Desactivar la telemetría de Next.js durante el build (opcional)
ENV NEXT_TELEMETRY_DISABLED 1

# Compilar la aplicación para producción
RUN pnpm build


# ==========================================
# 3. Etapa de producción (Runner)
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Crear usuario y grupo con privilegios mínimos por seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos públicos y la build de Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar Prisma si tu backend realiza consultas directas en runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]