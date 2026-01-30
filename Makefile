.PHONY: backend frontend dev db-up db-down db-clean db-studio

# Run backend server (port 8787) - restarts db containers first
backend: db-down db-up
	pnpm run --filter=@zero/server dev

# Run frontend mail app (port 3000)
frontend:
	pnpm run --filter=@zero/mail dev

# Run both (uses turbo)
dev:
	pnpm run dev

# Database commands
db-up:
	pnpm docker:db:up

db-down:
	pnpm docker:db:down

db-clean:
	pnpm docker:db:clean

db-studio:
	pnpm db:studio
