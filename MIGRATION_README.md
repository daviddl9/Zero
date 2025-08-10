# Server Refactoring Migration Progress

## Overview
Splitting `apps/server` into two separate applications:
- `apps/server-api`: TRPC/Hono app for API routes and business logic
- `apps/server-worker`: Cloudflare Worker app for Cloudflare bindings only

## Migration Steps

### ✅ Completed Steps
1. Created migration tracking README
2. Set up new directory structure
3. Created server-worker app with Cloudflare bindings
4. Set up WorkerEntrypoint for internal APIs
5. Created server-api app with TRPC routes
6. Implemented service binding communication
7. Updated server-utils to call worker service

### 🔄 In Progress Steps
- [x] Update TRPC routes to use new server-utils
- [x] Copy remaining shared utilities and types
- [x] Fix remaining import/type issues
- [x] Create basic TRPC routes and Durable Object stubs
- [ ] Test local development setup
- [ ] Update package.json scripts

### ⏳ Pending Steps
- [ ] Update all TRPC routes to use service bindings
- [ ] Update package.json scripts
- [ ] Update frontend configuration
- [ ] Deployment and verification
- [ ] Remove old server app

## Architecture

### Current (Monolithic)
```
apps/server/
├── src/
│   ├── main.ts (Hono + TRPC + Durable Objects + Queues)
│   ├── trpc/ (API routes)
│   └── routes/ (HTTP routes)
└── wrangler.jsonc (All CF bindings)
```

### Target (Split)
```
apps/server-api/
├── src/
│   ├── main.ts (Hono + TRPC only)
│   ├── trpc/ (API routes)
│   └── routes/ (HTTP routes)
└── wrangler.jsonc (Service binding to worker)

apps/server-worker/
├── src/
│   ├── main.ts (Durable Objects + Queues + Scheduled tasks)
│   └── routes/agent/ (Durable Object implementations)
└── wrangler.jsonc (All CF bindings)
```

## Communication Pattern
- TRPC app calls Worker app via Cloudflare Service Bindings
- Worker app exposes WorkerEntrypoint with typed methods
- Zero-overhead communication, no HTTP calls needed

## Notes
- No authentication between services (to be added later)
- Speed is priority
- No backward compatibility needed
- Same Cloudflare account deployment
