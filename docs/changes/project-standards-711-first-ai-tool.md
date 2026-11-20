# First AI tool: list_items, with the audit_log migration (project-standards#711)

- `backend/src/ai-tools.ts` (new): one read-only tool, `list_items`. Its input reuses the route's own filters (`q`, `category`, `status`, `from`, `to`) plus `limit` (1 to 200, default 50), so one call cannot return the whole history. Entity `item`, action `read`.
- `backend/src/items.ts`: the list query moved into an exported `listItems(db, query, limit?)` that the route and the tool both call (the route passes no limit, so its answer is unchanged); `Db` type exported.
- `backend/src/app.ts`, `server.ts`: `registerToolRoutes(app, { app: 'life-journal', tools, pool, publicKey, requireBinding: true })`; `AI_TOOLS_PUBLIC_KEY` comes from the environment. Without the key, `/internal/tools` is the JSON 404.
- `database/migrations/008_audit_log.sql`: copied unchanged from the project-standards scaffold (`002_audit_log.sql`).
- `compose.yaml`, `.env.example`: `AI_TOOLS_PUBLIC_KEY`, the `shared-ai` network with the alias `life-journal-api`, and the external `shared-ai` network. The server deploy reads the key from SSM.
- Tests: `backend/test/ai-tools.integration.test.ts` (list with a filter and a limit, scopes, signatures, validation, audit rows `denied`, `ok`, `ok`, `error`; tools off without the key) and `ai-tools-binding.test.ts` (unbound, wrong-tool and replayed tokens are 401).
- No write tool; that is a later decision of the user (ADR-0024, first-ai-tool recipe).
