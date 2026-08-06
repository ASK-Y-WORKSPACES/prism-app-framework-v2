# Prism App Framework — Specification

> A scaffold an LLM (Claude Code) clones to produce one polished, **multi-tab**
> Alpine.js SPA per Prism project. Output is a single `index.html` deployed to the
> Asky apps subdomain. This document is the *framework spec*; the *per-project brief*
> (schema, IDs, populated app config) is a separate file (`project-spec.md`).

---

## v2 architecture (authoritative — overrides the single-section model described later)

> **Repo layout & build flow: `README.md` is authoritative.** This spec predates the composable
> v2 layout, so its `shell/ primitives/ module-types/` paths are historical — the real starters are
> `base/index.html` + `presets/<type>/index.html` (compose with `compose.py`). Likewise, the build
> is **interview-driven**: the agent ASKS the user the Stage 1–8 questions and their answers fill
> `APP_CONFIG`. See README §"v2 — READ THIS FIRST" and §"Interview protocol". Read `module-types/<x>`
> below as `presets/<x>`.

**One shell, N section-layouts, driven by one `APP_CONFIG` manifest.** The starter
`presets/dashboard/index.html` is a **genuinely multi-section, working** reference app
(not a single-section `__TOKEN__` stub — the v1 "fully populated example" claim is corrected
here). The build agent fills `APP_CONFIG`; it does not hand-author per-tab HTML.

- **`APP_CONFIG`** (bottom of `<script>`): identity · `dataSources` registry · `slicers` ·
  `sections[]` · `chatStarters` · optional `optimize`. Full shape in README §"v2 — READ THIS FIRST".
- **Generic section renderer**: `<template x-for="sec in sections">` with
  `x-show="section===sec.id"` dispatches on `sec.layout` ∈
  `kpi-grid | breakdown-grid | data-table | funnel | optimize`. Adding a tab = adding a
  `sections[]` entry. (No more empty `x-show="section !== 'dashboard'"` placeholder.)
- **`module type` = starter preset.** A funnel tab can sit beside dashboard tabs; "funnel"
  is a section layout, not a separate whole-app type.
- **Data-source registry + `queryAny(ds, spec)`**: each section's `source` resolves to a
  Prism SQL endpoint (`kind:'prism'` → `queryModel`) or a REST proxy (`kind:'rest'` →
  `fetch('./api/...')`). Multiple sources per app.
- **Per-section, per-tile resilient loaders**: `loadSection(sec)` computes each KPI / chart /
  table independently in its own `try/catch`; a failed tile degrades to `—` and the rest of
  the tab still renders.
- **Filter scopes are now four**: `global ∩ widget ∩ drill ∩ chat`. **Chat is a real scope.**
- **Drill** = single-click → peek popover → `Dig in` (see DESIGN.md), replacing v1 §0.3.
- **Rich tables, section-scoped select filters, derived/rule columns, number/date formatting,
  visual-design rules**: see README + DESIGN.md.

The sections below are retained for the **unchanged** parts (chrome contract, primitives,
filter-rule shape, deploy model). Where they assume a single hardcoded section or the v1 drill
rule, this v2 block governs.

**Repository layout (v2 — composable).** Components are split into folders so a user can take
only the base or base + chosen modules: `base/` (foundation, runs standalone, with inert
`@MODULE:*` markers) · `modules/{funnel,optimize}/` (optional layout add-ons) · `components/`
(primitive atoms) · `connections/` (the data contract + helpers, inlined into base) · `presets/`
(pre-composed apps) · `compose.py` (base + modules → a deployable `index.html`). This supersedes
the `shell/ primitives/ module-types/` tree in §3 below. See README §"Repository layout".

---

## 0. Pitfalls — read first

In rough order of frequency in the prior iteration. Hitting these costs
hours of redo.

1. **Sparse visual output.** Cause: agent authored layout from prose. Cure:
   clone a working starter HTML — never start blank.
2. **Median design.** Cause: no reference target named, so the LLM defaults
   to its training median. Cure: name **Mixpanel / Amplitude / Linear** as
   the anchor for visual density and chrome.
3. **Single-click drills cause flaky drill events on small chart elements.**
   Cure: drill is always **double-click + axis label + visible ▶ prefix +
   HTML pill row below the chart**. Single-click is never drill. Hard rule.
4. **Slicers close on value pick.** Wrong. Pivot-table semantics: slicers
   stay open. Only × dismisses.
5. **`bg-[--token]` instead of `bg-[var(--token)]`.** Tailwind v3 Play CDN
   silently renders transparent. Pre-ship grep: `grep -n '\[--' index.html
   | grep -v 'var('` must be empty.
6. **Relative API paths broken in Claude Code preview.** The deployed app
   under `apps.ask-y.ai/{slug}/` resolves `./api/...` correctly. The preview
   pane does not. **Expected** — don't try to "fix" by switching to
   absolute paths.
7. **Probing Prism during the interview.** Don't. The project brief has
   every column statistic the interview needs. No MCP / WebFetch / Bash
   calls during the interview.
8. **Empty default state preset against archival data.** If the chosen date
   column's `maxValue` is > 6 months old, default to "All time", not
   "Last 30d", or every card renders as zero.
9. **Inventing column or table names.** Every identifier the agent writes
   must appear verbatim in the project brief's schema YAML.
10. **`localStorage` unwrapped throws in Safari private mode.** Use the
    `safeGet`/`safeSet` helpers in the shell.
11. **Do not probe the live data endpoint after the zip is ready.** Never
    curl, WebFetch, or attempt SQL validation against the deployed app. Do
    not ask the user for an app token to run validation queries. If SQL
    correctness is uncertain, leave a `// VALIDATE:` comment in the file.
    The deployed app will surface real errors; live probing during build adds
    no value and exposes tokens.

---

## Data & App Engineering Principles

