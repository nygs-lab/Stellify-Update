# Stellify

A comprehensive church management and discipleship tracking web app for **Jesus the Most Precious Name Church (Press Church)**. Members log in with PCM/TCM IDs, track spiritual habits, share the Gospel, and rise through four Stellar Status levels.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/stellify run dev` — run the Stellify frontend (port 24265)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + wouter
- API: Express 5 + bcryptjs (session auth)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (members, spiritual-habits, personal-habits, sharing-habits, church-hub)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, members, profile, habits, church, stellarboard, ministry, admin)
- `artifacts/stellify/src/pages/` — React pages (home, login, profile, stellarboard, disciple/*, church, ministry, admin, settings)
- `artifacts/stellify/src/hooks/use-auth.tsx` — Auth context (token in localStorage `stellify_token`)
- `attached_assets/Gemini_Generated_Image__(4)_1782094958510.png` — Stellify logo
- `attached_assets/THE_STELLIFY_PRD_3.5_1782094958511.pdf` — Full product requirements

## Architecture decisions

- **Session auth**: Custom PCM/TCM ID + bcryptjs password. No Clerk/Replit Auth. Token stored in localStorage as `stellify_token`, backend checks `req.session.memberId`.
- **Role-based routing**: Admin, Pastor, Servant, SharingCaptain, CgAuditor, ChurchAuditor, Member — each sees different nav items and data.
- **Stellar Status**: 4 tiers (SBG → P2S → S2B → P2G); each tier unlocks additional discipleship features.
- **Habit codes**: SHC001 Prayer, SHC002 Devotion, SHC003 GOT (Treasury), SHC004 Worship Attendance, SHC005 Biblical Notes, SHC006 CG Attendance, SHC007 Sharing Huddle. Personal habits use PHC001-PHC014.
- **Days stored as JSON**: Spiritual habit daily logs serialized to `days_json` TEXT column to avoid schema explosion.

## Product

- **Member Hub**: Dashboard with greeting, Stellar Status stars, excommunication countdown, today's habit status
- **Disciple Hub**: Spiritual (daily prayer/devotion, weekly GOT/worship/biblical notes/CG, monthly sharing huddle), Personal (habit library PHC001-014), Sharing (3-tier evangelism: preparation → attempt → bearing/conversion)
- **Church Hub**: Sermon recordings, events calendar, guides, prayer requests, counseling, Brethren Watch, feedback
- **Ministry Hub**: Caring Hub (CG servant dashboard), Sharing Hub (captain view), CG Treasury, Church Treasury
- **StellarBoard**: Annual fragment leaderboard (church ID only, gold/silver/bronze top 3)
- **Admin Panel**: Member registration, status management, stellar override, bulk import, stats dashboard

## Seed accounts

| Church ID | Password   | Role          |
|-----------|------------|---------------|
| PCM0001   | admin123   | Admin         |
| PCM0002   | member123  | Servant       |
| PCM0003   | member123  | Member        |
| PCM0004   | member123  | Member        |
| PCM0005   | member123  | SharingCaptain|

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after every `openapi.yaml` change
- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before leaf artifact typechecks (stale declarations cause TS2305)
- PHOW window (Personal Habit selection): Sundays 8AM–8PM only per PRD
- `req.session.memberId` is the primary auth mechanism; routes must check this before responding

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/pnpm-workspace/references/openapi.md` for OpenAPI/codegen conventions
