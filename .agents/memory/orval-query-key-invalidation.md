---
name: Orval query key invalidation
description: How Orval-generated React Query keys are structured and how to invalidate them correctly in mutations.
---

Orval generates query hooks whose cache keys use the **literal API path** as the first element of the array. Do not guess or use a "semantic" name.

**Format:** `["/api/habits/spiritual", params?]` — NOT `["/api/spiritual-habits"]`

**Rule:** Always use the generated `getXxxQueryKey()` helper (e.g. `getGetSpiritualHabitsQueryKey()`) or grep `lib/api-client-react/src/generated/api.ts` for the exact key before calling `queryClient.invalidateQueries({ queryKey: [...] })`.

**Why:** During the spiritual-habits hang investigation, all 7 card mutation handlers in `spiritual.tsx` used `["/api/spiritual-habits"]` — a path that doesn't exist — so the dashboard and habit cards never refreshed after a save, giving the appearance of a hang even when the API was fast.

**How to apply:**
- After any new route is added to OpenAPI and codegen is run, open `api.ts` and find the `get*QueryKey` export for that route. Use that key in `invalidateQueries` calls.
- Common correct keys in this project: `["/api/habits/spiritual"]`, `["/api/dashboard/summary"]`, `["/api/stellarboard"]`, `["/api/habits/personal"]`.
- Do not `await` invalidateQueries — fire-and-forget is correct for snappy UX.