The standing data-correctness checklist for any app built on this framework. Each rule states what to
do, how the framework already embodies it, and how to verify. (Pitfall #8 above is a specific instance
of 2e.) Rules 1a/1b/2a/2c live in the Prism page's `getModelView` SQL, not the shell; the rest are
enforced by the base engine and must be preserved when editing it.

**1a. Fix fan-out at the source model.** When joining event/bridge tables, make each join key unique on
the other side so rows don't multiply. Fix fan-out in the source model, not with `COUNT(DISTINCT)`
downstream. *Verify:* at each CTE, `COUNT(*) = COUNT(DISTINCT <grain_key>)`.

**1b. Make "one value per entity" deterministic.** Collapse many→one with an explicit ordering
(`argMin/argMax`, `ROW_NUMBER` + full `ORDER BY`), never a non-deterministic aggregate (`any`,
`anyLast`). Define first/last/primary/latest as the business decision it is.

**2a. Probe the environment before building on it.** Treat SQL dialect / date functions / casts as a
hypothesis; send one cheap probe and build on the confirmed result. The shell emits generic ANSI in
`buildWhere`; anything dialect-specific belongs in the page's `getModelView`, verified first.

**2b. Keep ratio numerator and denominator in the same scope.** A rate/ratio is
`SUM(num) ÷ SUM(den)` over the population in view — never an average of per-row ratios, never a sum of
a ratio column. *Framework:* use `agg:'ratio'` with `num`/`den` on KPIs and charts, and `num`/`den` on
`ratio`/`percent`/`perunit` table columns (the totals row pools them). *Verify:* the ROAS KPI, the ROAS
chart line, and the ROAS totals cell all report the same number.

**2c. Join only on keys that exist on both sides.** Broadcasting a coarse table (monthly budget) onto a
finer result (daily actuals) joins on the intersection of grouping fields with the coarse table's real
columns — never fabricate the missing grain into the key. (Page-spec SQL.)

**2d. Serve at least as fine as the finest filter; be period-overlap aware.** *Framework:*
`rowsForSection` keeps a flighted row when its `[active_from, active_to]` **overlaps** the range (and
prorates it), and a point row when its date is in range — not exact-date membership.

**2e. Derive "current period" from the data in scope, not the system clock.** *Framework:* `_asOf` =
`MAX(dateCol)` probed before the windowed fetch; `resolvePreset` anchors every preset to it and the
freshness badge reads "data through &lt;as-of&gt;". A lagging snapshot never renders an empty
clock-anchored window. *Verify:* on data that ends last month, "This month" still shows rows.

**2f. Fetch on data-defining inputs, compute on presentation inputs.** *Framework:* tab switches, sort,
group, and client filters recompute only (`recomputeSection`); re-fetch (`reloadSection`) is reserved
for the date range, `WHERE`-reaching filters, and the data mode. Loads are serialized so none race.

**3a. Add instances as config, not code.** The surface is driven by `APP_CONFIG` (sources, sections,
KPIs, charts, tables); adding a page/visual is a config entry. Reserve new render code for a genuinely
new primitive.

**3b. Verify against the source of truth, same snapshot.** Before calling a mismatch a bug, confirm
which system is canonical and that both sides are the same snapshot; account for freshness gaps and
presentation-layer math not stored in the source.

