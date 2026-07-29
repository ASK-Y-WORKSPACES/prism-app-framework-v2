# Design System — Prism App Framework

Tokens, typography, spacing, reference targets, and the polish checklist the
agent runs before declaring done.

This file is normative. The shell `index.html` ships these tokens inline; do
not redefine them. Per-module starters and primitives reference them only
via `var(--token)` syntax.

---

## ⚡ v2 normative additions (override conflicting v1 rules below)

### Drill gesture (replaces v1 §0.3 "double-click + ▶ pill")

**Single-click** a chart datum → a **peek popover** anchored at the click showing the
dimension + value + that point's metric, with three actions:
- **`Dig in`** → performs the drill (adds a `drill`-scope rule, toasts `Drilled — {field} = {value}`, every card/chart/table recomputes).
- **Exclude** → adds a `not_in` global rule.
- **Send to chat** → opens chat scoped to that value.

Single-click no longer "never drills"; it always opens the peek. Drilling is one extra,
deliberate click (`Dig in`). A `↶ Back (n)` button reverts the last drill.

### Number & date formatting policy (decide once per metric, apply everywhere)

Abbreviated on KPI cards / chart labels / axes; **exact** in tables + tooltips.

**Decimal precision scales with the shown mantissa** (the leading number before any `K`/`M`/`%`/`x`):
a mantissa with **>2 integer digits (≥100) → 1 decimal**; **≤2 digits (<100) → 2 decimals**; trailing
zeros are trimmed. So `$6,352.89 → $6,352.9`, `2.6K → 2.58K`, `2.3% → 2.31%`. This gives small numbers
useful precision and keeps large numbers uncluttered.

| Type | Abbreviated | Exact | Abbreviate? |
|---|---|---|---|
| Currency | `$293.9K` / `$1.2M` / `$2.4B` | `$6,352.9` / `$85.55` | yes |
| Counts | `85.3K` / `2.58K` | `85,300` | yes |
| Ratios / multipliers (ROAS) | — | `1.24x` everywhere | **never** |
| Rates / percentages (CTR) | — | `2.31%` everywhere | **never** |
| Per-unit costs (CPC/CPA) | — | `$2.45` everywhere | **never** |
| Dates | axis `Jan` | range `Jan 1 – Jun 9, 2026` | n/a |

Signal type via unit (`x` / `%` / symbol-first) so a bare `1.2` isn't read as a count. Never use `±`.
Helpers live in the shell: `smartFixed(n)` / `smartMoney(n)` power `fmt(kind,n)` → `{label, exact}`,
plus `fmtCell(type,v)` and `formatDate`.

### Data-table behaviour (the `data-table` layout, every table)

- **Paginated at 50 rows/page.** Prev/Next + a `Showing a–b of N rows` footer appear once there's more
  than one page; the user never faces an endless wall of rows.
- **Filter + sort work out of the box on every table.** Click a column header to sort (▲/▼). Each
  categorical column (badge/status/text, 2–40 distinct values) auto-gets a value-picker dropdown — the
  options are listed and clickable; no config needed. Numeric/date/image columns stay sortable-only.
  Explicit `table.filters` in APP_CONFIG still work and come first.
- **Totals row** sums the additive columns (currency / number / integer); rates & ratios show `—` (a
  summed CTR/ROAS is meaningless). It sits **on top when the table spans more than one page** (so it's
  always visible) and **at the bottom for a single page**. Totals reflect all filtered rows, not just the
  current page. Helpers: `tableRowsAll` / `tableFilters` / `tablePages` / `tableTotals`.

### Visual-design rules — be colorful, but keep color meaningful

- **Variety BETWEEN charts, consistency WITHIN a category.** Give each chart its own palette,
  but the *same* category (e.g. "Mobile") gets the *same* color in every chart.
- **Show EVERY categorical value — never silently drop one.** A discrete category (platform,
  franchise, device, campaign…) must always be labelled on the axis and represented in the
  visual. ECharts thins overlapping category labels by default; the engine forces `interval:0`
  on categorical axes so all of them render. This is the opposite of a **time** axis, where the
  values are continuous and thinning tick labels (showing every 5th day) loses nothing — that
  thinning stays. If a categorical dimension has too many values for the chosen chart, **change
  the chart** (ranked bar / treemap show them all), never cap or bucket them into "Other".
