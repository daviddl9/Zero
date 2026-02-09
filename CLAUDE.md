# Zero Email - Project Instructions

## Raspberry Pi Network Architecture

Both Zero Email and Statement Parser run on a single Raspberry Pi, sharing one nginx reverse proxy but on **isolated Docker networks** with separate databases. Tailscale provides VPN access, Split DNS routes `*.dvhome.com` to the Pi, and nginx does hostname-based routing.

```
                         Tailscale Network
               ┌───────────────────────────────────┐
               │  MagicDNS: taile015d9.ts.net       │
               │  Split DNS: *.dvhome.com → Pi      │
               │  Pi Tailscale IP: 100.100.34.25    │
               └──────────────┬────────────────────┘
                              │
         ┌────────────────────┼────────────────────────┐
         │ email.dvhome.com   │   finances.dvhome.com  │
         │ mail.dvhome.com    │                        │
         │ raspberrypi.taile015d9.ts.net               │
         └────────────────────┼────────────────────────┘
                              ▼
            Raspberry Pi (host ports :80, :443)
   ┌───────────────────────────────────────────────────────┐
   │                                                       │
   │  ┌───────────────────────────────────────────────┐    │
   │  │  zero-nginx (:80, :443)                       │    │
   │  │  Config: nginx.tailscale.conf (in Zero repo)  │    │
   │  │                                               │    │
   │  │  Hostname Routing:                            │    │
   │  │  ┌─────────────────────┬────────────────────┐ │    │
   │  │  │ mail.dvhome (HTTPS) │ → Zero SPA+API    │─┼─┐  │
   │  │  │ email.dvhome        │ → 301 → mail.*    │ │ │  │
   │  │  │ *.ts.net (HTTPS)    │ → Zero SPA+API    │─┼─┤  │
   │  │  │ finances.dvhome /   │ → 172.17.0.1:3000 │─┼─┼─┐│
   │  │  │ finances /backend-  │ → 172.17.0.1:8000 │─┼─┼─┤│
   │  │  │  api/*  (strip pfx) │                    │ │ │ ││
   │  │  └─────────────────────┴────────────────────┘ │ │ ││
   │  └───────────────────────────────────────────────┘ │ ││
   │                                                    │ ││
   │  ┌─ zero-network ──────────────────────────┐       │ ││
   │  │                          ▲               │       │ ││
   │  │  zero-server (Node.js :8787) ◄──────────┼───────┘ ││
   │  │  zero-db (pgvector:pg17 :5432)          │         ││
   │  │    └─ database: zerodotemail            │         ││
   │  │  zero-valkey (redis:7 :6379)            │         ││
   │  │                                         │         ││
   │  │  S3 → 172.17.0.1:9000 ─────────────────┼──┐      ││
   │  └─────────────────────────────────────────┘  │      ││
   │                                               │      ││
   │  ┌─ statement-parser_default ──────────────┐  │      ││
   │  │                                         │  │      ││
   │  │  frontend (Next.js :3000) ◄─────────────┼──┼──────┘│
   │  │  api (FastAPI :8000)      ◄─────────────┼──┼───────┘
   │  │  worker (arq background jobs)           │  │
   │  │  db (postgres:16 :5432)                 │  │
   │  │    └─ database: statements              │  │
   │  │  redis (redis:7 :6379)                  │  │
   │  │  minio (:9000/:9001) ◄──── shared ──────┼──┘
   │  └─────────────────────────────────────────┘
   │
   └───────────────────────────────────────────────────────┘

Cross-network communication: via Docker bridge gateway 172.17.0.1
  - zero-nginx → statement-parser frontend/api (hostname routing)
  - zero-server → statement-parser minio (S3 storage)
```

### Domain Routing

| Domain | Protocol | Destination |
|--------|----------|-------------|
| `mail.dvhome.com` | HTTPS | Zero Email (SPA + API via upstream `server:8787`, mkcert cert) |
| `email.dvhome.com` | HTTP+HTTPS | 301 → `https://mail.dvhome.com` |
| `raspberrypi.taile015d9.ts.net` | HTTPS | Zero Email (Tailscale cert, fallback for devices without mkcert CA) |
| `finances.dvhome.com` | HTTP+HTTPS | Statement Parser (`/` → Next.js :3000, `/backend-api/*` → FastAPI :8000) |

### Containers & Networks

