# Interview answers — pre-filled choices for scripted mode

> Drop this file (renamed to `interview-answers.md`) into the project's working directory
> alongside `project-spec.md`. When present, the agent skips the interactive interview
> and applies these answers directly. Use for reproducible tests, CI regression runs, or
> recorded demos where you need the same input → same output every time.
>
> Format: human-readable markdown. Every key is required unless marked "(optional)".
> If a key is missing or set to `auto`, the agent falls back to the deterministic
> default it would have computed (e.g. freshness heuristic, slicer rule).

---

## ⚡ v2 — capture these fields on top of the stages below

A v2 app is **multi-tab and config-driven**: the build fills one `APP_CONFIG` object. In addition
to the v1 fields below, record:

- **data_sources:** the registry — each `source` is `{kind:'prism', prism, dateCol, defaultPreset}`
  or `{kind:'rest', base, map}`.
- **sections[]:** one per tab — `{id, label, icon, subtitle, layout, source}` where `layout` ∈
  `kpi-grid | breakdown-grid | data-table | funnel | comparison | optimize`.
  - **subtitle** (required per tab): one sentence — what it measures + how it's broken down.
  - **kpis[]:** each `{label, agg, expr, format, favorableUp, tooltip}` — `agg` and `tooltip` are
    REQUIRED. `agg` is `sum | avg | distinct | ratio`. For any **rate/ratio** (ROAS, CTR, CPA,
    conversion rate) use `agg:'ratio'` with `{num, den}` (raw additive columns) → `SUM(num)÷SUM(den)`.
    Never `sum` a rate, and never `avg` a per-row ratio column (principle 2b).
  - **charts[]:** `{title, metric, agg, dimension, type, sort, palette}` — a ratio metric uses
    `agg:'ratio'` + `{num, den}` (on a `dualAxis`, the right axis uses `aggY:'ratio'` + `{numY, denY}`).
  - **table:** `{columns:[{key,label,type,sortable,num,den}], filters:[{field,label,kind:'select'}], derived, rules}`
    — give `ratio`/`percent`/`perunit` columns `num`/`den` so the totals row pools them (else it shows `—`).
  - **funnel** (when `layout:'funnel'`): `{identity, steps:[{name, rate|sql}]}`.
  - **optimize** (when `layout:'optimize'`): `{thresholds, gateways:{<source>:{canWrite}}, deepLink}`.
- **optimize_offer:** `yes`/`no` — set `yes` only when the schema is campaign/ads-like (cost +
  outcome + entity id/name + changeable status); then include an `optimize` section.
- **copy_summary_offer:** `yes`/`no` — set `yes` only for a campaign-**performance** `data-table` the
  user would share into Slack/chat; then compose the `copysummary` module and set
  `table.copySummary: true` on that section (see `modules/copysummary/COPYSUMMARY_MODULE_SPEC.md`).
  Every other table automatically gets a plain **"Copy view"** button from the base shell — do NOT set
  `copySummary` on non-performance tables (that is what leaves them the plain button).

The v1 stages below still capture intent/identity/data-binding/slicers/KPIs/sections/saved-views;
the v2 fields above extend them to the per-section, multi-tab model.

---

## Stage 1 — Intent

- **module_type:** `dashboard`   # one of: dashboard | funnel | comparison | catalog
- **purpose:** "Monitor paid-media ROI across campaigns — spend, conversions, CTR — so the growth team knows which campaigns to scale or cut."

## Stage 2 — Identity

- **name:** Paid Media Performance
- **slug:** paid-media-performance
- **initial:** P                            # single letter for the sidebar logo
- **workspace_label:** Breeze Analytics     # (optional) defaults to name

## Stage 3 — Data binding

- **selected_tables:** [google_ads_spend_rev]  # all prism short names the user selected as in-scope for this app
- **primary_prism:** google_ads_spend_rev      # short tail of the prismview name; agent resolves to the full identifier
- **secondary_prisms:** []                     # (optional) list of extra prism short names
- **date_column:** Date                        # exact column name, or `none` for catalog-mode
- **default_preset:** auto                     # `auto` (freshness heuristic) or one of: last_30d | last_90d | mtd | qtd | ytd | last_12m | all_time | custom

## Stage 4 — Slicers

- **pinned:** [Campaign, Spend, CTR]        # 3–6 fields from the auto-derived survivor set
- **slicer_overrides:** {}                  # (optional) e.g. { region: chip_with_search } to override the auto-decided type

## Stage 5 — KPIs (dashboard) / Steps (funnel) / Ranking (comparison)