**3c. Prove production changes on real data in a no-side-effect path first.** Test model/logic changes
through a read-only/dry-run path before committing. In this framework, do **not** live-probe the
deployed endpoint during build (pitfall #11) — leave a `// VALIDATE:` comment; the deployed app
surfaces real errors.

---

## 1. Purpose & non-purpose

### Is

- A scaffold for the LLM to produce *one* polished Alpine SPA per project.
- A minimal, opinionated **design language** plus working component HTML.
- The bridge between a per-project brief (schema + IDs + interview output)
  and a deployable `index.html`.

### Isn't

- A platform/registry with semver, manifests, or bundle budgets.
- A React or Vite codebase.
- A multi-module monorepo.
- A general-purpose UI library.

The deliverable per project is a single zipped `index.html` uploaded via
Asky's *Deploy Application* UI. No build step. No npm. No dist folder.

---

## 2. Tech stack — locked

| Layer | Choice | Source |
|---|---|---|
| Reactivity | Alpine.js 3.x | `https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js` |
| Focus | Alpine Focus | `https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.x.x/dist/cdn.min.js` |
| Styling | Tailwind CSS (Play CDN, v3) | `https://cdn.tailwindcss.com` |
| Charts | Apache ECharts 5.x | `https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js` |
| Icons | Inline SVG (Phosphor-style outlined, 1.5px stroke) | none |
| Fonts | System: `'Segoe UI', system-ui, …` | none |

All four scripts load via CDN. The deploy zip is `index.html` only.

Forbidden: React, JSX, TypeScript, Vite, Webpack, npm, package.json,
tailwind.config, postcss.config, Google Fonts, icon fonts.

---

## 3. Architecture — three layers

```
prism-app-framework/
├── README.md                       ← interview protocol + build process
├── DESIGN.md                       ← tokens + reference targets + polish checklist
├── shell/
│   └── index.html                  ← universal chrome + Alpine factory + tokens (no content)
├── primitives/                     ← opt-in HTML snippets, module-agnostic
│   ├── filter-bar.html
│   ├── slicer-panel.html
│   ├── slicer-chip.html
│   ├── slicer-date.html
│   ├── slicer-numeric.html
│   ├── chip.html
│   ├── command-palette.html
│   ├── drill-row.html
│   ├── empty-state.html
│   ├── error-banner.html
│   ├── loading-skeleton.html
│   ├── toast.html
│   ├── context-menu.html
│   ├── insights-band.html
│   ├── widget-builder.html
│   ├── widget-chrome.html
│   └── custom-widget.html
└── module-types/
    ├── dashboard/
    │   ├── index.html              ← fully populated dashboard example
    │   ├── kpi-card.html
    │   ├── primary-chart.html
    │   ├── breakdown-card.html
    │   └── sortable-table.html
    └── funnel/
        ├── index.html              ← fully populated funnel example
        ├── funnel-chart.html
        ├── step-table.html
        └── trended-tab.html
```

### Layer responsibilities

| Layer | Renders content? | Filter system? | Per-module specific? |
|---|---|---|---|
| **shell** | No — only chrome | State slots pre-declared, no UI rendered | No |
| **primitives** | Drop-in snippets | Filter-bar + slicer + palette + drill live here | No |
| **module-types** | Yes — full example | Includes filter-bar from primitives (funnel extends it) | Yes |

### Assembly at build time

1. Agent reads `README.md` → runs interview → fills `## App` section in `project-spec.md`.
2. Stage 1's module-type choice (`dashboard | funnel | comparison`) selects which `module-types/<x>/index.html` to clone as the working file.
3. Agent fills slots in the cloned starter from the `## App` section (app name, KPIs, sections, slicers, etc.).
4. Agent copies additional primitives from `primitives/` as needed (e.g. additional slicer types).
5. Agent runs the polish checklist (DESIGN.md §end).
6. Output is the working `index.html`, zipped at root.

---

## 4. `shell/index.html` — contract

The shell is the universal scaffold. Every module type's `index.html`
**starts from this file** and overlays its content.

### What renders unconditionally

- **Sidebar** (220 px open / 60 px collapsed): brand row with workspace
  initial + name + "ANALYTICS" eyebrow → "WORKSPACE" label → 8 nav items
  with Phosphor-style icons → mode/version footer with deployed/local dot.
- **Header** (56 px tall, fixed top, offset by sidebar width): app title
  + `MODULE` pill + freshness indicator (color dot + relative time) +
  `(Local)`/`(UTC)` toggle + spacer + command
  palette search button with `⌘K` hint + `Include cancellations` checkbox
  + `Save view` button + `Reset` button + `?` help + `i` about.
- **Empty `<main>`** (offset by sidebar width, with `pt-[56px]` for header).
- **Slicer panel slot** (right edge, conditional `x-show="openSlicers.length > 0"`, 320 px wide).
- **Command palette modal slot** (conditional `x-show="commandPaletteOpen"`).
- **Toast container** (top center, conditional `x-show="toasts.length > 0"`).
- **Top progress bar** (2 px tall, gradient slide animation, conditional `x-show="loading"`).

### Alpine factory — state slots (pre-declared, even if unused)

```js
function app() {
  return {
    // Identity (filled by interview)
    appName: 'App', appInitial: 'A', workspaceName: 'Workspace',

    // Nav (default 8 items; agent edits per module type)
    nav: [/* 8 items */], section: '', sidebarOpen: true,

    // Filters
    filters: { global: [], widget: {}, drill: [] },
    range: { from: null, to: null, preset: 'last_30d' },
    granularity: 'D', granularityAuto: true,
    compare: 'prior',                              // 'off' | 'prior' | 'yoy'
    includeCancellations: false,
    tz: 'local',                                   // 'local' | 'UTC'
    drillHistory: [],

    // Slicer UI
    openSlicers: [],                               // [{ id, scope, collapsed }]
    commandPaletteOpen: false, commandPaletteScope: null,

    // Widgets (user-built; from localStorage)
    widgets: [],
    widgetBuilderOpen: false, editingWidgetId: null,

    // Generic UI
    loading: false, error: null,
    toasts: [],                                    // [{ id, text, kind }]
    openInfo: null, ctxMenu: null,
    saveViewDialogOpen: false, cheatSheetOpen: false,

    // Lifecycle
    async init() { /* hash routing + localStorage hydrate + loadAll */ },
    navigate(id) { /* … */ },
    async loadAll() { /* fan out per-section data */ },

    // Filter mutations
    addFilter(scope, rule, widgetId) { /* … */ },
    replaceFilter(scope, rule, widgetId) { /* … */ },
    removeFilter(scope, field, widgetId, op) { /* … */ },
    toggleLock(scope, field, widgetId) { /* … */ },
    clearAll() { /* wipe non-locked across all scopes */ },
    clearDrill() { /* wipe drill scope + history */ },

    // Drill
    drill(field, value) { /* push history, add rule, toast, reload */ },
    drillBack() { /* pop history */ },

    // Slicer panel
    toggleSlicer(id, scope) { /* … */ },
    addSlicer(id, scope) { /* … */ },
    removeSlicer(id) { /* … */ },

    // Toasts
    toast(text, kind) { /* … */ },

    // Widgets (when widget-building is enabled)
    addWidget(config) { /* push to widgets[], persist */ },
    removeWidget(id) { /* … */ },
    openWidgetBuilder(editId) { /* … */ },
    persistWidgets() { /* safeSet('widgets', this.widgets) */ },

    // Save view
    saveCurrentView(name) { /* … */ },
    loadView(view) { /* … */ },
    resetToDefault() { /* … */ },
  };
}
```

### Module-scope helpers

```js
const WORKSPACE_ID = '__WORKSPACE_ID__';     // filled from project-spec.md ## Project Context
const PROJECT_ID   = '__PROJECT_ID__';
const APP_SLUG     = '__APP_SLUG__';
const API_BASE     = './api';                // relative — resolves to /{slug}/api/

async function queryModel(modelId, sql) { /* POST /Data/getModelView */ }
function chartColor(n) { /* reads --chart-n CSS var */ }
function formatNumber(n, opts) { /* Intl.NumberFormat wrapper */ }
function formatCurrency(n) { /* USD compact by default */ }
function formatPercent(n) { /* 0–1 → "X.X%" */ }
function formatRelativeTime(ts) { /* "3h ago", "yesterday", etc. */ }
function effectiveFilters(filters, widgetId) { /* intersect global ∩ widget ∩ drill */ }
function applyFilters(baseSql, rules, dateCol, range) { /* append WHERE clauses */ }
function safeGet(key, fallback) { /* localStorage.getItem with try/catch */ }
function safeSet(key, value) { /* localStorage.setItem with try/catch */ }
function escapeSqlLiteral(v) { /* single quote escape */ }
function escapeIdent(name) { /* whitelist [a-zA-Z0-9_] */ }
```

### Design tokens — `:root`

Full inventory (lifted verbatim from CEO's `00-GENERAL §3`):

- Surfaces: `--background`, `--surface`, `--surface-elevated`, `--border`, `--border-subtle`, `--border-strong`
- Text: `--foreground`, `--muted-foreground`, `--placeholder`
- Brand: `--primary`, `--primary-light`, `--primary-hover`
- Semantic: `--positive`, `--positive-light`, `--negative`, `--negative-light`, `--warning`, `--warning-light`
- Sidebar: `--sidebar-bg`, `--sidebar-border`, `--sidebar-item-hover`, `--sidebar-item-active`, `--sidebar-active-text`, `--sidebar-text`, `--sidebar-icon`
- Topbar: `--topbar-bg`, `--topbar-border`
- Chart palette: `--chart-1` through `--chart-6`
- Filter scope hues: `--chip-global`, `--chip-widget`, `--chip-drill`, `--chip-chat`
- Font: `--font-sans`

Plus utility classes embedded in `<style>`:
- `.chip-stripe-{global,widget,drill,chat}` — 2 px inset shadow stripe
- `.widget-local-stripe` — 2 px purple stripe for cards with widget-scope rules
- `.skel` — pulsing shimmer for loading state
- `.tabular-nums` — `font-variant-numeric: tabular-nums`
- `[x-cloak]` — `display: none !important`
- `:focus-visible` — primary outline + 2 px offset

---

## 5. Primitives — `primitives/*.html`

Each primitive is a self-contained HTML block the agent copies into the
working file. Primitives reference Alpine state slots already declared in
the shell's factory.

### 5.1 `filter-bar.html`

Sticky strip below the header. Composition (left → right):

1. **Date trigger** — formatted range + preset label. `@click="toggleSlicer('date_range')"`. Active styled when `openSlicers.some(s => s.id === 'date_range')`.
2. **Granularity** — segmented `H · D · W · M · Q · Y`. Disabled buttons for invalid spans (helper `validGranularities(rangeMs)`).
3. **Compare** — radio `No compare / vs Prior / YoY`.
4. **Divider** (`w-px h-5 bg-[var(--border)]`).
5. **Pinned slicer triggers** — `<template x-for="s in pinned_slicers">` button per pinned field. Active when its slicer is open.
6. **`+ Add filter`** button — `@click="commandPaletteOpen = true"`.
7. Spacer.
8. **Clear all (n)** — count of unlocked rules across scopes; clears on click.

Chip rows below the controls (`x-show` per non-empty):
- **"Filters"** — global rules, blue stripe.
- **"From click:"** — drill rules, orange stripe, + `↶ Back (n)` button + Clear.

Used by both dashboard and funnel module types. Funnel imports and extends with cancellations toggle + breakdown segmented control inline.

### 5.2 `slicer-panel.html`

Right-edge drawer. 320 px wide, `top-[56px] bottom-0`, `x-show="openSlicers.length > 0"`. Stacks `SlicerCard` elements top to bottom — one per `openSlicers[i]`.

Each `SlicerCard` has: collapse chevron, label, scope badge, × button. Header is sticky; body scrolls. **Picking a value never closes the slicer** — only × dismisses.

Header band: `Filters · {openSlicers.length}` + `Close all` button.

### 5.3 `slicer-chip.html` / `slicer-date.html` / `slicer-numeric.html`

The three slicer body types. Decided at interview time per the deterministic rule in README §Stage 4.

- **slicer-chip**: list of selectable values. `distinctCount ≤ 12`: no search. `> 12`: search-as-you-type filters chips. Click toggles inclusion. Shift-click for range select. Live distinct values via a `queryModel` call cached by `(prismId, column)`.
- **slicer-date**: preset row (`Today / Yesterday / Last 7d / 14d / 30d / 60d / 90d / 12m / MTD / QTD / YTD / Custom`) + two `<input type="date">` for custom + `Calendar mode` checkbox (cosmetic for v1).
- **slicer-numeric**: min/max number inputs (v1). v2 adds dual-handle slider with histogram backdrop.

### 5.4 `chip.html`

A single rendered filter rule. Left stripe via `chip-stripe-{scope}` class. Click body → `onOpenSlicer()`. Right-click → `onToggleLock()`. × → `onRemove()`. Long-press = right-click on touch.

Display format:
- `in` → `field: v1, v2 (+3)` (truncate after 2 values)
- `not_in` → `field ≠ v1, v2`
- `between` → `field: v1 – v2`
- `gte` / `lte` → `field ≥ v` / `field ≤ v`

Locked rules show a small lock icon + solid background.

### 5.5 `command-palette.html`

⌘K-style modal. Lists every slicer label from the active slicer registry plus action commands (`Open date range`, `Toggle compare`, `Save view`, `Reset to default`). Arrow keys navigate, Enter executes, Esc closes.

When opened from a widget's filter button, the palette shows a purple `Filtering only: {widgetTitle}` banner and scopes selections to that widget.

### 5.6 `drill-row.html`

Horizontal pill row below any chart that exposes drill. One pill per category labeled `▶ {value}`. Single-click drills (DOM event, never flaky like ECharts events on small bars).

Per **hard rule §0.3**: every drillable chart implements all four affordances simultaneously:
1. `dblclick` on the bar/slice → `drill(field, value)`
2. Click on y-axis category label (`triggerEvent: true`) → drill
3. Visible ▶ prefix on every y-axis label via ECharts rich-text formatter
4. The DOM pill row from this primitive

Toast on every drill: `Drilled — {field} = {value}`.

### 5.7 `empty-state.html`

Icon + heading + body + optional CTA. Used inside any card whose data array is empty after filters. Default copy: *"No data for the current filters. Try widening the date range or removing a filter."*

### 5.8 `error-banner.html`

Red strip with heading, technical message, dismiss button. Used at the top of the main area when `error` is set, OR inside a card whose load failed.

### 5.9 `loading-skeleton.html`

Three pulsing gray bars of decreasing width, using `.skel` class. Respects `prefers-reduced-motion`.

### 5.10 `toast.html`

Top-center stacked toasts. Auto-dismiss after 3000 ms. Two kinds: `default` (white) and `error` (red tint). Drill confirmation, view-saved, etc. all toast.

### 5.11 `context-menu.html`

Right-click menu (mounted on chart datums + chips). Three sections per `02-filter-system §10` (CEO spec):
- **Global** (blue): Filter all widgets to / Exclude / Drill
- **This widget only** (purple): Filter THIS widget / Exclude THIS widget
- **Other** (gray): Compare to prior / Send to chat

Closes on outside click + Esc.

### 5.12 `insights-band.html`

Collapsible band at the top of the main area. Three colored cards: positive (green), negative (red), neutral (amber). Each card has an auto-derived insight + one-click CTA that drops a global filter.

v1 auto-insights compute client-side from already-loaded data:
- `insightTopContributor(dimension)` — which dimension value drives the most of metric X
- `insightWeakestChannel()` — which channel converts worst
- `insightCancellationRate()` — current cancellation rate vs. range start

If no insights compute (data empty), the band still renders with the drill instructions text: *"Drill: ▶ button or double-click. Right-click for menu. ⌘K to add a filter."*

### 5.13 `widget-builder.html`

Modal for creating/editing user widgets. Three steps:

1. **Type picker** — chips: `KPI / Line / Bar / Table`.
2. **Metric picker** — list of available metrics from the active prism (label + sample value). Multi-select for table types.
3. **Optional**: group-by dimension (for bar/table), widget-local filters (opens command palette in widget scope).

On submit, emits a widget config object pushed to `this.widgets[]` and persists to localStorage.

Widget config schema:

```js
{
  id: string,                                  // generated
  type: 'kpi' | 'line' | 'bar' | 'table',
  label: string,                                // user-facing
  metricSql: string,                            // SQL fragment: SUM(revenue), COUNT(*), etc.
  format: 'integer' | 'currency' | 'percent' | 'duration',
  favorableUp: boolean,
  groupBy?: string,                             // field name; required for bar/table
  chartTitle?: string,                          // for line/bar
  widgetFilters: FilterRule[],                  // widget-scope rules
}
```

### 5.14 `widget-chrome.html`

The 3-icon row in every widget card header: `Filter` (opens widget-scoped command palette) → `Info` (opens definition popover) → `×` (removes the widget; only on user-created widgets). Plus a `WidgetFilterChips` sub-row showing widget-scope filter chips at the top of the card body.

When the widget has any widget-scope rule, the card itself gets the `widget-local-stripe` class (2 px purple stripe).

### 5.15 `custom-widget.html`

Dispatcher: given a widget config, renders the appropriate widget primitive (kpi-card / primary-chart / breakdown-card / sortable-table) and wires the data hook. Used in `<template x-for="w in widgets">` to render the user's widget set.

### 5.16 `chat-launcher.html`

Floating "ask me anything!" pill in the bottom-right corner. 8 px mascot circle + label. Click → opens the chat panel.

Hidden when `chatOpen` is true (panel takes over the corner). Chat requires the deployed app's Mode-2 cookie auth to answer.

### 5.17 `chat-panel.html`

Right-edge slide-in panel (440 px wide, full height). Composition:

- **Header**: mascot avatar + "Ask me anything!" title + "Grounded in this project's data" subline + × close button.
- **Empty-state greeting** (when `chatMessages.length === 0`): large mascot + "Hey! 👋" + intro copy ("Ask me about your dashboard — KPI shifts, segment differences, anomalies, or what changed since last week.").
- **Message list**: user messages right-aligned with primary background; assistant messages left-aligned with surface background. `kind === 'processing_message'` items render as smaller muted sub-lines with a spinner.
- **Thinking indicator**: three-dot bouncing animation while `chatProcessing` is true.
- **Input area**: auto-grow textarea (max 120px) + Send button. Shift+Enter for newline, Enter to send.
- **Starter prompts**: 4 chip buttons that auto-derive from the `## App` section's KPIs and breakdowns. Visible only when `chatMessages.length === 0`. Each chip → `chatStarterClick(prompt)` → `chatSend(prompt)`.

### Chat state slots (declared in shell factory)

```js
chatOpen: false,
chatMessages: [],          // [{ id, role: 'user'|'assistant', kind: 'message'|'processing_message', text }]
chatInput: '',
chatProcessing: false,
chatInvestigationId: null, // returned by POST /api/chat/start, reused for /respond and /poll
chatCursor: 0,             // last-seen seq for /poll
chatStarters: [],          // auto-generated 4 prompts from KPIs/breakdowns
```

### Chat methods

- `async chatSend(text)` — first send → `POST /api/chat/start`; subsequent sends → `POST /api/chat/respond`. Then calls `chatPollLoop()`.
- `async chatPollLoop()` — short-polls `POST /api/chat/poll` with `waitMs: 8000` until `terminal` or `awaiting_input`, appending items to `chatMessages` as they arrive.
- `chatStarterClick(prompt)` — convenience for clicking a starter chip.
- `chatReset()` — wipe the conversation (new investigation on next send).

### Chat is v1, not v2

Module-type starters (dashboard, funnel) ship with the chat launcher + panel inlined. The agent does NOT need to copy the chat primitives — they're already in the cloned starter. Only edit needed: customize `chatStarters[]` per project, derived from the App section's KPIs + breakdowns.

### Auto-generating starter prompts (Stage 5.5 of the interview)

After Stage 5 (KPIs / Steps / Ranking) and before Stage 6 (Sections), the agent generates 4 starter prompts. Rules:

- **Dashboard**: one per KPI/dimension combo: *"Why did {KPI[0].label} change vs. prior period?"*, *"What {breakdown[0].field} is driving {KPI[1].label}?"*, *"Compare {KPI[2].label} by {breakdown[1].field}."*, *"Show me an anomaly in the last 7 days."*
- **Funnel**: *"Where do most users drop off?"*, *"Compare conversion by {top-pinned-slicer}."*, *"What changed in the funnel last week?"*, *"Show me anomalies by step."*

No interview turn — the agent does this automatically. User can request edits.

### Auth caveat

Chat requires Mode-2 (cookie auth). When the app is running outside the deployed apps host, chat will return 401 and surfaces an error rather than a fabricated answer.

---

## 6. Module types — `module-types/<x>/`

### 6.1 dashboard

**Layout** (top to bottom):

1. **Filter bar** (from primitives, unmodified)
2. **Insights band** (from primitives)
3. **KPI strip** — 4–6 `kpi-card.html` in a responsive grid (`grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4`)
4. **Primary chart card** — large `primary-chart.html` (full width, 360–420 px tall) showing the headline metric over time
5. **Breakdown row** — at least 2 `breakdown-card.html` in `grid-cols-1 md:grid-cols-2 gap-4`
6. **User widgets** — `<template x-for="w in widgets">` rendering `custom-widget.html` for each
7. **`+ New widget`** button at the bottom

**Density floor** (verified by polish checklist):
- ≥ 4 KPI cards visible
- ≥ 1 primary chart card
- ≥ 2 breakdown cards
- Insights band rendered (with placeholder copy if no insights compute)

**Files in `module-types/dashboard/`:**

- `index.html` — clones shell, adds the dashboard layout above with **6 seeded KPIs from `## App`**.
- `kpi-card.html` — composition: eyebrow (uppercase muted label) → 3-icon chrome row → big value (`text-2xl font-bold tabular-nums`) → optional small-sample Warning icon → optional delta pill (with ≈ glyph if not significant) → sparkline (`-mx-1` bleed to card edge, 36 px tall).
- `primary-chart.html` — header (title + subtitle + chrome row) → ECharts container (320–420 px tall) → drill row below (when drill is on).
- `breakdown-card.html` — header → horizontal bar chart with category labels + ▶ prefix + drill row.
- `sortable-table.html` — filter input → table with click-to-sort headers, `aria-sort`, hover row tint.

### 6.2 funnel

**Layout** (top to bottom):

1. **Filter bar (extended)** — imports primitives' filter-bar AND inserts inline:
   - `Cancellations: Included / Excluded / Only` segmented control
   - `Breakdown: Fare bundle / Device / Channel / Days to dep / Origin tier` segmented control
   - `Identity: session / user` segmented control
2. **Funnel chart card** — large ECharts funnel series, full width
3. **Step table card** — per-step rows with count, % step, % overall, drop-off severity bar, Wilson CI
4. **Trended tab card** — per-step conversion over time, one line per step
5. (v2 deferred: filmstrip, paths-between, drivers, drill-to-user)

**Density floor:**
- Funnel chart visible with all steps
- Step table populated
- Trended tab with at least one line

**Files in `module-types/funnel/`:**

- `index.html` — clones shell, adds the funnel layout, accepts step definitions from `## App`.
- `funnel-chart.html` — ECharts funnel series option; data fetched by running per-step `COUNT(DISTINCT identity) WHERE step-predicate` queries.
- `step-table.html` — sortable rows with Wilson CI columns.
- `trended-tab.html` — multi-line chart with one line per step.

### 6.3 comparison (v1 stub)

Leaderboard + small-multiples. Spec deferred.

---

## 7. Widget building — runtime extensibility

The dashboard and funnel module types ship with a default seeded set of
widgets (from `## App`), but the **deployed app lets users add more widgets
at runtime via the `+ New widget` button**.

### What's user-extensible

- Add a KPI / line / bar / table widget
- Pick the metric (SQL fragment from a generated `metrics` map)
- Pick a group-by dimension (for bar/table)
- Set widget-local filters (purple stripe)
- Remove user-created widgets (× icon; seeded widgets are not removable in v1)

### What persists

- User widgets → `localStorage.widgets[]`
- Saved views → `localStorage.savedViews[]` (v1 stores the full state snapshot; v2 integrates with Asky-side saved views)
- URL hash holds current filter state for shareability (see §10)

### What's not in v1

- Pie / scatter chart types
- Multi-dim group-by
- Formula / computed metrics
- Drag-to-reorder
- Widget templates / library
- Backend-persisted views

---

## 8. Filter system — recap

Ported from CEO's `02-filter-system.md`. Full details there; the canonical
behavioral rules here:

- **Four scopes**: global (filter bar) / widget (per-card) / drill (chart click) / chat (v2 — agent suggestion).
- **Precedence**: `effective = global ∩ widget[id] ∩ drill ∩ chat`. Narrowest wins. Same field across scopes → intersect values.
- **Rule shape**: `{ field, op, values[], locked? }`. Ops: `in / not_in / between / gte / lte / is_set / is_not_set`.
- **Drill UX (hard rule)**: 4 simultaneous affordances per §0.3.
- **Slicers stay open** per §0.4. Only × dismisses.
- **No `<select>` elements anywhere** — only the command palette is dropdown-shaped.
- **Locked rules** survive Clear all. Right-click chip toggles lock.
- **URL encoding**: `?date=last_30d&gran=W&cmp=prior&f.field::op=v1,v2&d.field::op=v1` with `!` suffix on op for locked.

---

## 9. Interview protocol — recap

Lives in `README.md`. 8 stages:

1. **Intent** — user picks module type from 4 chips (agent must not recommend); one-sentence purpose
2. **Identity** — app name + URL slug + icon initial
3. **Data binding** — three sub-steps:
   - 3a: user multi-selects which tables from the full project schema feed this app
   - 3b: auto compatibility check that the selected tables support the chosen module type (stops if not met)
   - 3c: user picks primary prism from selected; agent auto-derives date column + default preset
4. **Slicers** — deterministic auto-derivation from column stats of selected tables; user picks which to pin
5. **KPIs / Steps / Ranking** — auto-proposed from schema, user accepts/edits
6. **Sections** — layout proposed per module type, user confirms. Two conditional offers here:
   the **Optimize tab** (when the schema is campaign/ads-like), and the **Copy Performance
   Summary** button (when the app has a campaign-performance table to share into Slack/chat —
   composes the `copysummary` module + `table.copySummary: true`).
7. **Saved views (optional)**
8. **Confirm & emit** — full `## App` block written to `project-spec.md`; `interview-answers.md` written in scripted format for reproducibility. Build step 10 (or "export my choices" at any time) appends `## Post-build modifications` capturing post-interview changes.

Interview is fully self-contained — no Prism MCP probing, no WebFetch, no Bash. Everything is in `project-spec.md`.

Confirmation chips (Stages 1, 3, 6, 7, 8) use `AskUserQuestion`. Open-ended turns (names, KPI definitions) use plain text.

---

## 10. Design — recap (full detail in DESIGN.md)

- **Reference target**: match the visual density and chrome polish of **Mixpanel / Amplitude / Linear**. If output looks sparser than these, the polish checklist failed.
- **Tokens**: full inventory in shell's `<style>` block.
- **Typography roles**:
  - Page title: `text-xl font-semibold tracking-tight`
  - Card title: `text-sm font-semibold`
  - KPI metric: `text-2xl font-bold tabular-nums`
  - Eyebrow label: `text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]`
  - Body: `text-sm`
- **Spacing**:
  - Page padding `px-6 pt-5 pb-8`
  - Section spacing `space-y-6`
  - Grid gap / card padding `gap-4` / `p-4`
- **Cards**: only allowed wrapper is `border border-[var(--border)] bg-[var(--surface-elevated)] rounded-xl shadow-sm`. Never `shadow-lg`.
- **Two font weights only**: `font-semibold` for emphasis, default for body. Plus `font-bold` for KPI numbers. Never `font-medium`/`font-extrabold`/`font-black`.
- **Focus rings on every interactive element**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]`.
- **`tabular-nums` on every number**.

---

## 11. Per-project brief — `project-spec.md`

The framework consumes one file per project. Structure:

```markdown
# {App name} — Project Spec

## API contract
(modes, base URL, X-App-Token, deploy slug — boilerplate from current spec)

## Project Context
- Workspace ID: ...
- Project ID: ...
- App slug: ...

## SQL Guidelines
(DuckDB strict typing rules — boilerplate)

## Project Schema (Prism Tables)
```yaml
... full schema with column statistics ...
```

## App
(POPULATED BY INTERVIEW)

**Module type:** dashboard | funnel | comparison
**Name:** ...
**URL slug:** ...
...
```

The interview output goes into the `## App` section. Everything else is
generated when the project is created in Prism.

---

## 12. Build process — what the agent does

End-to-end on a fresh Claude Code session given (framework folder, project-spec.md):

1. Read `README.md` (interview protocol) and `DESIGN.md` (rules + reference).
2. Read `project-spec.md`'s `## Project Schema` and `## API contract`.
3. Run interview Stages 1–8 against the user. Fill in `## App` section incrementally.
4. After Stage 8 confirmation: clone `module-types/<chosen-type>/index.html` to working `index.html`.
5. Fill identity tokens (app name, slug, workspace ID, project ID, initial).
6. Fill nav from `## App`.
7. Fill seeded KPIs (dashboard) or steps (funnel) from `## App`.
8. Fill slicer registry from `## App` (auto-derived slicers + pinned subset).
9. Copy additional primitives from `primitives/` for slicer types referenced.
10. Run polish checklist (DESIGN.md §end).
11. Zip `index.html` at root. Provide deploy instructions.

Total target: < 30 minutes wall-clock for a v1 dashboard, < 60 minutes for a v1 funnel.

---

## 13. Polish checklist — agent self-verifies before declaring done

Reproduced in DESIGN.md but listed here for orientation:

- [ ] Sidebar renders with brand row + 8 nav items + mode/version footer
- [ ] Header renders with title + MODULE pill + freshness + Local/UTC + ⌘K + Include cancellations + Save view + Reset + ? + i
- [ ] Filter bar renders with date + granularity + compare + pinned slicers + + Add filter + Clear all
- [ ] Insights band renders (with placeholder copy if no live insights)
- [ ] Module-type density floor met (dashboard: ≥4 KPIs + 1 chart + ≥2 breakdowns; funnel: chart + step table + trended)
- [ ] Every KPI card has eyebrow + value + chrome row + sparkline
- [ ] Every chart has dashed grid + hidden axis lines + token-driven colors (`chartColor(n)`)
- [ ] Every interactive element has the focus-visible ring group
- [ ] All numbers use `tabular-nums`
- [ ] No `bg-[--token]` (missing `var()`); pre-ship grep clean
- [ ] No hex literals in code; only `var(--token)` references
- [ ] No `<select>` elements
- [ ] All API paths relative (`./api/...`)
- [ ] `localStorage` access wrapped via `safeGet`/`safeSet`
- [ ] Empty-state guard renders for every section that could go empty after filters
- [ ] `+ New widget` button wired (dashboard) — opens widget builder
- [ ] `+ Add filter` button wired — opens command palette

---

## 14. Out of scope (v1)

- Funnel filmstrip / hot-spots / path-comparison fork / drill-to-user
- Memory engine / page artifact renderer / agent tool catalog
- Chat suggestion-apply (chat returns text only in v1; applying a chat-suggested filter via click is v2)
- Chat-scope filter rules (the 4th filter scope; chat input in v1 is informational only)
- Compute statistics / causal beyond Wilson CI in step table
- Multi-prism queries via client-side join (single-prism per widget)
- Backend-persisted saved views
- Widget pie / scatter / multi-dim
- Drag-to-reorder widgets
- Cross-engine queries (BigQuery + DuckDB in same dashboard)
- Real-time data refresh (5-minute polling only when explicitly requested)

---

## 15. Versioning

The framework is versioned by git SHA. Project specs reference a framework
version implicitly by which copy of the framework folder they were built
against.

Breaking changes (changed Alpine state slot, removed primitive, changed
token name) require a new framework version; old projects keep their
copy and rebuild only when migrated explicitly.

Non-breaking additions (new primitive, new module type, new token) are
patch versions; projects pick up automatically on next build.

---

## 16. Execution modes

The framework supports three execution modes. Pick based on what you're
optimizing for:

| Mode | Who answers | Reproducible? | Best for |
|---|---|---|---|
| **Interactive** | A live user clicking chips | No (varies by run) | First-time validation, real product feedback |
| **Scripted** | A pre-filled `interview-answers.md` file | **Yes** — same input → same output | Regression tests, CI, recorded demos |
| **Simulation** | The same LLM that runs the build | Partially (varies by LLM run) | Live demos, framework self-tests by author |

### Scripted mode (the deterministic option)

If `interview-answers.md` exists in the project's working directory, the
agent skips the interactive interview and applies the file's answers.
Template lives at `prism-app-framework/templates/interview-answers.template.md`.

The agent MUST validate every answer against the schema (primary prism
exists, pinned slicers in survivor set, KPI SQL columns exist, etc.). On
failure it stops and reports the bad key — never silently falls back to
interactive, because the deterministic guarantee is the point.

`auto` is a valid value for keys that have a deterministic default —
`default_preset: auto` runs the freshness heuristic, `chat_starters: auto`
generates from KPIs + breakdowns. Use this when you want to test the
framework's own decisions rather than override them.

### Simulation mode (for demos and self-testing)

The interview + build + validation cycle can be **fully roleplayed by a
single LLM session** — useful for live demos, framework regression tests,
or sanity-checking changes before they hit a real user.

In simulation mode the agent plays both roles: it asks the interview
question, then immediately answers it as if on the user's behalf, picking
sensible choices based on the project schema. The build runs as normal
(clone starter, edit, write `index.html`). The validation runs against
the produced file using `mcp__Claude_Preview__*` tools (or eval against
the running Chrome window) to confirm KPI polarity, drill behavior,
slicer toggling, chat open, command palette filtering, and the polish
checklist's discipline greps.

### When to use it

- **Live demo recordings** — show the framework producing a real polished
  dashboard from a clean project brief in under 10 minutes.
- **Framework regression tests** — after changing a primitive or the
  shell, run the full cycle and confirm the output still meets the
  polish checklist.
- **Variant exploration** — produce different apps from the same project
  brief (e.g. Dashboard vs. Funnel module, different KPI sets, different
  pinned slicers) to confirm the framework's range.

### How to invoke it

Tell the agent:

> *"Build the application end-to-end in simulation mode. Run the interview
> by yourself — pick sensible choices for [a Paid Media dashboard /
> a Funnel analysis / etc.]. When done, open the result in Chrome and run
> the full functionality validation through the preview tools."*

The agent will:

1. Read `README.md` and the project schema.
2. Roleplay the interview, showing each stage's chip selectors + user
   answers in the conversation (theatrical format), then locking the
   choice.
3. Emit the `## App` section into `project-spec.md`.
4. Clone the starter, replace tokens, edit `// CONFIGURE:` blocks.
5. Open the result in Chrome (`PowerShell Start-Process chrome.exe`).
6. Run validation: DOM inspection via `mcp__Claude_Preview__preview_eval`,
   interactive behavior tests (drill, slicer toggle, clear-all, chat open,
   palette filter), discipline greps, polish-checklist verification.
7. Report results as a structured summary.

### What it doesn't replace

Real user testing — a fresh chat with a real user clicking real chips and
making real domain decisions. Simulation mode is the framework author's
tool, not the framework user's. Treat its successes as **necessary but
not sufficient** evidence the framework works.

### Honest caveat

The simulation agent is the same LLM that wrote the framework. It knows
where the bodies are buried. A simulation-mode pass doesn't catch the
class of failure where the framework's instructions ARE the bug (because
the simulating agent unconsciously compensates). For that, the only signal
is a fresh chat with no prior conversation context — the test described
in `test-project/HOW_TO_TEST.md`.