- **Green/red mean good/bad**, never decoration. Don't color neutral categories green/red.
- **Ranked charts shade strongest→softest top-to-bottom** so the eye lands on the leader.
- **A delta needs a referent.** Every green/red % change explains *vs. what* on hover
  ("7.2% up vs. the prior 30 days") — the reader never has to guess the comparison period.
- Don't be boring — line for trend, bar for category comparison, ranked bar/table for
  leaderboards, donut/treemap for share-of-total, scatter for relationships. Reach for richer
  visuals when they fit.

### Tell a story, don't just tile charts

A dashboard is a narrative, not a wall of identical bars. Compose each page so the visuals
*read* in sequence and answer a question:

- **Vary the chart types across a page.** Don't default everything to bars. Mix trend (line/
  area), composition (donut/treemap), ranking (ranked bar), relationship (scatter), and detail
  (table). Two adjacent charts should rarely be the same type.
- **Sequence for a story:** headline (what happened — KPI row + hero trend) → composition
  (what it's made of — share/ranking) → relationship/diagnosis (why — scatter, breakdown) →
  detail (the receipts — table). Most important thing first.
- **Pick the type from the *shape of the answer*, then make it interesting** — the decision
  tree below is the floor, not the ceiling.

### Chart decision tree (pick the visual from intent)

```
Trend over time?            → line  (or area for a single cumulative series)
Compare across categories?  → bar (all categories labelled)
Leaderboard (ordered)?      → ranked bar (shows every entry — no ≤N cap)
Share of a total?           → donut (≤~8 slices) · treemap (many slices, all labelled)
Relationship between 2 metrics? → scatter (e.g. spend↔revenue, spend↔ROAS per entity)
Two metrics over time/category, very different scales? → dualAxis (bars=metric on left, line=metricY on right)
Exact numbers / many cols?  → table
```
**Dual-axis for divergent scales.** When one visual must show two metrics whose magnitudes differ by
orders of magnitude (spend in $M vs ROAS ~5×, impressions in millions vs CTR ~2%), a single axis
flattens the small one to nothing. Use `type:'dualAxis'` with `metric`+`metricY` (each with its own
`agg`/`aggY`): the engine draws `metric` as bars on a **left** axis and `metricY` as a line on a
**right** axis, and **color-matches each series to its axis** (line, ticks, name) so it's unambiguous
which side a value belongs to. Don't force two wildly different metrics onto one axis.
Don't default everything to bars — a page should mix types (area, donut, treemap, ranked,
scatter, table). Drill works on **every** visual: single-click any datum (bar, slice, line/area
point, scatter dot) → peek popover → **Dig in**.

### Layout convention

KPI row across the top → most-important chart directly below → supporting charts/tables
under that. Most important thing first. Every section that can go empty renders an
empty-state ("No results match the selected filters"), never a blank or zero-filled chart.

### Defaults ON in every app

Filtering · drilling · per-metric tooltips · widget builder (every layout) · chat
(a real 4th filter scope). Tooltip on **every** metric stating how it's calculated
(`agg(expr)`).

**Date range:** apps open on **`last_30d`** by default (`dataSources.primary.defaultPreset`) — a
bounded window loads faster than all-time; the user widens it if they want. **Custom** opens a
**visual calendar range picker** (click a start day, then an end day — the range highlights — then
**Apply**), not raw date inputs. Start/End fields show the current selection and the active one is
outlined.

---

## ⚡ v2.1 normative additions — marketing data, explainability, data modes

These are **requirements inherited by every app**, not suggestions. The engine in `base/`
implements them; the build agent must honor them in `APP_CONFIG` for every app.

### A. Domain knowledge — two kinds of marketing source (treat them differently)

Marketing / campaign-performance apps pull from two distinct source kinds. Every entry in
`APP_CONFIG.dataSources` declares its `category`:

| `category` | Examples | Source of truth for | Does NOT have |
|---|---|---|---|
| `'ad'` | Google Ads, Meta/Facebook, Instagram, LinkedIn, TikTok | spend, impressions, clicks, CTR, CPC, **platform-reported** conversions | website sessions, organic |
| `'analytics'` | GA4 (also Adobe Analytics) | sessions, on-site behavior, **attributed** revenue, on-property conversions | ad spend |

