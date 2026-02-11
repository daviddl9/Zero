# Zero Email - Standalone Server Dockerfile
# Runs the Node.js server with BullMQ without Cloudflare Workers dependencies

FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ========================================
# Build & Run Stage (single stage for faster Pi builds)
# ========================================
FROM base AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zero

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

# Build the server (compile TypeScript to JavaScript with esbuild)
WORKDIR /app/apps/server
RUN pnpm run build:standalone

# Back to root for ownership
WORKDIR /app

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

# Start the compiled standalone server
WORKDIR /app/apps/server
CMD ["node", "dist/standalone.cjs"]
