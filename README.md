# availsync-sdk-ts

TypeScript SDK for the Availsync API. **Placeholder repo until v1.1** — v1 ships REST + OpenAPI spec only, per ADR D-003.

When v1.1 begins:

```bash
cp ../availsync-api/openapi.json ./openapi.json
pnpm generate    # → src/api-types.ts
# layer a thin client wrapper on top
```

See `../docs/PRD/availsync-v1.md` (v1 scope) and `../docs/decisions.md` (D-003, D-021) for context.
