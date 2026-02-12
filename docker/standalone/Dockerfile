# Zero Email - Standalone Server Dockerfile
# Runs the Node.js server with BullMQ without Cloudflare Workers dependencies

FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install Bun runtime (before creating non-root user so it's globally available)
RUN apk add --no-cache bash curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    rm -rf /root/.bun

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zero

WORKDIR /app
RUN chown zero:nodejs /app

# Copy package files for dependency installation
COPY --chown=zero:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=zero:nodejs apps/server/package.json apps/server/
COPY --chown=zero:nodejs packages/ packages/
COPY --chown=zero:nodejs patches/ patches/

# Switch to non-root user before installing (files owned by zero from the start)
USER zero

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY --chown=zero:nodejs apps/server/ apps/server/
COPY --chown=zero:nodejs tsconfig.json ./

# Build the server (compile TypeScript to JavaScript with esbuild)
WORKDIR /app/apps/server
RUN pnpm run build:standalone

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider --quiet http://localhost:8787/health || exit 1

# Set environment
ENV NODE_ENV=production
ENV SELF_HOSTED=true
ENV STANDALONE=true

# Start the compiled standalone server with Bun (faster HTTP + startup than Node.js)
CMD ["bun", "dist/standalone.cjs"]
