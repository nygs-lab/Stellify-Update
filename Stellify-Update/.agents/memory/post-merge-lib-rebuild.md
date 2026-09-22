---
name: Post-merge lib rebuild
description: Stale lib declaration files after task-agent merges cause false "module has no exported member" errors in leaf packages.
---

## Rule
After any task-agent merge that touches `lib/*` packages (e.g. new OpenAPI endpoints → codegen → new hooks in `lib/api-client-react`), **always run `pnpm run typecheck:libs` before running leaf-package typechecks** (`pnpm --filter @workspace/stellify run typecheck`).

**Why:** Leaf packages import from compiled lib declarations (`.d.ts`), not from source. When a merge adds new exports, the old `.d.ts` files don't include them until `tsc --build` reruns. The error looks like: `Module '"@workspace/api-client-react"' has no exported member 'useLogGotHabit'` even though the export clearly exists in the source.

**How to apply:** Any time a task merge summary mentions "codegen", "new hooks", or changes to `lib/api-spec/openapi.yaml`, run `pnpm run typecheck:libs` first.
