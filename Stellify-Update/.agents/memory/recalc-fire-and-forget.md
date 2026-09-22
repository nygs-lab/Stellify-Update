---
name: recalcMemberStats fire-and-forget
description: recalcMemberStats is slow and must never be awaited before sending a habit write response.
---

`recalcMemberStats(memberId)` in `artifacts/api-server/src/lib/fragments.ts` executes 8 sequential DB queries + 1 UPDATE to recompute a member's annual fragment totals. Awaiting it before `res.json()` adds 60-120ms to every habit write response.

**Rule:** All habit write routes must call it fire-and-forget:
```typescript
recalcMemberStats(memberId).catch((err) =>
  req.log.error({ err }, "recalcMemberStats failed")
);
res.status(201).json({ ... });
```

**Why:** During the hang investigation, all 13 `recalcMemberStats` call sites in `habits.ts` were `await`-ed. This blocked response until the full recalc completed. After converting to fire-and-forget, worship/CG/biblical routes respond in 7-10ms.

**How to apply:**
- `habits.ts` already applies fire-and-forget on all routes (spiritual, personal, sharing). If a new habit route is added, follow the same pattern.
- Personal habit routes (lines ~765, ~778) use it inside `Promise.all` with other ops — that's also acceptable since it's not the bottleneck on that path.
- `maybeRunAnnualReset()` at startup is intentionally sequential (not a request path) — leave it as-is.
