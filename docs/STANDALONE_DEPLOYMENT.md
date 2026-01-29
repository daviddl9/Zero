# Zero Email - Standalone Deployment Guide

This guide covers deploying Zero Email without Cloudflare Workers, using a pure Node.js architecture with BullMQ for job processing.

## Overview

The standalone deployment replaces Cloudflare-specific services with local equivalents:

| Cloudflare Service | Standalone Replacement |
|--------------------|----------------------|
| Workers (workerd) | Node.js + Hono |
| Workflows | BullMQ Jobs |
| Queues | BullMQ Queues |
| KV | Redis/Valkey |
| Durable Objects Storage | PostgreSQL |
| R2 | MinIO (S3-compatible) |
| Upstash Redis | Native ioredis |
| Cron Triggers | BullMQ Scheduler |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Zero Email Standalone                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Nginx     │───▶│  Node.js    │───▶│  PostgreSQL │        │
│  │  (Frontend) │    │   Server    │    │   (Data)    │        │
│  └─────────────┘    └──────┬──────┘    └─────────────┘        │
│                            │                                   │
│         ┌──────────────────┼──────────────────┐               │
│         │                  │                  │               │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌─────▼─────┐         │
│  │   Valkey    │    │   MinIO     │    │  BullMQ   │         │
│  │   (Redis)   │    │   (S3)      │    │  Workers  │         │
│  │ Native TCP  │    │  Threads    │    │           │         │
│  └─────────────┘    └─────────────┘    └───────────┘         │
│                                                               │
│  No HTTP proxy needed - direct native connections             │
└───────────────────────────────────────────────────────────────┘
```

## Raspberry Pi Quick Start (One-Line Setup)

For Raspberry Pi 4 (4GB+ recommended), run this single command to deploy Zero Email:

```bash
curl -fsSL https://raw.githubusercontent.com/Mail-0/Zero/staging/scripts/install-standalone.sh | bash
```

Or manually:

```bash
# Clone, configure, and start in one command
git clone https://github.com/Mail-0/Zero.git && cd Zero && \
cp .env.example .env && \
docker compose -f docker-compose.standalone.yaml up -d
```

After startup, access:
- **Web App**: http://your-pi-ip:3000
- **MinIO Console**: http://your-pi-ip:9001 (admin: minioadmin/minioadmin)
- **Job Queue UI**: http://your-pi-ip:3000/admin/queues

## Prerequisites

- Docker & Docker Compose (v2.0+)
- 4GB+ RAM (2GB minimum, but not recommended)
- 10GB+ disk space

### Raspberry Pi OS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Reboot to apply group changes
sudo reboot
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/Mail-0/Zero.git
cd Zero

# Copy and configure environment
cp .env.example .env
# Edit .env with your Google OAuth credentials (see below)

# Start the standalone stack
docker compose -f docker-compose.standalone.yaml up -d

# View logs
docker compose -f docker-compose.standalone.yaml logs -f server

# Check health
curl http://localhost:3000/health
```

### Local Development

```bash
# Install dependencies
pnpm install

# Start infrastructure only
docker compose -f docker-compose.standalone.yaml up -d db valkey minio

# Run the standalone server
cd apps/server
pnpm run start:standalone
```

## Configuration

### Environment Variables

#### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SELF_HOSTED` | Enable self-hosted mode | `true` |
| `STANDALONE` | Enable standalone mode | `true` |
| `PORT` | HTTP server port | `8787` |

#### Database

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@db:5432/zerodotemail` |
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `zerodotemail` |

#### Redis (Native - No HTTP Proxy)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis/Valkey host | `valkey` |
| `REDIS_PORT` | Redis/Valkey port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | - |

#### S3/MinIO Object Storage

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_ENDPOINT` | MinIO/S3 endpoint URL | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET` | Bucket for thread storage | `threads` |
| `S3_REGION` | S3 region | `us-east-1` |
| `MINIO_ROOT_USER` | MinIO admin username | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | `minioadmin` |

#### Job Queue

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_JOB_QUEUE` | Enable BullMQ job processing | `true` |
| `ENABLE_SCHEDULER` | Enable scheduled jobs | `true` |
| `WORKER_CONCURRENCY` | Number of concurrent job workers | `2` |

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Gmail API
4. Create OAuth 2.0 credentials
5. Set the redirect URI to `http://your-pi-ip:3000/api/auth/callback/google`
6. Add credentials to your `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://your-pi-ip:3000/api/auth/callback/google
```

## Resource Requirements

### Raspberry Pi 4 (4GB Model)

| Component | Memory | Status |
|-----------|--------|--------|
| Node.js Server | 512MB - 1GB | Required |
| PostgreSQL | 256-512MB | Required |
| Valkey (Redis) | 128-192MB | Required |
| MinIO | 256-512MB | Required |
| BullMQ Workers | 50-100MB | Included in Server |
| **Total** | ~1.5-2.3GB | OK for 4GB Pi |

### Recommended Specs

- **Minimum**: 2GB RAM, 2 CPU cores (limited functionality)
- **Recommended**: 4GB RAM, 4 CPU cores
- **Storage**: 10GB+ for database, logs, and email thread data

### Raspberry Pi Optimizations

The Docker Compose file includes memory limits optimized for Raspberry Pi:

```yaml
# Memory limits per service
server: 1GB max, 512MB reserved
db: 512MB max, 256MB reserved
valkey: 256MB max, 128MB reserved
minio: 512MB max, 256MB reserved
```

## Job Queue

The standalone server uses BullMQ for background job processing.

### Available Jobs

| Job Name | Description | Trigger |
|----------|-------------|---------|
| `sync-threads` | Sync Gmail threads for a connection | Pub/Sub webhook |
| `sync-coordinator` | Coordinate multi-page syncs | Pub/Sub webhook |
| `send-email` | Send an email | API request |
| `subscription-renewal` | Renew Gmail push subscriptions | Scheduler (every 5 days) |
| `process-scheduled-emails` | Queue scheduled emails for sending | Scheduler (every minute) |
| `cleanup-workflow-executions` | Clean up old workflow execution records | Scheduler (hourly) |

### Bull Board

Access the job queue admin UI at `/admin/queues` to:
- Monitor job progress
- View failed jobs
- Retry failed jobs
- Pause/resume queues

## Health Checks

The server provides a comprehensive health endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "mode": "standalone",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "redis": "healthy",
    "database": "healthy",
    "objectStorage": "healthy"
  }
}
```

## Admin Interfaces

| Interface | URL | Credentials |
|-----------|-----|-------------|
| Zero Email App | http://localhost:3000 | Google OAuth |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Bull Board | http://localhost:3000/admin/queues | None (secure in production!) |

## Troubleshooting

### Check Service Health

```bash
# Overall health
curl http://localhost:3000/health

# Individual services
docker compose -f docker-compose.standalone.yaml ps
docker compose -f docker-compose.standalone.yaml logs -f [service-name]
```

### Job Processing Issues

```bash
# Check job queue status
curl http://localhost:3000/api/admin/queue-stats

# View worker logs
docker compose -f docker-compose.standalone.yaml logs -f server
```

### Database Connection Issues

```bash
# Check database health
docker compose -f docker-compose.standalone.yaml exec db pg_isready -U postgres

# View database logs
docker compose -f docker-compose.standalone.yaml logs db
```

### Redis Connection Issues

```bash
# Check Redis health (direct connection, no proxy)
docker compose -f docker-compose.standalone.yaml exec valkey redis-cli ping

# View Redis logs
docker compose -f docker-compose.standalone.yaml logs valkey
```

### MinIO/S3 Issues

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Access MinIO console
open http://localhost:9001

# View MinIO logs
docker compose -f docker-compose.standalone.yaml logs minio
```

### Raspberry Pi Specific Issues

```bash
# Check system resources
free -h
df -h
htop

# Check Docker resource usage
docker stats

# Restart all services
docker compose -f docker-compose.standalone.yaml restart

# Full reset (WARNING: deletes all data)
docker compose -f docker-compose.standalone.yaml down -v
docker compose -f docker-compose.standalone.yaml up -d
```

## Security Considerations

### Production Checklist

1. **Change default secrets**:
   ```env
   BETTER_AUTH_SECRET=generate-a-strong-random-secret
   JWT_SECRET=generate-another-strong-secret
   POSTGRES_PASSWORD=strong-database-password
   MINIO_ROOT_USER=custom-admin-user
   MINIO_ROOT_PASSWORD=strong-minio-password
   ```

2. **Enable HTTPS** using a reverse proxy (Caddy recommended for auto-SSL):
   ```bash
   # Install Caddy
   sudo apt install caddy

   # Configure /etc/caddy/Caddyfile
   your-domain.com {
       reverse_proxy localhost:3000
   }
   ```

3. **Restrict admin access**:
   - Bull Board at `/admin/queues`
   - MinIO Console at port `9001`

4. **Firewall configuration**:
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```

## Scaling

### Horizontal Scaling (Multiple Workers)

For higher throughput, run dedicated worker containers:

```yaml
# Add to docker-compose.standalone.yaml
worker:
  build:
    context: .
    dockerfile: docker/standalone/Dockerfile
  environment:
    SELF_HOSTED: "true"
    STANDALONE: "true"
    WORKER_ONLY: "true"
    WORKER_CONCURRENCY: 4
    # ... other env vars
  depends_on:
    - valkey
    - db
    - minio
```

### Vertical Scaling

Increase worker concurrency for more parallel processing:

```env
WORKER_CONCURRENCY=4
```

## Files Reference

```
apps/server/
├── src/
│   ├── standalone.ts          # Standalone server entry point
│   └── lib/
│       ├── job-queue/         # BullMQ infrastructure
│       │   ├── index.ts       # Main exports
│       │   ├── queue.ts       # Queue initialization
│       │   ├── worker.ts      # Worker management
│       │   ├── scheduler.ts   # Scheduled jobs
│       │   └── jobs/          # Job implementations
│       ├── self-hosted/       # Cloudflare replacements
│       │   ├── kv-store.ts    # Redis-backed KV
│       │   ├── durable-storage.ts # PostgreSQL-backed storage
│       │   ├── object-store.ts    # S3/MinIO storage
│       │   └── redis-native.ts    # Native Redis client
│       └── thread-storage.ts  # Unified thread storage abstraction

docker/standalone/
└── Dockerfile                 # Standalone server container

docker-compose.standalone.yaml # Full standalone stack
nginx.standalone.conf          # Nginx configuration
```

## Support

For issues specific to standalone deployment, please open an issue with the `standalone` label.