Rules the agent must not violate:
- **Never `SUM` spend onto analytics rows** and **never attribute sessions to ad rows.** A
  cross-source metric must be composed from the source(s) that actually carry it.
- A KPI/chart/column whose metric is spend/CTR/CPC draws from `ad` sources; one whose metric is
  sessions/on-site behavior draws from `analytics` sources. Conversions/revenue exist in both —
  state which one in the metric's `source`.
- Each `dataSources` entry carries a human `provider` label (e.g. `'Google Ads'`, `'GA4'`) used
  in the source line shown on hover.

### B. Metric correctness & explainability (mandatory)

**Every metric — KPI card, table column, chart series — carries a `tooltip` and a `source`, and
explains itself on hover, immediately.** The shell renders a custom hover tooltip (`.mtip`) via
`showTip`/`metricTipHtml`. It is the **only** tooltip on these elements — **never** also put a native
`title=` on an element that calls `showTip` (that produces two stacked popups). The `.mtip` is
**hoverable and copyable**: leaving the trigger starts a short close timer that moving onto the tooltip
cancels (`tipEnter`), so the user can travel to it and select/copy the text (`pointer-events:auto`,
`user-select:text`). The tooltip states three things:

1. **what it is** — the metric label,
2. **how it's calculated** — the `tooltip` string (`agg(expr)`, the formula, the rule),
3. **which source** — the `source` string (provider or `ad`/`analytics`).

Config contract (the renderer reads these keys):
```js
kpis:    [{ label, agg, expr, format, favorableUp, source, tooltip }]   // source + tooltip REQUIRED
charts:  [{ title, metric, agg, dimension, type, …, source, tooltip }]  // source + tooltip REQUIRED
table.columns: [{ key, label, type, source, tooltip }]                  // source + tooltip on every labelled column
```
`source`/`tooltip` are not optional. If omitted the tooltip prints *“Source: not specified”* — a
visible failure, by design. Keep the **never sum a rate/ratio** rule from v2: rates (CTR) and
ratios (ROAS) use `agg:'avg'`, never `sum`.

### C. Data modes — one source of truth, idempotent both directions

There is exactly one source of truth for the data mode: `dataSource` (`'synthetic'` | `'real'`).
Flipping it goes through **`setDataMode(mode)`** only — never an inline relabel. `setDataMode`:
- drops the previous dataset (`_rows=[]`) and resets the chat session, then runs a **full reload**;
- is **idempotent in both directions** — synthetic mode *always* regenerates `synthRows`, real mode
  *always* refetches. Switching back never leaves the previous dataset in place behind a new label.

---

## Reference targets

When in doubt about a design decision, match these public products. They are
in LLM training data — naming them anchors the output away from generic
Tailwind starter aesthetics.

| Aspect | Reference |
|---|---|
| Overall density, KPI strip, chrome | **Mixpanel** / **Amplitude** |
| Sidebar polish, motion, restraint | **Linear** |
| Filter chips, drill UX, "+ Add filter" | **Mixpanel** / **PostHog** |
| Insights band (auto-discovered highlights) | **Mixpanel** "Insights" / **Amplitude** "Notebooks" |
| Funnel chart density and step table | **Amplitude** funnels / **Heap** |

If your output feels like a generic Tailwind starter template, the polish
checklist failed.

---

## Tokens — `:root` (already in shell `<style>`)