### For dashboards — list 3–6 KPIs:

- label: Total Spend
  sql: SUM(Spend)
  format: currency       # currency | integer | percent | duration
  favorable_up: false    # true = up is good (green pill on up); false = inverted

- label: Total Conversions
  sql: SUM(Conversions)
  format: integer
  favorable_up: true

- label: CTR                                  # a rate — pooled, not "Avg" of per-row CTR (principle 2b)
  sql: SUM(Clicks) * 1.0 / NULLIF(SUM(Impressions), 0)   # config form: agg:'ratio', num:'clicks', den:'impressions'
  format: percent
  favorable_up: true

- label: Avg Conversion Rate
  sql: SUM(Conversions) * 1.0 / NULLIF(SUM(Clicks), 0)
  format: percent
  favorable_up: true

- label: Cost per Conversion
  sql: SUM(Spend) * 1.0 / NULLIF(SUM(Conversions), 0)
  format: currency
  favorable_up: false

- label: Total Impressions
  sql: SUM(Impressions)
  format: integer
  favorable_up: true

### For funnels — list ordered steps instead:

# - name: Landing
#   predicate: path = '/'
# - name: Product view
#   predicate: viewed_product = 1
# identity_column: session_id
# window: same session

### For comparisons — group + metrics:

# group_by: campaign_session
# metrics:
#   - { label: Revenue, sql: SUM(revenue), format: currency }
#   - { label: CTR, sql: SUM(clicks)*1.0/SUM(impressions), format: percent }

## Stage 6 — Sections / Nav

# Each entry becomes one sidebar item and one x-show section block in the HTML.
# icon must be a key from the ICONS map: bars | grid | flask | funnel | globe | search | users | megaphone | layers | support | settings
# prism is the Prism model id that backs this section's data queries.
# Add only sections you intend to build out — there are no coming-soon stubs.

- sections:
  - id: dashboard
    label: Dashboard
    icon: grid
    prism: google_ads_spend_rev          # resolves to the full prismview id — use primary_prism short tail here
    purpose: "Main KPI overview, time-series, and channel/device breakdowns"

# Add more sections as needed, e.g.:
# - id: campaigns
#   label: Campaigns
#   icon: megaphone
#   prism: google_ads_campaigns
#   purpose: "Per-campaign spend, conversions, and CTR breakdown"

## Stage 7 — Layout

- **layout:** default                       # `default` accepts the module-type's standard layout; otherwise inline the section list

## Stage 7.5 — Chat starter prompts

- **chat_starters:** auto                   # `auto` generates from KPIs + breakdowns; otherwise provide explicit list:
# chat_starters:
#   - "Which campaign has the worst Cost per Conversion?"
#   - "What's driving CTR up this period?"
#   - "Compare Total Spend by campaign."
#   - "Show me an underperforming campaign."

## Stage 8 — Saved views

- **saved_views:** []                       # (optional) initial savable view presets
# saved_views:
#   - name: "Top 3 campaigns"
#     state:
#       filters: { Campaign: [Spring_Collection, Brand_Awareness, Holiday_Promo] }

## Post-build modifications

> Plain-English bullets describing changes made after the interview was confirmed.
> Only include things that diverge from what the interview answers would produce by default.
> Omit this section (or leave it empty) if the build matched the interview exactly.
> Generated automatically when the user says "export my choices" during or after the build.

# - Changed primary chart from bar to line
# - Removed the "Experiments" nav section
# - Added a "By Region" breakdown card (SUM(revenue) grouped by region)
# - Renamed KPI "Sessions" to "Unique Visitors"

---

## Validation

When the agent reads this file it MUST verify:

1. `module_type` is one of the four supported values
2. All entries in `selected_tables` resolve to entries in `project-spec.md`'s `## Project Schema`
3. `primary_prism` is a member of `selected_tables`
4. The selected tables pass the compatibility check for the chosen `module_type` (see README Stage 3b)
5. `date_column` exists in the primary prism (or is `none` for catalog mode)
6. Every `pinned` slicer is in the auto-derived survivor set (derived only from `selected_tables`)
7. Every column referenced in a KPI's `sql` exists in the primary prism's columns
8. `chat_starters` is `auto` OR an array of 3–5 strings
9. The number of KPIs / steps / metrics is within range for the module type

On any validation failure, the agent stops, reports which key failed, and asks
the user to fix the file before proceeding. It does NOT silently fall back to
the interactive interview — that would defeat the deterministic guarantee.
