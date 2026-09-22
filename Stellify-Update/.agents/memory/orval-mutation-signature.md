---
name: Orval mutation call signature
description: How to correctly call Orval-generated React Query mutation hooks in this project.
---

## Rule

Every Orval-generated mutation hook wraps its arguments as named props — never pass raw primitives:

- **Body-only mutations** (POST create): `mutation.mutate({ data: inputObject })`
- **Path + body mutations** (PATCH update): `mutation.mutate({ id, data: updateObject })`
- **Path-only mutations** (DELETE, complete, action): `mutation.mutate({ id })`

**Why:** Orval always destructures `{ id, data }` from the mutationFn props. Passing a raw object as the first arg causes TS2345 ("Property 'data' is missing") at compile time and a runtime no-op.

**How to apply:** Whenever writing a `mutation.mutate(...)` call for any Orval hook — create, update, delete, complete, advise, or any custom PATCH — wrap the body in `{ data: ... }`. Check this first if a mutation silently does nothing or TS complains about the arg type.

## Query invalidation

Use the generated URL getter for query key invalidation:
```typescript
qc.invalidateQueries({ queryKey: [getListSermonsUrl()] });
```
The URL getter returns the exact string key React Query uses for the list query.
