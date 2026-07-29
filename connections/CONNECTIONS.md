# Connections — API gateways & table data (single-file Alpine adaptation)

How a Prism app connects to **table data** (SQL over warehoused tables) and to
**API gateways** (a proxied provider API, and the chat/agent service). The app
never talks to a provider or a database directly — everything is brokered by a
single **core host** under one slug-prefixed base path.

> This is the framework's connection contract. The **project-spec** the user
> attaches supplies the *values* (ids, table ids, slug, provider/account); this
> file + `connections.js` supply the *how*. The base shell (`base/index.html`)
> inlines these helpers — connections are foundational, not an optional module.

---

## 1. Connection families

| Family | Route | Backend |
|---|---|---|
| **Table data** | `POST /<slug>/api/Data/getModelView` | SQL over warehoused (DuckDB/ClickHouse-style) tables |
| **API gateway** | `/<slug>/api/gw/<provider>/<version>/…` | A proxied third-party provider API |
| **Chat / agent** | `/<slug>/api/chat/…` | A long-running agent/investigation service |

All connection constants come from one place — `APP_CONFIG` (`appSlug`,
`workspaceId`, `projectId`, the named table ids in `dataSources`). No inline ids
or base paths in the connection layer.

## 2. The base path must be slug-prefixed

`apiBase()` returns **`/<app-slug>/api`**, never bare `/api`. Hard requirement:

> A bare `/api/...` resolves to the host **root**, which does not carry the auth
> cookie. Only the slug-prefixed `/<slug>/api/...` is same-origin with the
> deployed page and therefore carries the session cookie.

The app is deployed under `/<slug>/` (single `index.html`); slug-prefixed calls
are same-origin.

## 3. Two run modes — same code, different auth

- **Mode 2 — Deployed (production): cookie auth.** The page is served
  same-origin under `/<slug>/`, so the browser session **cookie** rides along.
  Every `fetch` sets `credentials:'include'`. **No secret is bundled.**
- **Mode 1 — Local dev: token-injecting proxy.** A browser on `localhost` has no
  cookie, so a tiny proxy (`dev-proxy.mjs`) injects `X-App-Token` from a
  gitignored `.env`. The token is **never** in client code or the deployed file.
  Synthetic-mode preview needs neither cookie nor token.

Single-file note: there is no Next.js `basePath`/static-export/rewrites here. The
adaptation is simply: deploy under `/<slug>/`, call `apiBase()`, cookie in prod;
for local **real** data, run `dev-proxy.mjs` and point the app at it.

## 4. Required headers (every request)

| Header | Value | When |
|---|---|---|
| `X-Workspace-Id` | `APP_CONFIG.workspaceId` | always (app sets it) |
| `credentials:'include'` | — | always (sends cookie in Mode 2) |
| `Accept` / `Content-Type` | `application/json` | per call |
| `X-App-Token` | from `.env` | **Mode 1 only**, injected by `dev-proxy.mjs` — never by app code |

## 5. Table data — `getModelView`

```js
POST /<slug>/api/Data/getModelView
body: { workspaceId, projectId, modelId, query }     // modelId = a named table id; query = SQL
```
Response unpacks parallel arrays into row objects:
```js
// json.Data = { colSchema:[{name}], data:[[...],...] }
const cols = D.colSchema.map(c => c.name)
return D.data.map(row => Object.fromEntries(cols.map((c,i) => [c, row[i]])))
```
**Cold-start retry** is the one place that retries: on `WAREHOUSE_COLD_START` /
`retryable`, sleep the server-suggested `retryAfterSeconds` (default 5s, cap 10s)
and retry (~12 attempts). Read mixed-case fields defensively (`Data`/`data`,
`Success`, `errorCode`).

## 6. API gateway

- **Reads** `gw(path, params)` (GET) — params → query string.
- **Writes** `gwWrite` / `gwCreate` (POST) — params in the **query string, no
  body** (a common gateway quirk; a JSON/form body errors upstream).
- **Errors**: `providerError()` prefers the human field
  (`error_user_msg`/`error_user_title`) over the generic `message`.

A section can declare a REST data source (`{kind:'rest', base, map}`) — `queryAny`
routes it through `gw`. The Optimize module's write-gateways follow the same
contract (`canWrite:false` → queued + deep-link; `true` → `gwWrite`).

**Every linked gateway is a candidate data source — not just a write target.** A platform
connected via a gateway frequently has **no table in `getModelView`** (e.g. Meta/`fbads` ad
campaigns): its data is reachable *only* through `gw('/<provider>/<version>/…')`. Enumerate the
project-spec's `## Linked API Gateways` during data binding, fetch each relevant one (list →
per-entity detail where needed), **normalize its rows into the same shape as the matching table
source, and merge** them so every tab works across both. Building from `getModelView` tables alone
silently drops every gateway-only platform — the *"my Meta campaigns don't show"* failure.

## 7. What the project-spec must supply (and what it need not)

**Supplies:** `appSlug`, `workspaceId`, `projectId`, named **table ids** (one
`modelId` per logical table) + SQL dialect; for gateway/REST sources the
**provider name + version + account id** and route shape; confirmation that
`/api/chat/start|respond|poll` exist.

**Does *not* need to supply (production):** any secret/token — deployed apps
authenticate via the same-origin cookie. The only extra, and only for previewing
**real** data locally, is an `APP_TOKEN` in a gitignored `.env` consumed by
`dev-proxy.mjs`. Synthetic preview and production deploy need nothing else.

## 8. Checklist

1. One config (`APP_CONFIG`) for slug/workspace/project/table ids — no inline literals.
2. Always slug-prefix (`apiBase()`); never bare `/api`.
3. Identity by mode: app sends `X-Workspace-Id` + `credentials:'include'`; the dev proxy injects the token; token stays out of the bundle.
4. Gateway writes go in the query string, no body.
5. Decode provider errors to the human field before surfacing.
6. Retry only the warehouse cold-start (capped backoff); never blanket-retry gateway writes.
7. Reference tables by named id; pass SQL through `getModelView`, never open a DB connection.
8. Keep the fetch wrappers centralized (they live in `connections.js`, inlined into `base/`).
9. Use **all** connected data: every gateway in `## Linked API Gateways` is a source to fetch + merge, or explicitly out of scope — never silently table-only.
