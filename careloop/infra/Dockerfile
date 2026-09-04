# Multi-stage production Dockerfile for CareLoop
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY backend/package*.json ./
RUN npm ci --only=production

# Production Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
# Copy backend source
COPY backend/ ./backend/
# Copy static frontend & shared assets
COPY patient-view/ ./patient-view/
COPY dashboard/ ./dashboard/
COPY shared/ ./shared/
COPY index.html ./index.html

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "backend/src/server.js"]