```css
:root {
  --font-sans: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

  /* Surfaces */
  --background:       #ffffff;
  --surface:          #f8f9fb;
  --surface-elevated: #ffffff;
  --border:           #e5e9ef;
  --border-subtle:    #f0f2f5;
  --border-strong:    #b8c0cd;

  /* Text */
  --foreground:       #1a2035;
  --muted-foreground: #6b7694;
  --placeholder:      #9aa3be;

  /* Brand */
  --primary:          #4361ee;
  --primary-light:    #eef0fd;
  --primary-hover:    #3451d1;

  /* Semantic */
  --positive:         #2ec4b6;
  --positive-light:   #e8faf8;
  --negative:         #e63946;
  --negative-light:   #fdecea;
  --warning:          #f4a261;
  --warning-light:    #fef3e8;

  /* Sidebar */
  --sidebar-bg:           #ffffff;
  --sidebar-border:       #e5e9ef;
  --sidebar-item-hover:   #f5f6fa;
  --sidebar-item-active:  #eef0fd;
  --sidebar-active-text:  #4361ee;
  --sidebar-text:         #3d4764;
  --sidebar-icon:         #6b7694;

  /* Topbar */
  --topbar-bg:        #eef0f4;
  --topbar-border:    #e5e9ef;

  /* Chart palette */
  --chart-1: #4361ee;
  --chart-2: #2ec4b6;
  --chart-3: #f4a261;
  --chart-4: #e63946;
  --chart-5: #9b5de5;
  --chart-6: #8d99ae;

  /* Filter scope hues */
  --chip-global:  #4361ee;
  --chip-widget:  #9b5de5;
  --chip-drill:   #f4a261;
  --chip-chat:    #2ec4b6;
}
```

To re-skin: edit `:root` only. Never use hex literals anywhere else.

---

## Utility CSS — shipped in shell `<style>`

```css
[x-cloak] { display: none !important; }

@keyframes skel-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
.skel { animation: skel-pulse 1.4s ease-in-out infinite;
        background: var(--border-subtle); border-radius: 6px; }

.tabular-nums { font-variant-numeric: tabular-nums; }

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.chip-stripe-global { box-shadow: inset 2px 0 0 var(--chip-global); }
.chip-stripe-widget { box-shadow: inset 2px 0 0 var(--chip-widget); }
.chip-stripe-drill  { box-shadow: inset 2px 0 0 var(--chip-drill); }
.chip-stripe-chat   { box-shadow: inset 2px 0 0 var(--chip-chat); }
.widget-local-stripe{ box-shadow: inset 2px 0 0 var(--chip-widget); }

@keyframes top-progress-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%);  }
}
.top-progress-bar-track {
  position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 100;
  pointer-events: none; overflow: hidden; background: transparent;
}
.top-progress-bar-fill {
  width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  animation: top-progress-slide 1.1s linear infinite;
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: var(--placeholder); }
```

---

## Typography roles

| Role | Class |
|---|---|
| Page title | `text-xl font-semibold tracking-tight text-[var(--foreground)]` |
| Section heading | `text-sm font-semibold text-[var(--foreground)]` |
| Card title | `text-sm font-semibold text-[var(--foreground)]` |
| KPI metric | `text-2xl font-bold tabular-nums text-[var(--foreground)]` |
| KPI / table eyebrow label | `text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]` |
| Body | `text-sm text-[var(--foreground)]` |
| Secondary / caption | `text-xs text-[var(--muted-foreground)]` |
| Sidebar nav item | `text-sm font-medium` |
| Pill / badge | `text-[10px] font-semibold uppercase tracking-wider` |

**Two font weights only.** `font-semibold` for emphasis, default for body. Plus `font-bold` for KPI numbers and `font-medium` for sidebar nav items. Never `font-extrabold` / `font-black`.

**`tabular-nums` on every number** — KPI values, deltas, table cells with numeric values, durations, currencies. Stable digit width prevents jitter on data refresh.

---

## Spacing — Tailwind 4 px grid only

| Context | Value |
|---|---|
| Page padding | `px-6 pt-5 pb-8` |
| Between sections | `space-y-6` |
| Grid gap / card padding | `gap-4` / `p-4` |
| Sidebar nav | `py-3 px-2`, items `px-3 py-2` |
| Topbar | `px-4`, height `56px` |
| Filter bar | `px-4 py-2`, height `48px` |
| Card title margin | `mb-4` below title |
| KPI grid | `grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4` |
| Breakdown grid | `grid-cols-1 md:grid-cols-2 gap-4` |

---

## Card primitive — the only allowed surface wrapper

```html
<section class="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl shadow-sm p-4">
  …
</section>
```

Modifiers:
- Hover lift on interactive cards: append `transition-shadow hover:shadow-md`
- Widget-local-filter accent: append `widget-local-stripe`
- Focused (chart-focus): append `ring-1 ring-[var(--primary)]`

Never `shadow-lg` on cards. Never `rounded-2xl` or `rounded-md` — only `rounded-xl`.

---

## Buttons & inputs

