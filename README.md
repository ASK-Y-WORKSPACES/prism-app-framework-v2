# Prism App Framework — v2

> Build one polished, **multi-tab** Alpine.js SPA per Prism project. Single `index.html`
> deployed to the Asky apps subdomain. No build step.

This README is the entry point for Claude Code. Read top to bottom before doing anything.

---

## ⚡ v2 — READ THIS FIRST (supersedes any conflicting v1 text below)

The stack is unchanged (single-file Alpine + Tailwind v3 CDN + ECharts + inline SVG). What
changed is **how you build**: fill one config object, and apps are **multi-tab** by default.
See `CHANGELOG.md` for the full v1→v2 diff.

**The build is interview-driven. ASK THE USER THE QUESTIONS — don't guess the app.**
The primary, default way to build is to **run the interactive interview** (the "Interview
protocol" section below, Stages 1–8): you ask the user about module type, name/slug, which
tables, the primary prism + date column, which slicers to pin, KPIs, sections, and saved views.
**Their answers are the build** — they fill the single `APP_CONFIG` object. This is the whole
point of the interview: you cannot build the right app without asking. Use `AskUserQuestion` for
discrete choices, plain text for open-ended ones.

> **Scripted mode is the exception, not the default.** Only skip asking when a pre-filled
> `interview-answers.md` already exists in the working dir (see "scripted mode" below). When it's
> absent — which is the normal case — you MUST run the interactive interview. Do not silently
> invent answers or jump straight to editing code.

**The build is config-fill, not JS surgery.** After the interview, clone the matching starter
(`presets/<type>/index.html`, or `base/index.html` for a minimal core-only app) and edit the
single **`APP_CONFIG`** object at the bottom of `<script>`. Do **not** hand-author per-section
HTML — the generic `<template x-for="sec in sections">` renderer builds every tab from config.

**`APP_CONFIG` shape:**
```js
const APP_CONFIG = {
  title, appInitial, appSlug, logo,   // logo: optional image URL/data-URI shown in the sidebar instead of the initial
  workspaceId, projectId,
  dataSources: { primary:{kind:'prism', prism, dateCol, defaultPreset},
                 /* or */ ads:{kind:'rest', base:'./api/ads', map:j=>j.rows} },   // registry (point 10)
  slicers: [ {id, label, field, type:'chip|date|numeric', scope:'global'} ],
  pinnedSlicers: [...],
  sections: [{                                   // each entry = one TAB
    id, label, icon, subtitle,                   // subtitle = "what this measures + how broken down"
    layout: 'kpi-grid|breakdown-grid|data-table|funnel|optimize',
    source: 'primary',
    kpis:  [{label, agg:'sum|avg|distinct', expr, format, favorableUp, tooltip}],  // agg + tooltip REQUIRED
    charts:[{title, metric, agg, dimension, type:'line|bar|rankedBar|donut', sort, palette}],
    table: { columns:[{key,label,type,sortable}], filters:[...], derived:[...], rules:[...],
             sectionGroupBy:'platform',   // optional: group rows under per-field section headers, ordered by total spend desc
             rowDetail:'daily',           // optional: each row expands to a per-day breakdown (Date/Spend/Impr/Clicks/CTR/CPC/Conv/CPA)
             copySummary:true },          // optional: requires the `copysummary` module — "Copy Performance Summary" button (HTML table + TSV)
  }],
  chatStarters: [...],
  optimize: null,   // campaign apps may attach an OptimizeConfig — see OPTIMIZE_MODULE_SPEC.md
};
```

**Rules the framework enforces (from the design brief):**
- **Every KPI states its aggregation** (`agg`) and carries a `tooltip`. Totals/counts → `sum`;
  rates/ratios/per-unit costs (CTR/ROAS/CPC/CPA) → `avg`. **Never `sum` a rate or ratio.**
- **Every tab has a one-sentence `subtitle`** describing what it measures and how it's broken down.
- **Any dimension that breaks down a chart is also offered as a filter.**
- **Drill = single-click → peek popover → `Dig in`** (see DESIGN.md). Not double-click.
- **Chat is a real 4th filter scope.** Filtering, drilling, tooltips, widget builder, and chat
  are ON in every app and every layout.
- Number/date formatting + visual-design rules: see DESIGN.md (normative).
- **v2.1 (every app, inherited by default — see DESIGN.md §v2.1):**
  - **Marketing sources have two kinds.** Each `dataSources` entry declares `category:'ad'|'analytics'`
    (+ `provider`). Ad = spend/impressions/clicks/CTR/CPC/platform conversions (no sessions); analytics
    = sessions/on-site behavior/attributed revenue (no spend). Never sum spend onto analytics rows or
    attribute sessions to ad rows.
  - **Every metric explains itself.** Every KPI / chart series / table column carries `source` + `tooltip`
    and shows them on hover **immediately** (what it is · how it's calculated · which source). Mandatory.
  - **One data-mode source of truth.** The toggle calls `setDataMode()`; Synthetic⇄Real does a full,
    idempotent reload both ways — never a stale relabel.

**Prism AI chat — ALWAYS on, never asked.** Every app ships with the Prism AI chat panel (the launcher +
chat panel are already in `base/` and every module-type starter). Include it in **every** app by default
and **do not raise it as a question in the interview** — it is not optional. (Stage 6.5 still auto-derives
the starter prompts, also without a user turn.)

**Optimize tab (optional add-on — offer only for campaign/ads data).** If the selected data looks like
advertising data (a cost metric + an outcome metric + a campaign/ad name + a status you can change),
**offer** this ready-made module in plain language — name it as a module, say what it does, what they'll
see, and that it's optional:
> *"We've built a ready-made **Optimize module** you can add: it gives your app an **'Optimize' tab** that
> reviews all your campaigns, flags the ones wasting money and the ones worth spending more on, and drafts
> the changes for you to approve — anything you approve gets applied to your ad platform, and it checks the
> results a week later. Want to add this module, or keep the app view-only for now? You can add it later."*

If yes, add a section with `layout:'optimize'` and an `OptimizeConfig` per `OPTIMIZE_MODULE_SPEC.md`.
Never offer it for non-campaign apps — it would just confuse the user.

**"Copy" buttons on tables.** Every table already gets a **Copy** menu automatically (base shell) with
**Copy as table** (a real table on the clipboard — rich HTML for Docs/Slack + TSV for Sheets) and **Copy
as image** (a PNG of the view) — so there's nothing to ask about for ordinary tables; do **not** raise it.
The **only** copy question is an *upgrade* offer for a campaign-performance table, and only when one
exists. Name it as a module:
> *"We've built a ready-made **Copy summary module** for campaign tables — it adds a button that, in one
> click, copies a tidy formatted version (totals per platform, day-by-day) you can paste straight into
> Slack, email, or a doc. Want to add it to your campaigns table? Optional — the table already copies its
> plain rows without it."*

If yes, compose the `copysummary` module and set `table.copySummary: true` on that section (per
`modules/copysummary/COPYSUMMARY_MODULE_SPEC.md`). Do **not** set `copySummary` on any non-performance
table — leaving it off is what gives it the plain automatic button.

**Metric `tooltip` text — keep it SHORT.** Each KPI / chart / column `tooltip` should be one short line in
the form `<calculation> — <plain one-line meaning>` (e.g. `SUM(revenue) ÷ SUM(spend) — dollars back per
dollar spent.`). Don't restate the range or add colour/comparison explainers — the info popover already
adds the **Source** line automatically, and the value/delta are self-evident. The hover tooltip shows
exactly three things: what the metric is, how it's calculated, and where it comes from.

**Interview additions (v2):** per Stage, also capture — per-tab `subtitle`; **per-KPI `agg`** —
`sum` / `avg` / `distinct`, and **`ratio` (with `num`/`den`) for any rate or ratio** (ROAS, CTR, CPA,
conversion rate): a ratio is `SUM(num) ÷ SUM(den)`, never `avg` of a per-row ratio column (principle
2b); mirror the same `num`/`den` on the matching `ratio`/`percent`/`perunit` table column so its totals
row pools correctly. Also capture each section's `layout` + `source`; section-scoped table `filters`;
the Optimize offer when the schema qualifies; and the Copy Performance Summary offer when the app has a
campaign performance table. Everything below describes the v1 interview; apply these additions on top.

---

---

## Repository layout (v2 — composable)

Each component lives in its own folder, so you can take **only the base**, or the
base **plus the modules you want**.

```
prism-app-framework-v2/
├── base/            ← the foundation, runs standalone (kpi-grid / breakdown-grid
│                       / data-table / comparison + filter / drill / chat / widgets
│                       / formatting / connections). Carries inert @MODULE:* markers.
├── modules/
│   ├── funnel/      ← optional `funnel` section layout (chart + step drop-off)
│   └── optimize/    ← optional `optimize` layout (recs→stage→deploy→verify) + its spec
├── components/      ← UI primitive snippets (reference atoms; base inlines them)
├── connections/     ← the data contract + helpers (CONNECTIONS.md, connections.js,
│                       dev-proxy.mjs). Inlined into base; foundational, not optional.
├── presets/         ← ready-made composed apps: dashboard (base+funnel+optimize),
│                       funnel, comparison, catalog, optimize
├── compose.py       ← base + chosen modules → a deployable single-file index.html
├── templates/       ← interview-answers template (scripted mode)
└── README.md · DESIGN.md · FRAMEWORK_SPEC.md · CHANGELOG.md
```

**Pick your starting point:**
- *Just the base* → copy `base/index.html`, fill `APP_CONFIG` with core-layout sections.
- *Base + a module* → `python3 compose.py funnel` (or `optimize`), or copy the matching `presets/<name>/`.
- *Everything* → `presets/dashboard/` shows all layouts + both modules in one app.

**Connections + the project-spec:** the user also attaches a **project-spec** that
supplies the connection *values* (app slug, workspace/project ids, named table ids,
provider/account). The framework already knows *how* to connect — see
`connections/CONNECTIONS.md`. No secret is bundled: deployed apps authenticate via
the same-origin session cookie.

---

## Pitfalls — read first

1. **Don't author from scratch.** Always clone a starter — `presets/<type>/index.html` (or `base/index.html` for a minimal core-only app) — and edit. Blank-start = sparse output.
2. **Match Mixpanel / Amplitude / Linear** for visual density. If output looks sparser than these, polish checklist failed.
3. **Drill is double-click + axis label + ▶ prefix + HTML pill row.** All four affordances, every drillable chart. Single-click is never drill.
4. **Slicers stay open on value pick.** Only × dismisses.
5. **`bg-[var(--token)]` not `bg-[--token]`** — the second silently renders transparent on Tailwind Play CDN.
6. **Relative API paths only** (`./api/...`). Leading-slash paths bypass the deployed slug's auth cookie.
7. **Don't probe Prism during the interview.** The project brief has every column statistic the interview needs.
8. **Default the date range to `all_time` for EVERY source — always, not just for old data.** The deployed app filters against the *user's browser clock*, but Prism data is frequently back- or future-dated, so any relative default (`last_30d/90d`) silently renders every card empty when the data isn't in that window. Only narrow the default if the data's `maxValue` is verified inside the window. Symptom of getting this wrong: real mode, no error banner, all KPIs zero / charts blank.
9. **Every identifier you write must appear verbatim in the project schema YAML.** No invented column or table names.
10. **`localStorage` always wrapped via `safeGet`/`safeSet`** — Safari private mode throws.
11. **Never probe the live data endpoint after building.** Once the zip is ready, output deploy instructions and stop. Do not curl, WebFetch, or validate SQL against the *deployed* app, and do not ask the user for an app token. (This does NOT forbid pitfall #13's local-DuckDB check — that runs offline against mock tables, never the live endpoint.) If a query might be wrong, note the assumption as a comment inside `index.html`.
12. **DuckDB dialect ONLY — no Postgres/Snowflake-isms.** The engine is DuckDB. Banned in generated SQL: `INITCAP`, `NOW()`, `GETDATE()`, `DATEADD`/`DATEDIFF`, `IFNULL`/`NVL`, `LISTAGG`, `x::type` shorthand. A single unsupported function makes that source's query error and return zero rows — and if only *some* sources fail there is no error banner, just empty tabs. Keep SQL to `SELECT … CAST/TRY_CAST/COALESCE/NULLIF/strftime/strptime/json_extract_string/CASE`; do all casing/labeling/formatting (e.g. title-casing device names) in the **JS normalizer**, never in SQL.
13. **Validate every generated query against a local DuckDB before zipping.** `pip install duckdb`, create mock tables matching the schema column names/types, and run each loader's exact SQL string. This is offline (no live endpoint, no cookie — compatible with #11) and catches dialect errors like #12 pre-deploy. If `duckdb` can't be installed, hand-audit every function against the DuckDB function list.
14. **Fail loud per source — never silently empty.** When an app has multiple `dataSources`, a single failing query must surface its own banner (`"<provider> query failed: <ErrorMessage>"`), not just yield an empty tab. Only show the generic "no endpoint reachable" banner when *all* sources fail. Silent per-source zeros read as "no data" and hide the real bug.
15. **Prism tables are NOT the only data — use every connection.** The project-spec's `## Linked API Gateways` section lists connections (Meta/`fbads`, Google Ads, CRMs, …) that frequently have **no Prism table**; their data is reachable only via `/<slug>/api/gw/{name}/...`. Source from Prism **and** every relevant gateway, normalizing + merging gateway rows into the matching rowset — otherwise that platform's data is silently absent (the *"my Meta campaigns don't show"* bug). Send `X-Workspace-Id` + `credentials:'include'` on gateway calls, and add a synthetic generator so demo mode mirrors the gateway too. See interview Step 3a.5.

---

## What you need before starting

- This framework folder (`prism-app-framework/`)
- A populated `project-spec.md` for the target project — must contain `## Project Context` (workspace/project IDs, app slug), `## Project Schema (Prism Tables)` with column statistics, and an empty (or partial) `## App` section

If `## App` is empty, you run the interview to fill it. If partial, resume from the first incomplete stage.

### Optional: scripted mode (`interview-answers.md`)

If a file named `interview-answers.md` exists in the working directory alongside `project-spec.md`, the agent operates in **scripted mode**:

- **Skip the interactive interview** — read every choice from the file.
- **Validate** that each answer is consistent with `project-spec.md`'s schema (primary prism exists, pinned slicers are in the survivor set, KPI SQL references real columns, etc.). On any validation failure, stop and report which key failed — do NOT silently fall back to interactive.
- **Still apply deterministic logic** for any key set to `auto` (e.g. `default_preset: auto` runs the freshness heuristic; `chat_starters: auto` generates from KPIs and breakdowns).
- **Still echo the locked choices** in the conversation so the recording / log shows the flow, just without the chip selectors.

Use scripted mode for: reproducible regression tests (same input → same output), CI runs, recorded demos with known-good output. Template lives at `prism-app-framework/templates/interview-answers.template.md` — copy it to the working directory and rename.

When `interview-answers.md` is absent, the interview runs interactively as below.

---

## Build process — end-to-end

> ⛔ **Never write `index.html` from scratch.** Always clone the starter (step 4) first, then
> apply targeted edits. Writing the full file in one shot hits Claude Code's 32 k output-token
> limit and produces sparser output. Pitfall #1 in the list above exists for exactly this reason.

1. Read `DESIGN.md` (tokens + reference targets + polish checklist) — once.
2. Read `project-spec.md`'s `## Project Schema` — sources of truth for column stats and prism names.
3. **Check for `interview-answers.md` in the working directory.**
   - If present → enter scripted mode (validate file, apply choices, emit `## App`).
   - If absent (the normal case) → **run the interactive interview below — ask the user the
     Stage 1–8 questions** — to fill `project-spec.md`'s `## App` section. Never skip asking.
4. **Clone the starter — do this before writing any code:**
   ```bash
   cp prism-app-framework-v2/presets/<type>/index.html <working-dir>/index.html
   ```
   `<type>` is the module type from Stage 1 (`dashboard`, `funnel`, `comparison`, `catalog`, or
   `optimize`). Or compose a custom set with `python3 compose.py <module> …`, or start from
   `base/index.html` for a minimal core-only app. All subsequent steps are **Edit-tool operations
   on this file** — never a full rewrite.
5. Replace identity tokens with `sed` or the Edit tool: `__APP_NAME__`, `__APP_INITIAL__`, `__WORKSPACE_ID__`, `__PROJECT_ID__`, `__APP_SLUG__`.
6. Fill nav, KPIs, sections, slicer registry, and seeded widgets from `## App`.
7. Copy additional primitives from `primitives/` for slicer types referenced by the slicer registry (only if not already inline in the module-type starter).
8. Run the polish checklist (DESIGN.md §end).
9. Zip the working `index.html` at root. Output deploy instructions **and always state the exact path where the zip was saved** — e.g. *"Saved the app to `/Users/…/my-app/my-app.zip`"* — so the user can find it immediately. Never end the build without naming the file's location.
10. **Update `interview-answers.md`** — append or refresh the `## Post-build modifications` section to capture any changes made after the interview (see "Export my choices" below).

---

## "Export my choices" command

At any point during or after the build, the user can say **"export my choices"** (or equivalent: "save this session", "capture what we built"). When this happens:

1. If `interview-answers.md` does not exist yet, write it now using the scripted format (Stage 8 of the interview protocol).
2. Append or replace the `## Post-build modifications` section with a plain-English bullet list of every change made to `index.html` **after** the interview was confirmed — things that are not expressible from the interview answers alone. Examples:
   - Changed primary chart from bar to line
   - Removed the "Experiments" nav section
   - Added a "By Region" breakdown card with `SUM(revenue)` grouped by `region`
   - Increased default date preset from last_30d to last_90d
   - Renamed KPI "Sessions" to "Unique Visitors"
3. Keep bullets factual and re-applicable — a future build agent reading this list must be able to reproduce the intent. Avoid vague phrasing like "improved the layout."
4. Do **not** record changes that are already captured by the structured interview fields (KPI list, slicers, module type, etc.) — only record divergences from what those fields would produce by default.

**Replay behavior (scripted mode):** When `interview-answers.md` is loaded in scripted mode and a `## Post-build modifications` section is present, the build agent applies it as a final pass after the normal build completes. Each bullet is treated as a natural-language instruction. The agent re-applies them in order, then re-runs the polish checklist.

**Determinism caveat:** Modifications are re-interpreted by the LLM on each replay, so two runs may implement the same bullet slightly differently. This is acceptable for "share intent between people" use cases. For pixel-perfect reproduction, the `index.html` artifact itself is the source of truth.

---

## Interview protocol — RUN THIS BEFORE EDITING ANY CODE

You are the interview agent. **The `## App` section is the ONLY part of `project-spec.md` you write.** Everything else (API contract, SQL rules, schema) is fixed.

### Self-contained — do NOT probe Prism

Do not call MCP tools, WebFetch, WebSearch, Bash, or any HTTP client. Do not ask the user to paste the schema. The `## Project Schema` section of `project-spec.md` is the authoritative catalog. Slicer-type decisions are deterministic functions of each column's `statistics` block — no live probes, no clarifications about what data is available.

### Rendering questions

For 2–4 discrete options (module type, prism choice, default preset, confirmations): use `AskUserQuestion`. For open-ended turns (names, KPI definitions): plain text. For multi-select (which slicers to pin, which saved views): `AskUserQuestion` with `multiSelect: true`.

#### Speak plain — the person you're interviewing is not technical

**The user building the app is often a first-time, non-technical person. Every question and option label you SHOW them must be understandable by someone who has never seen this framework.** The internal variable names below (`module_type`, `slug`, `slicers`, `kpis`, `prism`, `gateway`, `default_preset`, `agg`, `layout`) are for YOU — never surface them in a question. When you phrase a question:

- **Avoid framework-internal jargon.** The user is semi-technical, not an engineer: everyday analytics terms are fine, but our internal plumbing names are not. Don't say "slug", "slicer", "prism", "gateway", "preset", "predicate", "cardinality", "dimension" — use an everyday word and explain it in the same breath ("a short web address", "quick filters at the top"). Common terms the audience DOES know — **"KPI" / "KPI cards"**, "filter", "chart", "table", "dashboard" — are fine to use as-is; no need to translate those.
- **"Module" is OK — use it for the pre-built add-ons.** We ship ready-made **modules** for specific needs (e.g. the campaign **Optimize** module, the **Copy summary** module) that the user can plug into their app. Saying "we've built a ready-made **module** that does X — want to add it?" actually *helps*: it signals this is a proven, one-click feature they're choosing to include, not something being custom-built. So use the word "module" for these optional add-ons — just always pair it with a plain sentence on what it does. (Don't use "module" for the app *type* in Stage 1 — there, describe the kind of app by outcome.)
- **Describe options by what the user GETS, not by their internal name.** "Funnel" means nothing to them — "See where people drop off on their way to converting (step-by-step)" does.
- **Always give a concrete example** in the phrasing, drawn from their own data/purpose when you can.
- **For every optional module / add-on (extra tabs, buttons, features): say (1) that it's a ready-made module they can add, (2) what it does in one plain sentence, (3) what they'll see if they say yes, and (4) that it's optional and skippable.** Never assume they know why they'd want it.
- **Offer a sensible default** and let them just accept it ("If you're not sure, I'll pick X — you can change it later.").

The exact wording in the stages below is a *starting point* — adapt it to the user's own words and data, but keep it this plain.

### Stages

#### Stage 1 — Intent

Ask, in plain words: *"What do you want this app to help you or your team do? In one sentence, what should someone be able to see or decide when they open it?"*

Then let them pick the **kind of app** — show the four options described by **what they do**, never by their internal name. **Always let the user choose; never recommend or pre-select:**

| Show them (plain label + what it does) | Internal `module_type` | Pick when they say… |
|---|---|---|
| **Track the numbers** — a dashboard of key numbers and trends over time ("how are we doing?") | dashboard | "KPIs", "monitor", "overview", "how are we doing" |
| **See where people drop off** — a step-by-step view of a journey, e.g. visit → add to cart → buy | funnel | "conversion", "drop-off", "checkout flow", "step-by-step" |
| **Compare and rank** — a leaderboard of who/what is doing best ("top performers", "A vs B") | comparison | "leaderboard", "top performers", "A vs B" |
| **Browse & search records** — a searchable table of your data, no time needed | catalog | "browse the data", "search", no time dimension |

Do **not** infer the kind of app from the data or make a recommendation. Present all four in plain terms and wait for the user's explicit choice. If their description is ambiguous, name the two most likely (in plain terms) and ask which they mean.

Lock: `module_type`, `purpose`.

#### Stage 2 — Identity

*"What should we call the app?"* Then, in plain terms: *"And a short web address for it — just lowercase words with dashes, like `growth-dashboard`. This is the bit that appears in the link people open. If you're not sure, I'll suggest one from the name."* (Derive a kebab-case slug from the name as the default.)

Then **always ask about a logo** (never skip this — it's a quick, high-impact touch): *"Want to add your own **logo** for the app? It shows in the top corner instead of a letter badge. Paste a link to an image (or upload one) — or skip and I'll just use the first letter of the name."* If given, set `APP_CONFIG.logo`; the sidebar shows the image in place of the initial. Leave `logo:''` to keep the letter badge.

Lock: `app_name`, `app_slug` (kebab-case), `app_initial` (first letter for the badge), `logo` (optional image URL / data-URI — **always asked**).

#### Stage 3 — Data binding

**Step 3a — Table scope (user chooses which tables feed this app)**

Read `## Project Schema` and list **every** prism available in the project — name, row count, and a one-sentence description of what it contains. Present all of them as a multi-select chip question:

*"Which of these sets of data should the app be able to use? Pick any that are relevant — you can change this later."* (List each with its plain one-line description and row count; don't show internal table names as the only label.)

The user must pick at least one. Do not pre-filter or hide tables. Every table the user does NOT select is excluded from this application's scope — the agent must never reference it in generated SQL.

**Step 3a.5 — Connected sources beyond Prism (API gateways) — REQUIRED, do not skip**

Prism tables are **not** the only data. The project-spec also carries a **`## Linked API Gateways`** section listing
every connection wired to this app (e.g. a Meta/`fbads` gateway, Google Ads, a CRM). **A platform can be connected
via a gateway and have NO Prism table at all** — its data is reachable only through `/<slug>/api/gw/{name}/...`.
Build from Prism tables alone and that platform's data is silently missing (the classic *"my Meta campaigns don't
show even though the Meta gateway is linked"* bug).

So enumerate gateways the same way you enumerate tables: read `## Linked API Gateways`, list each one (name, what it
serves), and ask *"Which of these connections should this app pull from?"* For every gateway the user includes:
- add a `dataSources` entry — `{ kind:'rest', base:'./api/gw/{name}', category:'ad'|'analytics', provider:'…' }`,
  or a custom loader for multi-call fetches (list accounts → per-account insights);
- **normalize its response into the SAME flat row shape** as the matching source and **merge** it into that rowset
  (e.g. Meta campaigns merged into the ad rows next to Google Ads), so every tab/KPI/Optimize works across both;
- send `X-Workspace-Id` + `credentials:'include'` on every gateway call (the `gw()`/`queryAny` helpers do this);
- load each connection independently with the per-source fail-loud guard (pitfall #14), and add a synthetic
  generator so demo mode mirrors it.

Treat a gateway with no Prism counterpart as a first-class source, not an afterthought.

**Step 3b — Compatibility check (auto, no user turn)**

After the user picks their tables **and gateways**, verify the chosen sources can actually support the module type from Stage 1 using these rules:

| Module type | Minimum requirement in selected tables |
|---|---|
| Dashboard | ≥ 3 numeric columns that can serve as KPIs |
| Funnel | ≥ 1 identity column (e.g. `session_id`, `user_id`) + ≥ 2 columns that can express step predicates (booleans, paths, event names, or counts) |
| Comparison | ≥ 1 low-cardinality categorical column (`distinctCount ≤ 50`) + ≥ 1 numeric metric column |
| Catalog | Any — catalog mode is always compatible |

If the check fails: stop, explain which requirement was not met, and ask the user to either (a) add a missing table from the project schema or (b) switch to a compatible module type. Do **not** silently continue.

**Step 3c — Primary prism + date binding**

From the user-selected tables, ask in plain terms which is the **main** one: *"Which of these is the main set of data the app should be built around?"* If the user selected only one, skip the question and use it.

For the primary prism, pick the date column in order:
1. Column named `event_date`, `session_date`, `date`, or ending in `_date` with `data_type in (date, datetime, timestamp)`
2. The column with the widest `minValue → maxValue` range among date-typed columns
3. None → catalog mode, skip date setup

Compute **data freshness** from `maxValue` vs. today:
- within 30 days → `default_preset: last_30d`
- within 6 months → `default_preset: last_90d`
- older → `default_preset: all_time` (tell user: *"data appears archival — defaulting to All time so the dashboard isn't empty"*)

Echo your picks in plain terms: *"I'll build this around **{primary_prism_friendly_name}**, use **{date_col}** for dates, and open on **{plain preset, e.g. 'the last 30 days'}**. Sound right?"* → Yes / Pick different. (If the data is archival, say so plainly: *"your latest data is a few months old, so I'll open on **All time** — otherwise the app would look empty.")*

Lock: `selected_tables[]`, `primary_prism`, `date_col`, `default_preset`.

#### Stage 4 — Slicers (auto-derive + pin)

Walk every column of the chosen prism(s) through this **deterministic rule**:

```
FOR EACH column:
  IF nullCount == totalCount                    → exclude (no data)
  IF isPrimaryKeyCandidate                       → exclude (identifier)
  IF cardinalityRatio >= 0.9                     → exclude (too unique)
  IF data_type in (date,datetime,timestamp)      → handled in Stage 3
  IF data_type is numeric AND distinctCount > 12 → NumericSlicer
  IF distinctCount <= 12                         → ChipSlicer (no search)
  IF distinctCount > 12 AND cardinalityRatio < 0.5 → ChipSlicer (with search)
  ELSE                                           → exclude (high-card text)
```

Present the survivors in plain terms — each as "filter by **{field}**" with a one-line "why it's useful" — and ask (multi-select): *"Which of these should be **quick filters** shown at the top, so anyone can narrow the numbers by them in one click (for example, only Mobile, or only one market)? Pick about 3–6."* If the user is unsure, say *"I'll pin these 4 to start — you can change them anytime"* and pin the top 4 by obviousness (usually channel / device / market / segment).

Lock: `slicers[]` (every survivor), `pinned_slicers[]` (user's choice).

#### Stage 5 — KPIs / Steps / Ranking

**Dashboard.** Frame it plainly: *"Here are the **KPI cards** I'd show at the top — the key numbers you'd want to see first. Keep the ones you care about, drop any you don't, and tell me if something's missing."* Propose 5 candidates derived from the chosen data (read the column descriptions and statistics). Internally format each as `label · metric_sql · format · favorable_up`, but show the user just the plain name of each KPI (e.g. "Total Revenue", "Conversion rate") — not the SQL. Show as a multi-select; user accepts/edits/removes. Defaults if terse: `format=integer`, `favorable_up=true`.

Typical proposals for event/analytics data: Total Revenue · `SUM(revenue)` · currency · ↑; Conversions · `SUM(conversions)` · integer · ↑; Conversion Rate · `SUM(conversions) * 1.0 / COUNT(*)` · percent · ↑; Sessions · `COUNT(*)` · integer · ↑; Avg Session Duration · `AVG(session_duration_s)` · duration · ↑.

For ads data: Spend · `SUM(spend)` · currency · ↑ (caveat: favorable_up depends on context); Revenue · `SUM(revenue)` · currency · ↑; ROAS · `SUM(revenue) / SUM(spend)` · ratio · ↑; CTR · `SUM(clicks) * 1.0 / SUM(impressions)` · percent · ↑; Conversions · `SUM(conversions)` · integer · ↑.

**Funnel.** *"Walk me through the steps users should pass through, in order."* Free text. For each step extract `name` and `predicate` (SQL WHERE fragment, e.g. `path = '/checkout'` or `purchases > 0`). Also ask `identity_column` (default `session_id`) and `window` (default same session).

**Comparison.** *"What are you ranking?"* Extract `group_by_column`, `metrics[]`.

#### Stage 6 — Sections / widgets

**Dashboard.** Propose the tabs in plain terms and confirm — e.g. *"I'll set up an **Overview** tab (your key numbers + a trend chart), plus one tab for each thing you filter by ({list the pinned filters in plain words}). Good, or want to add/remove a tab?"* Internally: Overview (KPI row + time-series chart) + one section per pinned slicer dimension.

**Funnel.** Default is fixed: Overview (funnel chart + step KPIs), Steps (drop-off table), Segments (faceted by top pinned slicer). Confirm.

**Comparison.** One Leaderboard section + small-multiples row. Confirm.

#### Stage 6.5 — Starter chat prompts (auto-generated, no user turn)

After Stage 6 layout confirmation, auto-derive 4 starter prompts for the chat panel based on the KPIs and breakdowns the user picked. Don't ask the user — generate from the App section.

**Dashboard pattern:**
1. *"Why did {KPI[0].label} change vs. prior period?"*
2. *"What {breakdown[0].field} is driving {KPI[1].label}?"*
3. *"Compare {KPI[2].label} by {breakdown[1].field}."*
4. *"Show me an anomaly in the last 7 days."*

**Funnel pattern:**
1. *"Where do most users drop off?"*
2. *"Compare conversion by {top-pinned-slicer}."*
3. *"What changed in the funnel last week?"*
4. *"Show me anomalies by step."*

These are the chips that show below the input when the chat has no messages yet. Lock as `chatStarters[]` in the App section.

#### Stage 7 — Saved views (optional)

Ask plainly: *"Optional: want any **one-click saved views** — a filter combination you can jump back to instantly, like 'Mobile, last 7 days'? Tell me any you'd use, or skip."* → Yes (collect via free text) / Skip.

#### Stage 8 — Confirm & emit

Show the full populated `## App` section as a fenced markdown block. Chip: *"Looks right?"* → Yes, build it / Let me edit.

On confirmation:
1. Append `## App` to `project-spec.md` (replacing any previous draft).
2. **Write `interview-answers.md`** in the working directory using the scripted-mode format from `templates/interview-answers.template.md`, filling in every choice made in this session. This makes any interactive run reproducible — anyone can drop the file into a fresh session and get identical output.
3. Proceed to step 4 of the build process above.

### Output format — the `## App` section

```markdown
## App

**Module type:** {dashboard | funnel | comparison | catalog}
**Name:** {app_name}
**URL slug:** {app_slug}
**Icon initial:** {app_initial}
**Purpose:** {one sentence}

### Data binding
- Primary prism: `{primary_prism_name}`
- Secondary prisms: `{...}` (or "none")
- Date column: `{date_col}` (or "none — catalog mode")
- Default date preset: `{last_30d | last_90d | all_time | …}`

### Filters
**All slicers (auto-derived):**

| Field | Type | Distinct | Notes |
|---|---|---|---|
| `channel_session` | ChipSlicer (no search) | 4 | Session-level traffic channel |
| ... | ... | ... | ... |

**Pinned to filter bar:** `channel_session`, `device_platform`, `region`, `purchase_history`

### KPIs (dashboard only)
1. **Total Revenue** — `SUM(revenue)` — currency — favorableUp: true
2. **Conversions** — `SUM(conversions)` — integer — favorableUp: true
...

### Steps (funnel only)
1. **Landing** — `path = '/'`
2. **Product view** — `viewed_product = 1`
...

Identity column: `session_id`. Window: same session.

### Ranking (comparison only)
- Group by: `campaign_session`
- Metrics: Revenue (currency), CTR (percent), Conversions (integer)

### Sections
1. **Overview** — KPI row + revenue-over-time line chart
2. **By channel** — bar chart + sortable table
...

### Saved views
- "Mobile last 7 days" — `device_platform=mobile_web`, `date=last_7d`
```

---

## Layout selection

After the interview, clone the matching starter:

| Module type | Starter |
|---|---|
| `dashboard` | `presets/dashboard/index.html` (base + funnel + optimize — all layouts) |
| `funnel` | `presets/funnel/index.html` |
| `comparison` | `presets/comparison/index.html` |
| `catalog` | `presets/catalog/index.html` (date controls hidden) |
| `optimize` | `presets/optimize/index.html` |
| minimal core-only | `base/index.html` (kpi-grid / breakdown-grid / data-table / comparison) |

Or compose a custom combination: `python3 compose.py funnel optimize` (base + the named modules).

---

## Token replacement

In the cloned starter, replace these tokens with values from `## App`:

| Token | Source |
|---|---|
| `__APP_NAME__` | `Name` |
| `__APP_INITIAL__` | `Icon initial` |
| `__APP_SLUG__` | `URL slug` |
| `__WORKSPACE_ID__` | Project Context |
| `__PROJECT_ID__` | Project Context |
| `__PURPOSE__` | `Purpose` |
| `__PRIMARY_PRISM__`  | Data binding — used in `loadAll()` real-mode queries |
| `__DATE_COLUMN__`    | Data binding — used in `buildWhere()` calls (empty string if catalog mode) |
| `__DEFAULT_PRESET__` | Data binding |

Then edit the `// CONFIGURE` blocks in the Alpine factory at the bottom of the file — they're commented and self-explanatory.

---

## Deployment

```bash
zip -r app.zip index.html   # zip at root, NOT nested
```

**Always tell the user the exact path of the zip you just wrote** (e.g. *"Saved to `/Users/…/my-app.zip`"*) — don't make them hunt for it. Then: upload via Asky's *Deploy Application* UI under the slug from `## App`. The app loads at `apps.ask-y.ai/{slug}/`.

---

*End of README. Read DESIGN.md next for the polish checklist.*
