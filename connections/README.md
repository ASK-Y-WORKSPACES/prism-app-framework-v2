# connections/ — how the app talks to data

The connection contract (table data via `getModelView`, API gateways, chat) and
its helper layer. **Connections are foundational** — `base/index.html` inlines
these helpers; this folder is the authoritative reference.

- **`CONNECTIONS.md`** — the contract: slug-prefixed base, cookie vs token auth,
  `getModelView` request/response + cold-start retry, gateway read/write rules,
  and exactly what the project-spec must supply.
- **`connections.js`** — the canonical helper source (`apiBase`, `queryModel`,
  `gw`/`gwWrite`/`gwCreate`, `providerError`, `queryAny`). Inlined into `base/`;
  importable directly for a non single-file build.
- **`dev-proxy.mjs`** — optional local token-injecting proxy, only for previewing
  **real** data on localhost. Never used in production or synthetic mode.

The **project-spec** the user attaches fills the values (slug, workspace/project
ids, named table ids, provider/account). No secrets are bundled — deployed apps
authenticate via the same-origin session cookie.