| Element | Classes |
|---|---|
| Primary button | `bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white h-9 px-4 text-sm font-medium rounded-lg` |
| Secondary button | `border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--muted-foreground)] h-9 px-4 text-sm rounded-lg` |
| Ghost icon button | `w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--primary)]` |
| Input | `border border-[var(--border)] bg-[var(--surface-elevated)] rounded-lg text-sm focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 px-3 py-1.5` |
| Search field | Same as Input + leading magnifier icon + trailing `⌘K` hint |
| Pill (badge) | `text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded` |

**One primary button per section.** Never `size="lg"` proportions.

**Focus ring on every interactive element:**

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40
focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]
```

Add this verbatim to every `<button>`, `<a>`, `<input>`, `<select>` (note: we don't use `<select>`), and any `[role="button"]`.

---

## Icons

Inline SVG only. Phosphor-style outlined: 1.5 px stroke, rounded line caps, rounded line joins. Standard sizes:

- Sidebar nav: 18 × 18
- Header buttons: 16 × 16 or 18 × 18
- Card header chrome (filter / info / ×): 14 × 14
- Pill content (delta arrows): 12 × 12

Icon color always inherits from `currentColor`; the parent's `text-*` class drives it.

---

## ECharts conventions

Every chart uses these defaults (helper functions in shell):

```js
{
  animation: false,                                      // or 'auto' if motion appropriate
  grid: { left: 0, right: 0, top: 8, bottom: 36, containLabel: true },
  tooltip: {
    trigger: 'axis',                                     // 'item' for pie/scatter
    backgroundColor: '#ffffff',
    borderColor: 'var(--border)',
    borderWidth: 1,
    textStyle: { color: 'var(--foreground)', fontSize: 12 },
    extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-radius: 8px;'
  },
  xAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    // CATEGORICAL axis → interval:0 so every discrete value is labelled (rotate long/many labels).
    // TIME axis → omit interval (let ECharts thin dense dates). See `catAxis` in base/index.html.
    axisLabel: { color: 'var(--muted-foreground)', fontSize: 11, interval: 0, hideOverlap: false }
  },
  yAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: 'var(--muted-foreground)', fontSize: 11 },
    splitLine: { lineStyle: { color: 'var(--border)', type: 'dashed' } }
  },
  series: [{ /* type-specific */ }]
}
```

Bar series: `barMaxWidth: 32`, `itemStyle.borderRadius: [4,4,0,0]`, `itemStyle.color: chartColor(1)`.
Line series: `smooth: 0.3`, `symbolSize: 0`, `lineStyle.color: chartColor(1)`, `areaStyle.color: chartColor(1)`, `areaStyle.opacity: 0.12`.
Pie/donut: `radius: ['52%', '76%']`, scrollable legend, **every** slice drawn (no top-N cap).
Treemap: one labelled, value-sized tile per category — the go-to for share when there are too
many categories to read as a donut.
Delta pill: `cursor-help` + hover tooltip naming the comparison period (`deltaTipHtml`).

**Forbidden:** two-line dual-axis charts implying false correlation, 3-D, gradient axes, decorative
donut holes, **dropping/bucketing categorical values to fit a chart** (change the chart type instead).
(The supported `dualAxis` type is bars + one line with color-matched axes — use it for genuinely
divergent scales, not to overlay two unrelated trends.)

**Use `chartColor(1..6)` to read colors** — never hex literals. Lets the user re-skin via `:root`.

---

## Density floors — per module type

The polish checklist verifies these. If the agent's output is below floor, it's not done.

### Dashboard

- ≥ 4 KPI cards (each with eyebrow + value + chrome row + sparkline)
- ≥ 1 primary chart card (full-width, 320–420 px tall)
- ≥ 2 breakdown cards (bar chart or sortable table)
- Insights band rendered (with placeholder copy if no live insights compute)
- Filter bar with at least 3 pinned slicers visible
- `+ New widget` button at the bottom

### Funnel

- Funnel chart card visible with all steps from `## App`
- Step table populated with rows per step + conversion + drop-off + Wilson CI columns
- Trended tab card with one line per step
- Filter bar extended with cancellations toggle + breakdown segmented control

### Comparison

- Leaderboard table with ≥ 10 rows visible above the fold
- Small-multiples row showing top-N entities

