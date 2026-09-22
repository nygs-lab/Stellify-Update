---
name: Stellify auth pattern
description: How authentication and authorization work in Stellify — custom PCM/TCM ID + bcryptjs, real JWT bearer tokens, no Clerk/Replit Auth
---

# Stellify Auth Pattern

## The rule
Auth is custom PCM/TCM ID + bcrypt password. No Clerk, no Replit Auth. Tokens are **real JWTs** signed with `SESSION_SECRET` (see `artifacts/api-server/src/lib/auth.ts`).

**Frontend**: Token stored in `localStorage` under key `stellify_token`. The generated API client (`@workspace/api-client-react`) attaches it as `Authorization: Bearer <jwt>` via a registered token getter wired in `artifacts/stellify/src/main.tsx`. `AuthProvider` (`src/hooks/use-auth.tsx`) reads it on mount and calls `useGetMe` to hydrate the user.

**Backend**: `attachMember` middleware decodes the bearer JWT and sets `req.memberId` — it does **NOT** reject unauthenticated requests or check account status. Each route must enforce auth itself: handlers call a local `requireAuth(req, res)` (reads `req.session?.memberId ?? req.memberId`, returns id or sends 401).

**Login flow**: `POST /api/auth/login` → bcrypt compare → issues a real JWT (`signToken(memberId)`, 30d TTL). Login rejects `Deactivated`/`Deleted` accounts. Password reset uses a separate short-lived JWT (`signResetToken`, purpose-tagged, 30m).

## Authorization (enforce per-route — middleware does not)
**Why:** `attachMember` only *attaches* identity; without explicit guards every authenticated member could hit admin endpoints. An architect review caught member-mutation and member-list endpoints exposed to all members (PII + privilege escalation).

**How to apply:**
- Admin-only endpoints (member create/update/delete, status & stellar-status changes, `GET /members` list, bulk import, admin stats actions) must use the `requireAdmin(req, res)` helper (fetches the caller, checks `me.role === "Admin"`, sends 403 otherwise). `GET /members` is consumed *only* by the admin panel — keep it admin-gated.
- `GET /members/:id` (single profile) stays `requireAuth` (members may view profiles).
- Storage `POST /storage/uploads/request-url` must require auth — anonymous callers must not mint upload URLs.

## Known gap (accepted, not gold-plated)
Deactivating a member blocks *new* logins but does **not** revoke existing JWTs until they expire (30d), because `attachMember`/`requireAuth` do not re-check status per request. Acceptable for current scope; revisit if real-time revocation is required.
