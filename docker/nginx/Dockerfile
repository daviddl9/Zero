# Zero Email - Nginx Frontend Build Dockerfile
# Builds the React Router frontend and serves it with Nginx

# ========================================
# Build Stage
# ========================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration and dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mail/package.json apps/mail/
COPY apps/server/package.json apps/server/
COPY packages/ packages/
COPY patches/ patches/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/mail/ apps/mail/
COPY apps/server/src apps/server/src
COPY apps/server/tsconfig.json apps/server/
COPY tsconfig.json ./

# Build arguments for environment variables
ARG VITE_PUBLIC_APP_URL
ARG VITE_PUBLIC_BACKEND_URL

# Set environment variables for build
ENV VITE_PUBLIC_APP_URL=${VITE_PUBLIC_APP_URL} \
    VITE_PUBLIC_BACKEND_URL=${VITE_PUBLIC_BACKEND_URL} \
    NODE_ENV=production

# Build the application
RUN cd apps/mail && pnpm run build

# ========================================
# Runner Stage
# ========================================
FROM nginx:alpine

# Copy nginx configuration (passed via volume or replaced)
# Default standalone configuration
COPY nginx.standalone.conf /etc/nginx/nginx.conf

# Copy built frontend from builder
COPY --from=builder /app/apps/mail/build/client /usr/share/nginx/html

# Pre-compress static assets for nginx gzip_static (zero CPU at serve time)
RUN find /usr/share/nginx/html/assets -type f \( -name "*.js" -o -name "*.css" -o -name "*.wasm" \) \
    -exec gzip -9 -k {} \;

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