| Container | Image | Network | Port |
|-----------|-------|---------|------|
| `zero-nginx` | nginx:alpine | `zero-network` | :80, :443 (host) |
| `zero-server` | Node.js | `zero-network` | :8787 (internal) |
| `zero-db` | pgvector:pg17 | `zero-network` | :5432 (internal) |
| `zero-valkey` | redis:7-alpine | `zero-network` | :6379 (internal) |
| `statement-parser-frontend-pi` | Next.js | `statement-parser_default` | :3000 |
| `statement-parser-api-pi` | FastAPI | `statement-parser_default` | :8000 |
| `statement-parser-worker-pi` | arq | `statement-parser_default` | — |
| `statement-parser-db-pi` | postgres:16 | `statement-parser_default` | :5432 (internal) |
| `statement-parser-redis-pi` | redis:7 | `statement-parser_default` | :6379 (internal) |
| `statement-parser-minio-pi` | minio | `statement-parser_default` | :9000, :9001 |

### Shared Resources

- **MinIO (S3)**: Owned by Statement Parser. Zero Email accesses via Docker bridge `172.17.0.1:9000`.
- **Nginx config**: `nginx.tailscale.conf` in this repo controls routing for both services.

### Key Config Files

| File | Purpose |
|------|---------|
| `nginx.tailscale.conf` | Central nginx routing config for both services |
| `docker-compose.standalone.yaml` | Base Zero services definition |
| `docker-compose.pi.yaml` | Pi overrides (external MinIO, port change) |
| `docker-compose.tailscale.yaml` | HTTPS overlay (ports 80/443, Tailscale certs) |

## Self-Hosted Mode Debugging

When debugging the self-hosted/standalone deployment on Raspberry Pi, use these commands:

### SSH Access
```bash
ssh david@raspberrypi.taile015d9.ts.net
```

### Docker Container Management
```bash
# Check running containers
docker ps --format '{{.Names}}\t{{.Image}}'

# View server logs (most common)
docker logs zero-server --tail 100 2>&1

# Follow logs in real-time
docker logs zero-server -f --tail 20 2>&1

# Filter logs for specific errors
docker logs zero-server 2>&1 | grep -E 'error|Error|tRPC'

# Restart the server container
docker restart zero-server

# Stop and recreate container (loses copied files)
cd ~/apps/zero-email
docker compose -f docker-compose.standalone.yaml -f docker-compose.pi.yaml -f docker-compose.tailscale.yaml up -d server
```

### Hot-Patching Files (Without Rebuild)

Since Docker rebuilds are slow on Raspberry Pi, copy files directly to the running container:

```bash
# 1. Copy file from local machine to Pi
scp /path/to/local/file.ts david@raspberrypi.taile015d9.ts.net:~/temp-copy/

# 2. Copy from Pi to Docker container
docker cp ~/temp-copy/file.ts zero-server:/app/apps/server/src/path/to/file.ts

# 3. Restart container to pick up changes
docker restart zero-server
```

Common files to hot-patch:
- `apps/server/src/lib/server-utils.ts` - Core server utilities
- `apps/server/src/lib/standalone-agent.ts` - Standalone mode agent
- `apps/server/src/lib/driver/google.ts` - Gmail API driver
- `apps/server/src/trpc/routes/mail.ts` - Mail tRPC routes
- `apps/server/src/routes/autumn.ts` - Billing routes

### Testing Endpoints
```bash
# Test providers endpoint
curl -s "https://raspberrypi.taile015d9.ts.net/api/public/providers"

# Test auth endpoint
curl -s "https://raspberrypi.taile015d9.ts.net/api/auth/ok"

# Test tRPC endpoint
curl -s "https://raspberrypi.taile015d9.ts.net/api/trpc/settings.get"

# Test autumn/billing endpoint
curl -s -X POST "https://raspberrypi.taile015d9.ts.net/api/autumn/customers" -H "Content-Type: application/json" -d '{}'
```

### Check Environment Variables
```bash
docker exec zero-server env | grep -E 'COOKIE|BACKEND|GOOGLE|BETTER_AUTH'
```

### Check File Contents in Container
```bash
docker exec zero-server cat /app/apps/server/src/lib/standalone-agent.ts | head -50
```

