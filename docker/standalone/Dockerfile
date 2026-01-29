# Zero Email - Standalone Server Dockerfile
# Runs the Node.js server with BullMQ without Cloudflare Workers dependencies

FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ========================================
# Build Stage
# ========================================
FROM base AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/ packages/
COPY patches/ patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/server/ apps/server/
COPY tsconfig.json ./

# Build the server (compile TypeScript)
# Note: For standalone mode, we run directly with tsx
# WORKDIR /app/apps/server
# RUN pnpm run build

# ========================================
# Production Stage
# ========================================
FROM base AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zero

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/

# Copy packages and patches (for workspace dependencies)
COPY --from=builder /app/packages packages/
COPY --from=builder /app/patches patches/

# Install all dependencies (tsx needed for start:standalone script)
# Skip postinstall which needs full workspace context
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy server source code
COPY --from=builder /app/apps/server/src apps/server/src
COPY --from=builder /app/apps/server/tsconfig.json apps/server/
COPY --from=builder /app/tsconfig.json ./

# Set ownership
RUN chown -R zero:nodejs /app

# Switch to non-root user
USER zero

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider --quiet http://localhost:8787/health || exit 1

# Set environment
ENV NODE_ENV=production
ENV SELF_HOSTED=true
ENV STANDALONE=true

# Start the standalone server
WORKDIR /app/apps/server
CMD ["pnpm", "run", "start:standalone"]
