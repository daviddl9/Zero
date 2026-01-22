# Technology Stack - Zero

## Frontend
- **Framework:** React Router v7 (configured for Cloudflare Workers)
- **Library:** React 19
- **Styling:** TailwindCSS v4 with Vite integration
- **UI Components:** Shadcn UI, Lucide React (icons), Framer Motion (animations)
- **State Management:** TanStack Query (React Query), Jotai
- **Type Safety:** TypeScript

## Backend
- **Runtime:** Cloudflare Workers
- **API Framework:** Hono
- **Communication:** tRPC (for type-safe client-server communication)
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL (Self-hosted or managed)
- **Task Management:** Cloudflare Durable Objects, R2 (storage)

## Authentication & Security
- **Provider:** Better Auth
- **External Integrations:** Google OAuth2 (Gmail/People API)
- **Encryption:** Autumn-js

## Tooling & Infrastructure
- **Package Manager:** pnpm
- **Monorepo:** Turborepo
- **Development:** Wrangler (Cloudflare CLI), Docker (for local DB)
- **Validation:** Zod