---

## 17. Data source contract — real data only

Apps load **live data only** — there is no synthetic/demo data mode and no data-source toggle in the header. Every data-fetching method fetches from the connected sources and fails loud when none are reachable (rather than silently showing fabricated numbers).

```js
async loadData() {
  this.loading = true;
  this.error = null;
  try {
    // Fan out queryModel(...) / gateway calls, populate _sourceRows per source.
    // When no source is reachable (e.g. local file:// preview), surface an
    // explanatory banner rather than silently showing numbers.
  } catch (e) { this.error = e.message; }
  this.loading = false;
},
```

### Local preview

Opening `index.html` from `file://` has no reachable endpoint, so the app renders its chrome and shows the "No data endpoint reachable" banner. To preview against live data locally, run `connections/dev-proxy.mjs`; deployed under its app slug the app reads through the session cookie.

### Build-agent responsibility

When wiring the loader, the build agent:

1. Reads the `## App` section's primary prism + KPIs / steps definitions.
2. Generates a `queryModel(prismName, sql)` call per source, populating `_sourceRows`.
3. Routes each section's rows by its `source`, applying the active filter set + date range + drill state client-side.
4. Uses `MAX(date_column)` against the primary prism to set freshness.

### Project-spec implication

The `interview-answers.md` / `## App` section already carries enough information (primary prism, date column, KPI SQL fragments, step predicates, identity column) for the agent to write the queries. No additional interview stage needed.

---

*End of framework spec.*

*Next deliverables: `shell/index.html` (the working starter) + `DESIGN.md`
(token table + reference targets + polish checklist) + `README.md`
(interview protocol + build process + pitfalls). After those, the
per-primitive HTML files and per-module-type starters.*
