# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20-alpine

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Copy only package files for better layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for build)
# Using cache mount to speed up rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    npx prisma generate

# ============================================
# Stage 2: Builder
# ============================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/lib/generated ./lib/generated

# Copy source code
COPY . .

# Build the application (standalone output enabled in next.config.mjs)
RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed for production
# Public assets
COPY --from=builder /app/public ./public

# Standalone build output (includes minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client for database operations
COPY --from=builder --chown=nextjs:nodejs /app/lib/generated ./lib/generated
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# Standalone server doesn't need npm, runs directly with node
CMD ["node", "server.js"]