---

## Polish checklist — self-verify before declaring done

Run through each item. Any failure → fix before signaling complete.

### Chrome

- [ ] Sidebar renders with brand row (workspace initial + name + "ANALYTICS" eyebrow) + WORKSPACE label + 8 nav items + mode/version footer
- [ ] Sidebar collapse toggle works (220 ↔ 60 px)
- [ ] Header renders 56 px tall with: app title · MODULE pill · freshness dot + "Updated X ago" · (Local)/(UTC) toggle · Real/Synthetic toggle · spacer · search bar with ⌘K hint · Include cancellations checkbox · Save view · Reset · ? · i · avatar
- [ ] Filter bar sticky below header with: date trigger · granularity radio · compare radio · divider · pinned slicer triggers · + Add filter · spacer · Clear all (n)
- [ ] Slicer panel mounts on right edge (320 px) when `openSlicers.length > 0`; picking a value does NOT close it
- [ ] Command palette modal opens on ⌘K and on `+ Add filter`
- [ ] Top progress bar visible during data loads

### Content (module-type specific — see density floors above)

- [ ] Module-type density floor met
- [ ] Every KPI card has eyebrow + value + chrome row + sparkline
- [ ] Every chart has dashed grid + hidden axis lines + `chartColor(n)` palette
- [ ] Every drillable chart implements all 4 affordances (dblclick + axis label + ▶ prefix + DOM pill row)
- [ ] Empty-state guard renders inside each section that could go empty after filters
- [ ] Loading skeleton shown while data is fetching
- [ ] Error banner shown when a query fails

### Marketing data, explainability & data modes (v2.1 — every app)

- [ ] Every `dataSources` entry declares `category:'ad'|'analytics'` and a `provider` label
- [ ] No spend metric is summed onto an `analytics` source; no sessions metric is attributed to an `ad` source
- [ ] Every KPI, chart series, and labelled table column has both `source` and `tooltip` set (no “Source: not specified” tooltips in the shipped app)
- [ ] Hovering any metric's info icon shows the explanation **immediately** (custom `.mtip`, not native `title` delay), stating what it is · how it's calculated · which source
- [ ] Rates (CTR) and ratios (ROAS) use `agg:'avg'`, never `sum`
- [ ] The data-mode toggle calls `setDataMode()`; switching Synthetic⇄Real triggers a full reload **both ways** (synthetic regenerates, real refetches — never a stale relabel)

### Discipline

- [ ] The `<!-- ══ SECTION TEMPLATE ══ ... -->` scaffolding comment block has been removed from the output `index.html` — it is developer guidance only, not part of the deployed app
- [ ] No `bg-[--token]` (missing `var()`); pre-ship grep `grep -n '\[--' index.html | grep -v 'var('` is empty
- [ ] No hex color literals anywhere in code; only `var(--token)` references
- [ ] No `<select>` elements anywhere — only the command palette is dropdown-shaped
- [ ] All API paths relative (`./api/...`); no leading-slash paths
- [ ] All `localStorage` access wrapped via `safeGet`/`safeSet`
- [ ] All interactive elements have the `focus-visible:ring-*` group
- [ ] All numbers use `tabular-nums`
- [ ] Two font weights only (semibold + default; plus font-bold for KPI numbers, font-medium for nav)
- [ ] Every identifier in queries appears verbatim in `## Project Schema`
- [ ] DuckDB SQL guidelines followed (no `!= ''` on Date columns, double-quote uppercase columns, `IS NOT NULL` for missing values)
- [ ] **DuckDB dialect only** — no `INITCAP`/`NOW`/`DATEADD`/`IFNULL`/`NVL`/`LISTAGG`/`::type`; casing & formatting done in the JS normalizer, not SQL
- [ ] **Every generated query validated against a local DuckDB** (offline, mock tables) before zipping — catches dialect errors pre-deploy
- [ ] **Date range defaults to `all_time`** on every source unless the data's `maxValue` is verified inside the chosen relative window
- [ ] **Per-source query failures fail loud** — each surfaces its own banner; a generic "no endpoint" banner shows only when all sources fail
- [ ] **Every linked connection is used or explicitly out of scope** — each gateway in the project-spec's `## Linked API Gateways` is either a `dataSources` entry (fetched via `./api/gw/{name}/...`, merged into the matching rowset) or deliberately excluded; no connected platform's data is silently missing

