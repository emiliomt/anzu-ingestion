# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

AnzuIngestion is a multi-channel invoice ingestion platform (Next.js 14 + Prisma + PostgreSQL + Redis/BullMQ). See `README.md` for full description.

### Required Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL 16 | `sudo docker start postgres` (or create: `sudo docker run -d --name postgres -e POSTGRES_USER=anzu -e POSTGRES_PASSWORD=anzupassword -e POSTGRES_DB=anzuingestion -p 5432:5432 postgres:16-alpine`) | 5432 |
| Redis 7 | `sudo docker start redis` (or create: `sudo docker run -d --name redis -p 6379:6379 redis:7-alpine`) | 6379 |
| Next.js dev server | `npm run dev` | 3000 |

Docker daemon must be running first: `sudo dockerd &>/dev/null &` (wait ~3s before using docker commands).

### Environment Setup

- Copy `.env.example` to `.env` and configure. The default `DATABASE_URL` and `REDIS_URL` work with the Docker containers above.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must be a valid-format Clerk key (e.g. `pk_test_<base64>`) for the middleware to initialize. Without valid Clerk keys, the server routes return 200 but browser pages redirect to a non-existent Clerk domain. The admin dashboard at `/admin` requires real Clerk auth.
- Despite references to `ANTHROPIC_API_KEY` in docs and `.env.example`, the actual extraction pipeline in `src/lib/claude.ts` uses **OpenAI exclusively** (GPT-4o for OCR, GPT-4o-mini for structured extraction). `OPENAI_API_KEY` is what matters for extraction to work.
- For **PDF** uploads, the code uses OpenAI's Files API (`files.create` with purpose `user_data`) which requires the `api.files.write` scope on the OpenAI key. If the key lacks this scope, PDF extraction fails but **image** uploads (PNG/JPG) work fine via base64 inline.
- `ANTHROPIC_API_KEY` is accepted by the environment but not used by runtime code as of this writing.

### Key Commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Generate Prisma client | `npx prisma generate` |
| Push DB schema | `npm run db:push` |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| DB studio | `npm run db:studio` |

### Gotchas

- The `.eslintrc.json` file is required for `npm run lint` and `npm run build` to work non-interactively. Without it, Next.js prompts for ESLint configuration interactively.
- The ESLint config must include `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` because the codebase uses `eslint-disable` comments referencing `@typescript-eslint` rules. These are added as devDependencies.
- Several pre-existing lint warnings exist (unused vars, `no-explicit-any`, `no-img-element`). These are downgraded to warnings in `.eslintrc.json` so the build passes.
- Public routes (no auth needed): `/`, `/portal`, `/pricing`, `/status/*`, `/demo/*`, `/api/upload`, `/api/health`, `/api/status/*`, `/api/webhooks/*`.
- The `anzu-security/` Python microservice is optional and only needed for SAT EFOS blacklist checking.
- Port 3000 conflicts: if a previous dev server wasn't cleanly stopped, Next.js auto-picks port 3001. Kill the stale process first.