### Database Commands
```bash
# Connect to PostgreSQL
docker exec zero-db psql -U postgres -d zerodotemail

# List all mail0_ tables
docker exec zero-db psql -U postgres -d zerodotemail -c "\dt mail0_*;"

# Check applied migrations
docker exec zero-db psql -U postgres -d zerodotemail -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"

# Run a SQL query
docker exec zero-db psql -U postgres -d zerodotemail -c "SELECT * FROM mail0_user LIMIT 5;"
```

### Running Migrations Manually
If migrations fail, you may need to create tables manually. Check migration files at:
`/app/apps/server/src/db/migrations/`

Example - creating missing skill table:
```sql
CREATE TABLE IF NOT EXISTS mail0_skill (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    connection_id text,
    name text NOT NULL,
    description text,
    content text NOT NULL,
    category text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT skill_user_id_name_unique UNIQUE(user_id, name)
);
```

## Common Issues & Fixes

### 1. "Shard registry is not available in standalone mode"
- **Cause**: Code calling Cloudflare Durable Objects in standalone mode
- **Fix**: Add `isSelfHostedMode()` checks and use `createStandaloneAgent()` instead

### 2. "This context has no ExecutionContext"
- **Cause**: Hono's `executionCtx` doesn't exist in Node.js mode
- **Fix**: Use `getExecutionContext()` and `safeWaitUntil()` helpers from server-utils.ts

### 3. "agent.stub.X is not a function"
- **Cause**: Method not on the correct object in standalone agent
- **Fix**: Ensure methods are directly on `stub` object, not nested

### 4. "he.decode is not a function"
- **Cause**: ESM import issue - `import * as he from 'he'` doesn't work
- **Fix**: Use `import he from 'he'` (default import)

### 5. Auto sign-out after login
- **Cause**: `useBilling` hook calls `signOut()` on any error from autumn/customers
- **Fix**: Return successful mock response from autumn routes when billing not configured

### 6. "relation mail0_X does not exist"
- **Cause**: Database migration failed or didn't run completely
- **Fix**: Manually create the missing table using the SQL from the migration file
- **Location**: Check `/app/apps/server/src/db/migrations/` for the relevant migration

## CI/CD Deployment to Raspberry Pi

The Raspberry Pi deployment is managed via GitHub Actions with a self-hosted runner.

### Deployment Workflow
- **Trigger**: Automatically on push to `main` branch, or manual dispatch
- **Workflow file**: `.github/workflows/deploy-pi.yml`
- **Runner**: `pi-runner` (self-hosted on the Raspberry Pi)

### Iterative Development Workflow

1. **Make changes locally** and test
2. **Commit and push to main**:
   ```bash
   git add <files>
   git commit -m "feat: description"
   git push origin main
   ```

3. **Check deployment status**:
   ```bash
   # List recent Pi deployment runs
   gh run list --limit 5 -R daviddl9/Zero --workflow=deploy-pi.yml

   # Watch a specific run
   gh run watch <run-id> -R daviddl9/Zero

   # View run logs
   gh run view <run-id> -R daviddl9/Zero --log
   ```

4. **Manually trigger deployment** (if auto-trigger fails):
   ```bash
   gh workflow run deploy-pi.yml -R daviddl9/Zero --ref main
   ```

5. **Check runner status**:
   ```bash
   gh api repos/daviddl9/Zero/actions/runners --jq '.runners[] | "\(.name)\t\(.status)\t\(.busy)"'
   ```

### Deployment Timeline
- Frontend changes (nginx rebuild): ~5-10 minutes
- Backend changes (server rebuild): ~15-25 minutes
- Full rebuild: ~25-30 minutes

### Post-Deployment Verification
After deployment completes, verify on the Pi:
```bash
# Check container health
ssh david@raspberrypi.taile015d9.ts.net "docker ps --format '{{.Names}}\t{{.Status}}'"

# Check server logs for errors
ssh david@raspberrypi.taile015d9.ts.net "docker logs zero-server --tail 50 2>&1 | grep -i error"

# Test the web app
# Open https://raspberrypi.taile015d9.ts.net in browser
```

## Verification Requirements

**All changes MUST be tested on the Raspberry Pi deployment** using the Chrome browser to ensure they work correctly in the self-hosted environment. The Cloudflare Workers environment behaves differently from Node.js standalone mode.

Test checklist:
1. Login with Google OAuth works
2. Session persists (no auto-logout)
3. Email list loads
4. Individual emails render
5. No console errors in browser
6. No tRPC errors in server logs
