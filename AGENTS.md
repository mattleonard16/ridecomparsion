# Repository Guidelines

## General Rules

- **Early development, no users. No backwards compatibility concerns.**
  - Do things RIGHT: clean, organized, zero tech debt. Never create compatibility shims.

- **WE NEVER WANT WORKAROUNDS. We always want FULL implementations that are long term sustainable for many >1000 users. So don't come up with half baked solutions.**

- **Important: Do not remove, hide, or rename any existing features or UI options (even temporarily) unless explicitly asked for it.**
  - If something isn't fully wired yet, keep the UX surface intact and stub/annotate it instead of deleting it.

## Project Structure & Module Organization
- `app/`: Next.js App Router entry point (`layout.tsx`, `page.tsx`), feature routes under `auth/`, `dashboard/`, `demo/`, and API handlers in `api/*/route.ts` (including optional cron endpoints in `api/cron/*/route.ts`).
- `components/`: Shared UI, forms, and map widgets; prefer reusing primitives in `components/ui/`.
- `lib/` and `types/`: Utility helpers, API clients, and shared TypeScript contracts. ETL jobs live in `lib/etl/` (e.g., `weather-cron.ts` for the weather cron endpoint).
- `prisma/`: `schema.prisma` and migration history; generates the Prisma Client consumed via `@/auth` and data services.
- `scripts/`: Operational tasks such as `fetch-quotes.ts`, `seed.ts`, and `create-test-user.ts`; run with `tsx scripts/<script-name>.ts`.
- `__tests__/`: Jest + React Testing Library specs with fixtures in `__tests__/fixtures/`; assets live in `public/`.

## Build, Test, and Development Commands
- **Node version**: Use Node.js 20 (specified in `.nvmrc`); run `nvm use` if using nvm.
- `npm run dev` (or `dev:https`): Start the dev server at :3000; HTTPS variant for service-worker/PWA testing.
- `npm run build`: Generate Prisma client then compile Next.js; `npm start` serves the production build.
- Quality gates: `npm run lint`, `lint:fix`, `format`, `format:check`, `typecheck`, or run all via `npm run quality`.
- Tests: `npm test` for one-off runs, `npm run test:watch` for TDD loops.
- Data/DB: `npm run db:migrate` (local dev), `db:deploy` (prod), `db:generate`, `db:studio`, `npm run seed`, and `npm run fetch:quotes`.
- Scripts: Run utility scripts with `tsx scripts/<script-name>.ts` (e.g., `tsx scripts/create-test-user.ts` for test user creation).
- Docker: `docker compose up -d` (full stack) or `docker compose up -d db` for database-only; use `docker compose up --build -d` for production builds.

## Coding Style & Naming Conventions
- TypeScript-first with `strict` mode; keep components functional and typed at the boundary.
- Use Prettier defaults (2-space indent, single quotes where applicable) and `next lint` for rules; alias imports with `@/`.
- Components/contexts/hooks use `PascalCase`/`camelCase`/`use*`; API routes live in `app/api/<name>/route.ts`.
- Co-locate styles via Tailwind utility classes; favor existing UI primitives before adding new ones.

## Testing Guidelines
- Frameworks: Jest with `jest-environment-jsdom` and React Testing Library (`jest.setup.ts`).
- File naming: `*.test.ts(x)` in `__tests__/...`; share sample payloads in `__tests__/fixtures`.
- Prefer behavioral tests over snapshots; mock network calls and Prisma where possible; validate loading/error/empty states.
- Run `npm run quality` before opening a PR; keep coverage near feature parity when adding routes or components.

## Commit & Pull Request Guidelines
- Commits follow the existing style: concise, imperative subject lines (e.g., `Fix Vercel build: Add Prisma generate to build process`); keep scopes small.
- PRs should include: summary of changes, linked issue/story, screenshots for UI updates, notes on migrations/seeds/env vars, and test/quality command results.
- Highlight any new scripts or config toggles; request review early if a Prisma migration is involved.

## Security & Configuration
- Copy env keys from `ENV_EXAMPLE.md` into `.env.local` (local) or `.env` (Docker); never commit secrets.
- Use `SETUP_SUPABASE.md` and `SECURITY.md` for data-handling expectations; rotate credentials after sharing and prefer Supabase/NextAuth secrets via env.
- Clear sensitive console output/logs before committing and avoid embedding API tokens in test fixtures.
- **Cron jobs (optional)**: Cron endpoints exist but are opt-in and require manual setup:
  - Weather job: `app/api/cron/weather/route.ts` uses `lib/etl/weather-cron.ts`; ready for Vercel Cron but requires `OPENWEATHER_API_KEY` and `CRON_SECRET` env vars.
  - Events endpoint: `app/api/cron/events/route.ts` is a mock placeholder until a real events API is integrated.
  - No schedules are committed (`vercel.json` is empty); to enable in production, add Vercel Cron configuration and required env vars.