### Widget building (dashboard)

- [ ] `+ New widget` button wired to open widget builder modal
- [ ] Widget builder supports KPI / Line / Bar / Table types
- [ ] User-created widgets persist to localStorage via `safeSet('widgets', ...)`
- [ ] User-created widgets show × on hover; seeded widgets do not
- [ ] Widget with widget-scope filter rule shows purple `widget-local-stripe`

### Chat (every module)

- [ ] Floating "ask me anything!" pill renders in the bottom-right corner
- [ ] Pill hides when chat panel is open or in synthetic data mode
- [ ] Panel slides in from the right (440px wide), with mascot header + greeting + message list + input + starter chips
- [ ] Empty-state greeting renders when `chatMessages.length === 0`
- [ ] Send fires `POST /api/chat/start` on first message, `POST /api/chat/respond` on subsequent
- [ ] Polling loop runs against `/api/chat/poll` with `waitMs: 8000` until terminal
- [ ] Processing messages render as muted sub-lines; thinking dots show during in-flight
- [ ] 4 starter prompt chips visible only when chat has no messages yet
- [ ] Starter prompts are tailored to this project's KPIs / breakdowns (not generic Mixpanel boilerplate)
- [ ] Enter sends, Shift+Enter newlines

### Interaction

- [ ] Single-click on a chart datum is hover/inspect only — never drill
- [ ] Drill produces a toast: `Drilled — {field} = {value}`
- [ ] `↶ Back (n)` button appears in the drill chip row when `drillHistory.length > 0`
- [ ] Right-click on a chart datum opens the context menu
- [ ] Right-click on a filter chip toggles lock
- [ ] Hash routing works: `#section-id` → switches section; refresh preserves
- [ ] URL filter params hydrate state on load

### Performance

- [ ] First paint < 1 second (no blocking requests before chrome renders)
- [ ] Total network during first paint ≤ 4 requests (3 CDN scripts + 1 data call)
- [ ] No re-renders of unchanged sections when filters change

---

## Pitfalls (from prior iteration, reproduced for re-skim)

1. Tailwind v3 Play CDN — `[var(--token)]` works, `[--token]` silently transparent.
2. ECharts events on narrow horizontal bars are flaky — drill always uses all 4 affordances.
3. Single-click drill caused user confusion — single-click is hover/inspect only.
4. Closing slicers on value pick broke pivot-table semantics — slicers stay open.
5. Empty state from the date filter — default the range to **`all_time` on every source**, not a relative preset. The deployed app filters against the user's browser clock, so any `last_30d/90d` default renders zero when the data isn't in that window (back- or future-dated data is common). Narrow only if `maxValue` is verified in-window.
6. `localStorage` throws in Safari private mode — always wrapped.
7. Relative `./api/` paths only — leading-slash paths bypass auth cookie.
8. Probing Prism during interview wastes turns — `## Project Schema` is authoritative.
9. Inventing column names — every identifier must appear in the schema YAML.
10. KPI cards without sparklines feel sparse — every KPI gets a 36 px sparkline (or `—` if no time data).
11. **DuckDB-only dialect.** `INITCAP`/`NOW`/`DATEADD`/`IFNULL`/`NVL`/`LISTAGG`/`::type` do **not** exist in DuckDB — a single one makes that source's query error and return zero rows (and with multiple sources, no banner shows — just an empty tab). Use `CAST/TRY_CAST/COALESCE/NULLIF/strftime/strptime/json_extract_string/CASE`; do casing/formatting in JS. Validate every query against a local DuckDB (`pip install duckdb`, mock tables) before zipping — offline, so it's compatible with "never probe the live endpoint."
12. **Use ALL connected data, not just Prism.** Linked API gateways (Meta/`fbads`, Google Ads, CRMs) often have no Prism table — their data lives only behind `./api/gw/{name}/...`. A Prism-only build silently omits them (e.g. Meta campaigns never appear though the gateway is linked). Enumerate `## Linked API Gateways` in the interview, fetch each relevant one, and merge its normalized rows into the matching rowset.

---

*End of design system. Read shell/index.html next to see all of this composed.*
