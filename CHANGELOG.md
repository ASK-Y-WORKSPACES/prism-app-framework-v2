# Prism App Framework — v2 changelog

## v2.13.6 — KPI/chart/date-picker polish

- **Removed the KPI sparklines.** They plotted a synthetic sine wave (not real data) — decorative noise.
  KPI cards now show value + real period-over-period delta only.
- **Removed the "+ context" pill** (and its chart-subtitle text). The time-context window still applies at
  the default date state, but it's no longer surfaced as a pill (which confusingly vanished on date change).
- **Categorical bar / rankedBar charts use a distinct colour per category** (matching the donut/treemap),
  instead of one flat colour for the whole series.
- **Tooltips: shorter and clearer.** Removed the "Exact: …" hover on the KPI value. The comparison
  (delta) tooltip is now one line ("7.8% higher than the prior 30 days") — dropped the comparison-window
  and colour-explainer lines. The info tooltip shows exactly three things: what the metric is, how it's
  calculated, and its **Source** — with the reference `tooltip` text rewritten to be short *and* useful
  (period, direction, what the number represents).
- **Errors scope to where they happened.** A KPI that fails shows "Couldn't load this metric" in *that
  card*; a chart that fails shows "Couldn't load this chart" in *that chart*; only app-wide/data-load
  errors use the top banner (per-visual `k._err` / `c._err`).
- **Date picker.** The date button now always shows the **actual resolved dates** (e.g. "Jul 1 – Jul 30,
  2026") even for quick presets, not just "Custom". The picker is now a two-pane popover: the **full
  preset list on the left** (Today, 7/30/90 days, This/Last week, This/Last month, This quarter, This
  year, Last year, All time) and the **exact-date calendar on the right**. New `last_week` / `last_month`
  / `last_year` presets; `rangeDatesLabel()` formats the button.

## v2.13.5 — funnel: richer step-breakdown table

The funnel module's step table was rebuilt to answer "where and how badly does it leak" at a glance:

- **Numbered step markers** colour-matched to the funnel chart, so table ↔ chart read as one.
- **Inline proportional bar per row** (width = share of the top of the funnel) — the table now *shows*
  the funnel shape, not just numbers.
- **Absolute people dropped** next to the drop % — "Dropped: −12.75M (68%)" — colour-graded by severity,
  instead of only a drop-off bar.
- **Clearer columns:** Step · Reached (bar + count) · % of total · Continued (step-to-step conversion) ·
  Dropped (lost count + %).
- **Bottleneck call-out:** the worst step-to-step drop gets a "biggest drop" badge and a highlighted row.
- **Overall conversion** (last ÷ first step) shown in the section header.

(`computeFunnel` now returns `lost` per step and flags `isBottleneck`; `modules/funnel/layout.html`
renders the new table.)

## v2.13.4 — tables show ALL rows (scroll, no pagination)

Tables no longer paginate 50 rows at a time — they render **every row** inside a vertically-scrollable
box (`max-h-[65vh]`) with a **sticky header**, so all data is visible by scrolling. The totals row sits at
the bottom; the footer reads "Showing all N rows". A DOM safety cap (`tableDisplayCap`, 1000) renders the
first N of an unusually large set and says so — Copy still exports the full set. (`tableDisplay` no longer
slices by page; `tableShownLabel` replaces the Prev/Next pager.)

## v2.13.3 — per-column sort & filter, faster loads, freshness badge removed

- **Every table column has its own sort and filter, in the header.** A visible sort toggle (`⇅`, becomes
  `▲`/`▼`) on each sortable column, and a filter control (funnel icon) that opens a per-column popover:
  categorical columns (text/badge/status) get a **value checklist with a "Select all / Clear all"**
  toggle and a search box; numeric columns (currency/number/integer/perunit/ratio/percent) get a **min /
  max range**. Filters apply client-side and stack across columns; a **"Clear filters (n)"** chip resets
  them. This replaces the old toolbar filter chips. (`colFilterKind`/`colValues`/`toggleColValue`/
  `toggleColAll`/`colRange`/`setColRange`/`_applyColFilters`; `tableRowsAll` refactored around
  `_sectionRowsDerived`.)
- **Faster data loading.** (1) Categorical filters are applied **client-side only** — never pushed to the
  query — so toggling a filter never refetches. (2) Each source's fetched date window is **cached**; a
  reload refetches a source only when the needed window widens or the data mode changes (narrowing dates
  and every filter change are instant). (3) Sources load **in parallel** (`Promise.all`), and the
  `MAX(date)` as-of probe runs **once per data mode** and in parallel, instead of a serial query every
  reload. (`buildWhere` is date-only; `_rangeCovers`/`_loadedRange`/`_loadedMode`/`_asOfProbed`.)
- **Removed the "data through &lt;date&gt;" freshness badge** from the header for now (kept the loading
  indicator). The `_asOf` anchoring that drives the date presets is unchanged.

## v2.13.2 — table "Copy" menu: copy as table or as image

The plain per-table copy button is now a small **Copy** menu with two actions:

- **Copy as table** — the existing behaviour, writing a real table to the clipboard (rich HTML `<table>`
  for Docs/Slack/email + tab-separated text for Sheets/Excel), including the pooled totals row.
- **Copy as image** — renders the current view to a **PNG** and writes it to the clipboard (falls back to
  downloading the PNG when the browser blocks clipboard image writes). Hand-drawn on a `<canvas>` — no
  external library, no tainting: title + header + rows + pooled totals, numeric columns right-aligned,
  column widths measured from the text and capped, row stripes and gridlines, retina-scaled. Long cells
  ellipsize. (`copyTableImage`, `_truncateToWidth`.)

Applies to every table's automatic copy button (tables without `copySummary`); campaign-performance
tables keep the richer "Copy Performance Summary".

## v2.13.1 — filters always apply (fix)

Two "clever" behaviours were making filters look broken — a filter would silently *not* narrow certain
visuals. Both are now fixed so **every active filter always applies to KPIs, tables, and charts**.

- **A categorical filter on a chart's own breakdown dimension now narrows that chart** (it collapses to
  the selected bar/slice — the correct filtered result). Previously v2.12 *skipped* such a filter to
  avoid a one-bar chart, so filtering "Platform" left the "Spend by platform" chart unchanged — reading
  as "the filter does nothing". The skip is removed (`_filterCollapsesDim`/`_filterCollapsesChart` are
  now no-ops; `_skippedCatFields` returns `[]`); the "all &lt;dimension&gt;" pill no longer appears.
- **An explicit date filter now narrows time charts.** The v2.13 context window (day→month, week→~3mo,
  month→year) now applies **only at the default date state** (`_dateIsDefault`); as soon as the user
  picks any other preset or a custom range, time charts honour that range like every other visual. At
  the default state they still widen to ~1 level of context (the `+ context` pill marks it).

## v2.13 — data-correctness principles, time-context windows, Ask-Y branding

Base-shell change in `base/` (engine patched into all 5 presets via `compose.py`). Driven by the
[Data & App Engineering Principles](FRAMEWORK_SPEC.md#data--app-engineering-principles) checklist plus
product notes on time charts, table parity, and chrome.

- **Ratios are pooled, never averaged (principle 2b).** A new `agg:'ratio'` (with `num`/`den` naming the
  raw additive columns) computes `SUM(numerator) ÷ SUM(denominator)` over the row scope in view — the
  correct pooled rate — instead of the old "average of per-row ratios" antipattern (which weights a $10
  row the same as a $10k row). Wired through **KPIs**, **charts** (categorical, time-bucket, and either
  axis of `dualAxis`), and the **table totals row**: a `ratio`/`percent`/`perunit` column that declares
  `num`/`den` now shows its pooled total instead of `—`. The base + all preset examples (ROAS =
  revenue÷spend, CTR = clicks÷impressions, CPA = spend÷conversions) were converted, so the app is
  internally consistent — the ROAS KPI, the ROAS chart line, and the ROAS totals cell all agree.
  `agg:'avg'` is unchanged; ratio is opt-in. (`loadSection` KPI loop, `aggregate`, `tableTotals`.)
- **"Current period" is anchored to the data, not the wall clock (principle 2e).** A one-time
  `MAX(dateCol)` probe per dated source sets `_asOf` **before** the windowed fetch, so `resolvePreset`
  resolves "this week / last 30d / this month" relative to the latest day the data actually has — a
  lagging warehouse snapshot no longer yields an empty clock-anchored window. The freshness badge now
  reads **"data through &lt;date&gt;"** (the real as-of day) instead of a hardcoded "just now".
  (`_probeAsOf`/`_computeAsOfFromRows`/`_freshnessLabel`; `resolvePreset` anchors to `_asOf`.)
- **Fetch on data-defining inputs, compute on presentation inputs (principle 2f).** A tab switch is a
  presentation change — every source is already loaded up front — so it now **recomputes + re-renders
  only** (`recomputeSection`), no `getModelView` round-trip or cold-start wait. Re-fetch is reserved for
  data-defining changes (date range, filters that reach the `WHERE`, data-mode). All (re)loads are
  **serialized** through one promise chain (`_serialize`) so overlapping loads can't race on
  `_sourceRows` (a stale pass committing empty rows over a newer pass's data).
- **Time charts always show ~1 level of context (product note).** A time breakdown renders over a window
  sized to its grain so a trend is never a lonely point or two: **daily → the month (~30), weekly → ~3
  months (~13), monthly → the year (12), quarterly → ~8**. The window ends at the active range's end
  (else `_asOf`) and walks back N−1 buckets; `aggregate` now honours a chart's `grain` override so
  bucketing matches. A **`+ context`** header pill (hover-explained) marks any chart showing more than
  the active filter. **(Refined in v2.13.1: the context window applies only at the default date state —
  an explicit date filter always narrows time charts.)** (`_timeChartRange`/`_timeBucketTarget`/`_subtractBuckets`/`_grainForChart`/
  `chartShowsContext`; `rowsForChart`; the widget-builder line path follows suit.)
- **Every table has sort + filter + a totals row.** Already true structurally (sortable columns,
  auto-derived per-column value pickers, an always-present totals row); v2.13 makes the totals row show
  pooled ratios (above) rather than `—` for rate columns.
- **Chrome: Ask-Y branding, no data toggle.** The header **Real/Synthetic toggle is removed** and the
  sidebar-footer **"DEPLOYED/DEMO mode" indicator is replaced with "Powered by Ask-Y"** (inline brand
  cube + wordmark, collapses to the cube). With no toggle, real mode **auto-falls back to synthetic once**
  when no live endpoint is reachable, so local/offline preview still renders instead of showing a dead
  banner; deployed under its slug the live fetch succeeds and the fallback never fires.

## v2.12 — filters skip a breakdown they'd collapse to one point (time + categorical)

Base-shell change in `base/` (engine patched into all 5 presets via `compose.py`). Driven by product
notes on the date filter.

- **The time filter applies to every KPI and visual — except a time breakdown it would collapse to a
  single bar.** The rule is about *granularity, not visual type*: for a time-bucketed breakdown we
  compare the active range to the visual's own bucket size (its `grain` override, else `autoGrain`
  measured over its full default rows so the grain is stable). If the range spans **two or more**
  buckets it's filtered as usual; if it spans **exactly one** (e.g. a one-month filter on a monthly
  breakdown, or a one-day filter on a daily breakdown) the filter is skipped and that visual renders
  over its **full default range** instead — the range the app opens on (`source.defaultPreset`), "as
  if no time filter were set." KPI cards and categorical breakdowns (by platform/device/…) always
  honour the filter. A **"full range"** pill on the chart header (with a hover explanation) and a
  `· full range (time filter skipped)` subtitle mark any visual currently showing the fallback.
  (`chartCollapsedByFilter`/`rangeBucketSpan`/`_rangeCollapsesAt`/`chartUsesTimeAxis`/`_defaultRange`;
  `loadSection` picks filtered vs. full-range rows per chart; the widget-builder `line` path follows
  the same rule.)
- **Time detection generalised beyond `event_date`.** `aggregate`/`autoGrain` now bucket any
  date-like dimension (`session_date`, `date`, …) via a shared `isTimeField()`, so analytics apps get
  the same behaviour, not just campaign apps.
- **Same rule for categorical filters (region/platform/device/…).** An active categorical filter is
  skipped on a breakdown **whose own dimension it narrows to a single category** — applying it would
  collapse that breakdown to one bar, so the visual renders over **all** values of that dimension
  instead ("as if the filter weren't set"). Selection span decides it: an `in` filter counts the
  categories picked, a `not_in` filter counts those remaining; **≥2 → apply, exactly 1 → skip**; a
  filter on a *different* dimension than the breakdown always applies (no collapse possible). Each
  filter is judged **independently per visual** — a chart exempt from the region filter still receives
  the product filter, the time filter, and every other. **KPI cards always receive every filter.** An
  `all <dimension>` pill on the chart header (hover-explained) marks each skipped filter.
  (`rowsForChart`/`_filterCollapsesDim`/`_filterSpan`/`_fieldUniverse`/`_skippedCatFields`;
  `rowsForSection` gained an `opts.skipFilter` predicate; the widget-builder breakdown path follows suit.)
- **Real mode loads the active∪default window.** So a collapsed time breakdown can fall back to its full
  default range client-side without a second query; `rowsForSection` re-narrows to the active filter.
  (`buildWhere` now takes an explicit range; `resolveRange` split into a reusable `resolvePreset`.)

## v2.11 — working filter dropdowns, visual calendar range, dual-axis charts, 30-day default

Base-shell changes in `base/` (engine patched into all 5 presets; base-only demo config added to the
dashboard preset + `compose.py`). Driven by product notes.

- **Table filter dropdowns actually open now.** Bug: each filter wrapper had
  `@click.outside="sectionFilterOpen=null"`, so clicking one filter's button fired every *other*
  filter's outside-handler and instantly reset the shared open-state — the menu never appeared. Guarded
  it so only the currently-open filter's wrapper closes (`sectionFilterOpen===f.field && …`). Dropdowns
  open, list their values, and are clickable.
- **Custom date range is a visual calendar.** Replaced the two `<input type=date>` with a calendar
  range picker: click a start day then an end day (the span highlights), Start/End fields show the
  selection with the active one outlined, then **Apply** (or **Cancel**); ‹ › navigate months.
  (`openCustomRange`/`crGrid`/`crPick`/`crIsStart`/`crIsEnd`/`crInRange`/`applyCustomRange`.)
- **New `dualAxis` chart type for divergent scales.** Two metrics over one dimension where the
  magnitudes differ by orders of magnitude (e.g. spend $M vs ROAS ~5×): bars for `metric` on a left
  axis, a line for `metricY` on a right axis, each series **color-matched to its own axis** so it's
  clear which value is which. Each metric aggregates independently (`agg`/`aggY`). (`aggregate`/`chartOption`.)
- **Apps open on the last 30 days, not all-time** (`defaultPreset:'last_30d'`) — a bounded window
  loads faster; the user widens it as needed.

Base-shell changes in `base/` (all presets patched to match). Driven by product notes on tables,
tooltips, and number precision.

- **Data tables paginate at 50 rows/page.** A `Showing a–b of N rows` footer with Prev/Next appears
  once a table spans more than one page, so the user no longer sees every row at once. Works with
  grouping (`sectionGroupBy`) and per-row detail. (`tablePageSize`/`tablePage`/`tablePages`/`tableSetPage`.)
- **Filter + sort now work on every table, with no config.** Sort by clicking any column header (▲/▼).
  Each categorical column (badge/status/text, 2–40 distinct values) auto-gets a value-picker dropdown
  whose options are listed and clickable; numeric/date/image columns stay sortable-only. Explicit
  `table.filters` still work and appear first. Changing a filter or sort resets to page 1.
  (`tableFilters`/`tableRowsAll`; sort now compares numbers numerically and text with `localeCompare`.)
- **Totals row.** Sums the additive columns (currency/number/integer); rates & ratios show `—` (never
  summed). Pinned **on top when the table spans >1 page** (always visible) and **at the bottom on a
  single page**. Reflects all filtered rows. (`tableTotals`.)
- **One tooltip, and you can copy it.** Elements that use the custom `.mtip` no longer ALSO carry a
  native `title=` (that was the doubled popup). The `.mtip` is now hoverable — leaving the trigger
  starts a short close timer that moving onto the tooltip cancels — with `pointer-events:auto` +
  `user-select:text`, so its text can be selected and copied. (`showTip`/`tipEnter`/`hideTip`.)
- **Decimal precision scales with the number.** A shown mantissa with >2 integer digits renders 1
  decimal; ≤2 digits renders 2 decimals; trailing zeros trimmed. `$6,352.89 → $6,352.9`, `2.6K → 2.58K`,
  `2.3% → 2.31%`. Applies to abbreviated labels, currency exact, percent, ratio and per-unit costs.
  (`smartFixed`/`smartMoney`/`formatAbbrev`/`fmt`.)


## v2.9 — visuals: show every categorical value, richer chart palette, explained deltas

Base-shell changes in `base/` (all presets recomposed). Driven by three product notes.

- **Every categorical value is now labelled — no silent thinning.** ECharts drops overlapping
  category-axis labels by default (the reason a ranked "Revenue by Franchise" bar showed only ~8
  of 13 names, hiding e.g. *Bhatti*). Categorical axes now force `interval:0` + `hideOverlap:false`,
  so **every** discrete value renders; x-axis labels rotate (25–35°) when many/long, y-axis names
  truncate at 120px but every row stays labelled. **Time** axes are exempt — dates are continuous,
  so thinning dense day labels is still fine. (`chartOption`/`catAxis`, `isTimeDim`.)
- **Donut draws every slice; new `treemap` type.** The donut no longer caps at 6 slices (that
  silently dropped categories) — it renders all of them with a scrollable legend and value+share
  labels. For high-cardinality shares, the new `treemap` type gives one labelled, value-sized tile
  per category. Both keep the "show every value" rule intact. (`chartOption`.)
- **Deltas explain what they compare against.** Every green/red % change is `cursor-help` and, on
  hover, states the referent — "7.2% up vs. the prior 30 days", derived from the selected date
  range — so an arrow is never ambiguous. (`deltaTipHtml`/`deltaTipText`/`comparePeriodPhrase`.)
- **Authoring guidance updated** (`DESIGN.md`): "show every categorical value", a "tell a story"
  section (vary types across a page, sequence headline→composition→diagnosis→detail), treemap in
  the decision tree, and the delta-referent requirement. Removed the old "≤5–6 slices / bucket the
  tail into Other" guidance, which contradicted showing all values.


## v2.8 — app-shell: real full-text search, chart axis names, instant custom range

Base-shell changes in `base/` (all presets recomposed).

- **Top-right search is a true full-text search with jump-to-element.** It searches the rendered
  text of every tab and returns one result *per matching element* (not just per tab); clicking a
  result switches to that tab, scrolls the exact element into view, and flashes it. It contains no
  filters — the "+ Add filter" control is separate. (`searchApp`/`_searchMatches`/`goToHit`,
  `.search-flash`.)
- **Every chart axis now shows its name.** Value axes are named after the metric, category axes
  after the dimension (prettified: `event_date`→"Date", `campaign_name`→"Campaign"). Applies to
  line/area (Date × metric), bar & ranked bar, and scatter (metric × metric); donut/pie have no
  axes. Grid padding adjusted to fit the names. (`chartOption`/`pfLabel`.)
- **Custom date range filters instantly.** Picking the end date (or changing either date once both
  are set) applies immediately; the redundant "Apply" button is removed.
- **Synthetic data verified end-to-end.** Confirmed the current framework populates non-zero
  synthetic data and renders charts across every tab on load, navigation, and the Real⇄Synthetic
  toggle. (Apps that still show zeros in demo were generated from a pre-v2.6 framework and need a
  rebuild.)


## v2.7 — Optimize module v2: the "Operator Cockpit" loop

**v2.7.9 — creative studio is honest without a connection; generic "platform" wording.** Two
fixes: (1) the creative modal no longer calls a channel a platform — it says "the platform" (e.g.
"add it in the platform", "Open the platform ↗") instead of the channel name. (2) A refresh needs to
READ the current ad, which requires the platform API; without a connection we can't. So for a
not-connected source the studio no longer tries to read the live ad — it explains "the current ad
can't be read without an API connection, so there's nothing to copy from," and instead generates
FRESH copy from the campaign's own details (name/theme). Generation itself works either way because
it runs on the Asky agent (our backend), not the ad platform.

**v2.7.8 — one consistent rule everywhere: connected = the app does it; not-connected = the app
hands you everything to do it in the platform.** The not-connected send toast is now generic ("Opened
the platform — no API connection, so sign in and make the change yourself, then mark it approved here
for your records") instead of naming the channel oddly ("Opened Video"). The creative studio no longer
errors/forbids on a not-connected (or unconfigured) platform: it still generates the ad copy, then hands
off the finished copy plus an "Open {platform} ↗" link so you add the paused ad set there yourself
(logged for your records); when the platform's API can create it, it truly does (or simulates in demo).
Confirm button and messaging read "Create paused ad set" when connected vs "Get copy + platform link"
when not — and the row-level New-copy tooltip says which you'll get.

**v2.7.7 — send is honest about not-connected platforms; editor stays open.** Sending a batch
whose platform has an API gateway still places a paused draft you approve there. Sending a batch on
a NOT-connected platform no longer falsely claims "sits as a paused draft" — instead it opens the
platform in a new tab so you sign in and make the change yourself, then mark it approved. The draft
button reads "Open platform to apply ↗" when no source is connected (vs "Send to platform ↗").
The Campaign editor (05) stays open by default and auto-opens whenever a suggestion drafts edits
into it, so the drafted fields are never hidden behind a collapsed section.

**v2.7.6 — suggested actions are generated from the data and pre-validated.** The chips are no
longer a fixed list — they're built per-load from the live campaigns and every chip is checked to
match ≥1 campaign before it's shown, so clicking never lands on "no match". The pool is bigger and
scoped only where it's unambiguous: a bulk "pause the expensive tail" (every hit is truly > 1.5×
your average) plus one "scale +20%" chip per named winner (cpa < 0.6× average, matches exactly that
campaign). Platform/theme grouping was rejected because it mixes winners and losers. When nothing
qualifies, an empty-state line explains why.

**v2.7.5 — "Assistant" becomes "01 · Suggested actions": chips only, nothing chat-like.** The
free-text input, Send button, question chips, and the reply thread are all gone. The section is a
row of one-click suggested ACTIONS generated from the data; clicking one drafts the edits into the
Campaign editor (selection + amber fields) and confirms with a toast. Provenance badge for
chip-drafted batches reads "Suggestion". The LLM fallback + "why" diagnostics stay dormant in code
behind the same interface; the floating chat bubble remains the conversational surface.

**v2.7.4 — honest source badges: "live" only via API; Prism-table sources show data freshness.**
A source badge is green "live via API" only when a real write gateway is connected. A source read
from Prism tables (no gateway) now shows when its DATA was last updated instead — "data updated
today / yesterday / N days ago" — computed from the max date in the raw rows (`dateCol`, falling
back to `active_to`, capped at today). Tooltips explain both states.

**v2.7.3 — Assistant understands free language (LLM fallback).** Requests that don't match the
quick-command patterns are now routed to the Asky investigation agent — the same LLM behind the
chat panel and creative studio (`/chat/start`+`/chat/poll`, deployed app only). The agent gets the
campaign list and returns structured JSON: an **act** (field/value/campaignIds) that is drafted
into the Campaign editor with amber fields — same review gate, no send/publish path — or an
**answer** shown in the thread. Quick commands remain the instant free path and the only path in
demo mode. Replies are HTML-escaped; a "Thinking…" line shows while polling.

**v2.7.2 — dismissal memory (real, no LLM).** Dismissing a recommendation is now persisted in
localStorage (per browser): the dismissed suggestion never comes back across refreshes, and
dismissing the same rule type twice with a preference reason ("Conflicts with strategy" / "Too
risky") mutes that rule entirely. The memory is visible, not a black box: muted rules render as
chips in the Recommendations header (click to unmute) next to an "N dismissed · restore" link,
and the dismiss modal states exactly what will be remembered. Inline header hints removed —
explanations live only in the ⓘ tooltips (new source-free `optTipHtml`, no doubled native
tooltips); governance banner reworded (connected platforms are updated directly via API;
nothing changes without review).
**Every section is collapsible** like Pending changes — click the header row (caret) to fold it
to a slim bar with a live count ("13 open", "48 campaigns", "N sent"); open/closed state persists
per browser (`optCollapsed` in localStorage).

**v2.7.1 — plain-language pass.** The optimize tab is reworded for first-time users and reordered
as a guided flow: 01 Assistant (console) → 02 Recommendations → 03 Pending changes (staging) →
04 Campaigns ⇄ 05 Campaign editor (bulk editor) → 06 History & results. Every section headline has
an ⓘ tooltip explaining what it does; jargon translated throughout (Stage fix → "Queue fix",
CPA → "Cost / result", Outcome → "Results", Fatigue explained as "tired ads", Staged column →
"Queued", scored → "checked after 7 days"); batch source badges read Recommendation / Editor /
Assistant; assistant grammar also accepts "cost per result > N" and "why is X expensive".

`modules/optimize/` rebuilt around the Operator Cockpit build spec (July 2026); all presets
recomposed. Framework design language unchanged — same tokens, cards, badges.

- **Three governing rules now structure the module.** (1) *The app stages; platforms publish* —
  every send lands as a platform-staged draft / paused batch and go-live approval is always native
  (not-connected sources deep-link out for a by-hand edit; the app never claims it changed
  anything). (2) *Nothing commits silently* — recs, console commands, and bulk edits all become
  reviewable draft **batches** in the new 02 · Staging section. (3) *Every sent batch opens a
  receipt* — forecast frozen at send, verdict (`beat / met / partial_miss / miss`) at +7 days.
- **New six-part anatomy** replaces the workbench/copilot split: 01 Recommendations (impact line +
  confidence/calibration per card, dismiss-with-reason modal, auto-stage toggle) → 02 Console — ask
  & act (deterministic grammar: `pause … cpa > N`, `change … that have X into paused`, `set budget
  +20% for X`, `why is X cpa up`; acting drafts into the bulk editor, never stages directly) →
  03 Staging (batch cards with per-change before→after tables, per-platform send lanes) →
  04 Campaign list (search, source + Needs-attention chips, staged-chip column) ⇄ 05 Bulk editor
  (field catalog with "no change" defaults, amber pending fields, per-campaign ±% budget resolve,
  platform-specific skips counted) → 06 Change history (exact status vocabulary + receipts,
  expandable rows, revert-as-new-draft).
- **Removed:** the arm-per-source + sign-off gate (the platform's native approval *is* the gate),
  the floating pending-changes cart, the verify modal, and the drill-down custom-edit panel — the
  bulk editor + console cover per-entity edits. The batch state machine is
  `draft → platform_staged → live | rejected`; no other transitions exist.
- **Kept:** the connection model (`gateways` / `deepLink`, not-connected = link-out), the creative
  studio (now logs as a `platform_staged` batch — a paused ad set is inherently staged), KPI strip,
  metric tooltips, synthetic-mode offline demo (incl. a `simulate +7d` receipt-scoring control).

## v2.6 — chat overhaul, filter/search UX, loading & synthetic-data fixes

App-shell + engine fixes in `base/` (and `modules/optimize/`); all presets recomposed.

- **Chat is reliable end-to-end.** The Asky poll no longer busy-loops (it paces between polls on a
  180s wall-clock budget) so answers arrive instead of timing out; the final answer is read from a
  broad set of item/top-level fields. **Follow-up questions work** — a poll only treats the run as
  finished once *this* turn has produced output, so it never bails on the prior turn's stale
  `completed`. Progress collapses to **one live status line** (no repeated sentence), and the loading
  icon shows only while the current question is in flight.
- **Chat renders rich answers.** The agent returns HTML; it's now sanitized (DOMParser, tag/attr
  whitelist, `<script>`/`<style>` dropped, links forced `rel=noopener`) and rendered as real
  headings/tables/lists/bold via `.chat-rich`, instead of showing raw tags.
- **New chat / new session.** A `+` button in the chat header (`chatNewSession()`) clears the thread
  and drops the investigation in-place — reset without refreshing; any in-flight poll is abandoned.
- **Pending-changes cart no longer leaks.** Root cause was `x-show` + a string `:style` on the same
  element (the string binding wiped `display:none`). All such elements (cart, command palette, peek
  popover, metric tooltip) now use **object** `:style`, so the tab gate holds.
- **Filter popup is filter-only.** The top-right Search and the "+ Add filter" popup are split:
  Search runs **full-text across every tab** (`searchApp` over each section's rendered text → jump to
  the match); "+ Add filter" lists only filters (no "Go to tab" / "In your data" navigation).
- **Slicer panel redesigned.** Include/Exclude is a compact toggle next to the filter name; the
  **values** are the primary content you click to filter.
- **Loading spinner spans the whole fetch.** `loading` is owned by `reloadSection`/`reloadAll` (not
  just `loadSection`), so switching a filter (date, etc.) shows the spinner through `loadData` and
  never looks stuck; cleared even on error.
- **Demo mode is never all-zeros.** New config-aware `synthForSource()` generates rows carrying the
  fields each source's sections reference (KPI exprs, chart metric/dimension, table columns, funnel
  steps, slicers), inferring value type from the field name. Campaign-like sources keep the rich
  flighted `synthRows` demo; analytics/other sources get generic non-zero rows.

## v2.5 — widget builder, filters, search, chat, sidebar/logo, spinner

App-shell upgrades in `base/` (all presets recomposed):

- **Widget builder redesigned.** The "+ New widget" modal is now Title · Metric (dropdown) ·
  Break down by (dropdown) · Chart type (Bar / Donut / Line over time / Single number) · a **live
  preview**. Widgets render their chart on the dashboard (HTML bars / sparkline / big number) via a
  shared `renderWidgetBody`, so preview and placed card always match. Metrics auto-derive from the
  data's numeric fields (rates excluded); dimensions from the slicer fields.
- **Filters — include & exclude.** Each global filter chip has an `=`/`≠` toggle, and the slicer
  panel has an Include/Exclude segmented control (writes `in` / `not_in`).
- **Filters — Reset moved** next to the filter bar (was in the header); the drill **"↶ Back"
  button removed** (chips already remove with ×).
- **"+ Add filter" / search popup** has an explicit close ✕.
- **Top-right search now searches the app** — the command palette matches tabs (jump to a section)
  and campaign/entity names in the loaded data (jump + filter), in addition to adding filters.
- **Asky chat wired to Prism.** Replaces the stubbed reply with the real Asky-agent contract
  (`/chat/start` → `/chat/respond` → poll `/chat/poll`), streaming progress lines; Synthetic mode
  says it can't reach the backend instead of faking an answer. (Runs on the deployed app — Mode-2
  cookie auth — so it can't be exercised from local preview.)
- **Sidebar** is collapsible/expandable (toggle + click the logo to expand); the **full app name
  wraps** to a second line instead of truncating.
- **Optional logo.** New `APP_CONFIG.logo` (image URL / data-URI) shows in the sidebar instead of
  the initial badge; interview Stage 2 now offers it.
- **Loading spinner** in the header (replaces the bare dot while `loading`), plus a spinner on chat
  progress lines.

Optimize module (`modules/optimize/`):

- **Top bar shows live connections** — per-platform badges (`{source} live` green when an API
  gateway is connected, `not connected` otherwise) + the staged-change count, and a
  **pending-approval banner** on top whenever changes are staged but not yet launched.
- **Not-connected platforms now link to the real platform** (Google Ads / Meta Ads Manager / etc.
  via `optPlatformUrl`), not back to this app — in the cart, verify modal, change history, and
  Creative Studio. The **Refresh-creative** flow, for a not-connected source, now ends on a
  "finish in {platform}" panel with the generated copy + a direct link.
- **Removed the "Copy digest" button** from the verify modal.
- The Pending-changes cart remains module-only (it ships with `modules/optimize/`) and renders only
  on the optimize tab.

## v2.4 — grouped + expandable data-tables; real-table clipboard copy

Three engine features in `base/`, all **opt-in per section** via `table` options, plus a
rewritten copy action. The campaigns preset (`compose.py` `CAMPAIGNS`) turns them all on.

- **`table.sectionGroupBy:'platform'`** — the data-table renders rows grouped under a labeled
  per-platform header row, groups ordered by total spend descending. New `tableGroups()` +
  `tableDisplay()` flatten groups/rows/detail into one render list; `colCount()` spans headers.
- **`table.rowDetail:'daily'`** — each row gets a rotating-chevron affordance and expands to a
  per-day sub-table (Date · Spend · Impr. · Clicks · CTR · CPC · Conv. · CPA) honoring the active
  date range + global filters. New `dailyRows(sec,row)` (synthetic: deterministic split of the
  campaign's totals across the days in range, sums back to the aggregate; real: swap for a
  `getModelView` GROUP BY day query), `dailyColumns()`, and `expandedRows` / `toggleRow` state.
- **`modules/copysummary` "Copy Performance Summary" now copies a REAL table.** Writes both
  `text/html` (a styled `<table>` with a `<caption>`) and `text/plain` (TSV) via `ClipboardItem`,
  with a `writeText(TSV)` then `execCommand` fallback. Respects `sectionGroupBy` (section header +
  per-platform Total row) and `rowDetail:'daily'` (every campaign broken down by day, header line
  `N campaigns · M day-rows`). Replaces the old monospace-codeblock plain-text dump.
- **Campaigns tab cleanup:** removed the two non-working section filter dropdowns (Platform/Status)
  next to the title — platform grouping replaces them. Leaderboard's filter is unchanged.
- **Fix:** `fmt('currency').exact` now caps at 2 decimals (`maximumFractionDigits:2`); fractional
  per-day spend was rendering 3 decimals.
- **Fix (active-in-range):** synthetic campaigns now carry a real **flight** (`active_from`/
  `active_to` + per-day baseline). `rowsForSection()` keeps a campaign only when its flight
  **overlaps** the date range and **prorates** its metrics to the in-range days, so campaigns that
  weren't running in the selected range no longer appear, and the per-day breakdown lists only the
  campaign's actual active days within the range (clipped at both ends, summing to the row shown).
  Flights are anchored to **today** so recent presets (Last 7d/30d) aren't empty. Real mode mirrors
  this — the warehouse SUMs over `WHERE date in range`, which is zero rows for an inactive campaign.

## v2.3 — optimize module: creative studio (ad-copy refresh → new paused ad set)

- **`modules/optimize/` gains a Creative Studio.** Every entity row now has a **✨ Refresh**
  button that opens a modal to regenerate ad copy (headline / primary text / description) and
  add it as a **new paused ad set** inside the campaign — a faithful port of TheDrop's Creative
  Studio. Variants come from the Asky investigation agent (`/chat/start` + `/chat/poll`), with
  deterministic canned variants in synthetic mode so the flow works offline.
- **Apply mirrors the deploy model:** synthetic + writable → `simulated`, read-only → `queued`,
  real + writable → real gateway writes (`live`), all logged to change history. Real writes
  (new creative → duplicate source ad set, paused → new paused ad) require a new optional config
  `optimize.creative.accountPath`; without it a real confirm errors clearly instead of writing.
- New entities-table **Creative** column; new `opt.cs` substate + `cs*` methods + studio modal.
  Spec §13.1 in `OPTIMIZE_MODULE_SPEC.md`.

## v2.2 — `copysummary` module (opt-in "Copy Performance Summary")

- **New optional module `modules/copysummary/`.** Adds a **Copy Performance Summary**
  button to any `data-table` section's toolbar. One click copies the *currently
  visible* table — title + active range/filter chips + an aligned monospace
  breakdown with a totals row — to the clipboard as Slack/chat-ready text the user
  can paste and send as-is. Reuses `tableRows(sec)` and `fmt()`, so it matches the
  screen; rates (percent/ratio/per-unit) are never summed in the Total row.
- **Not on by default** — like `optimize`, offer it only for campaign/ads
  performance. Enable per section with `table.copySummary: true` (or `{ title }`).
- **New inert slot `@MODULE:TABLEACTIONS`** in the `data-table` toolbar of `base/`.
  Composed into the `dashboard` preset (Campaigns table). Full contract:
  `modules/copysummary/COPYSUMMARY_MODULE_SPEC.md`.

## v2.1 — marketing-data correctness, explainability & data modes (inherited by every app)

Three requirements now baked into `base/` (engine), `compose.py` (preset config), and DESIGN.md
(normative rules + polish checklist). All presets regenerated.

- **Two marketing source kinds.** `dataSources` entries declare `category:'ad'|'analytics'` + a
  `provider` label. Ad platforms own spend/impressions/clicks/CTR/CPC/platform conversions (no
  sessions); analytics (GA4/Adobe) owns sessions/on-site behavior/attributed revenue (no spend).
  Never sum spend onto analytics rows or attribute sessions to ad rows.
- **Mandatory metric explainability.** Every KPI / chart series / table column carries `source` +
  `tooltip`. A new custom hover tooltip (`.mtip` + `showTip`/`metricTipHtml`) shows — *immediately*,
  no native-`title` delay — what the metric is, how it's calculated, and which source it comes from.
  KPI, chart, and table-header info affordances all use it.
- **One data-mode source of truth.** `setDataMode(mode)` replaces the inline toggle: it drops the
  prior dataset + chat session and runs a full reload, idempotent in both directions (synthetic
  always regenerates, real always refetches — never a stale relabel).


v2 keeps the v1 stack **unchanged** (single-file Alpine.js + Tailwind v3 Play CDN +
ECharts + inline SVG, one `index.html` deployed to the apps subdomain, no build step).
What changes is the *authoring model*: a build is now **config-fill**, and an app is
**multi-tab** by default.

## Composable component folders + real connection layer

- **Folder-per-component.** Split into `base/` (foundation, runs standalone) +
  `modules/{funnel,optimize}/` (optional layout add-ons) + `components/` (primitive
  atoms, renamed from `primitives/`) + `connections/` + `presets/` (pre-composed
  apps). `compose.py` splices base + chosen modules into a deployable single-file
  `index.html` via inert `@MODULE:*` markers in base. Use only the base, or base +
  the modules you want. (Replaces the `shell/ primitives/ module-types/` tree.)
- **Connection layer** (`connections/`) wired to the real contract: slug-prefixed
  base (`/<slug>/api`, never bare `/api`), cookie auth in production + a
  token-injecting `dev-proxy.mjs` for local real-data only, `getModelView`
  request/response shape with cold-start retry, and gateway helpers
  (`gw`/`gwWrite`/`gwCreate`, query-string writes, `providerError`). Inlined into
  base. The attached **project-spec** supplies the values (slug, ids, table ids,
  provider/account); no secret is bundled.

## Breaking / structural

1. **`APP_CONFIG` manifest replaces scattered factory edits.** One object at the bottom
   of the starter declares identity, data sources, slicers, and `sections[]`. The v1
   pattern of editing `NAV_SECTIONS` / `KPI_DEFS` / hardcoded `breakdowns` / `insights`
   in 4–5 places is gone.

2. **Multi-tab by default via a generic section renderer.** v1 built exactly one section
   (`x-show="section === 'dashboard'"`) and every other nav item fell through to an empty
   placeholder. v2 renders **every** tab from `sections[]` with a single
   `<template x-for="sec in sections">` block. (Fixes: only-one-section, and the
   FRAMEWORK_SPEC "fully populated example" doc/claim mismatch.)

3. **`module type` is now a starter preset, not a whole-app mode.** A section declares its
   own `layout` — `kpi-grid | breakdown-grid | data-table | funnel | optimize` — so a
   funnel tab can sit beside dashboard tabs in one app. "Funnel" is no longer a separate
   whole-app module type.

4. **Per-section data + KPIs.** Each section binds to a `source` from a **data-source
   registry** (`dataSources`) — a Prism SQL endpoint *or* a REST proxy (`queryAny()`),
   not one global `PRIMARY_PRISM`. Each section has its own `kpis[]` / `charts[]` /
   `table`.

5. **Resilient loaders.** Each KPI / chart / table query is wrapped in its own `try/catch`;
   a single unwired query degrades that tile to `—` and leaves the rest of the tab
   rendered. No more whole-dashboard blank from one bad KPI.

## Defaults now ON for every app

- Filtering, drilling, per-metric tooltips, **widget builder** (all layouts, incl. funnel
  and comparison), and **chat**.
- **Chat is a real 4th filter scope** (`filters.chat`) — promoted out of v1's "deferred".

## New drill gesture (replaces v1 §0.3)

Single-click on a chart datum opens a **peek popover** anchored at the click, with a
**`Dig in`** button (plus Exclude / Send-to-chat). `Dig in` performs the drill. v1's
"double-click + ▶ pill, single-click never drills" hard rule is retired.

## New primitives / capabilities

- **Rich typed table** — columns typed `text | badge | status | date | currency | percent |
  number | perunit | image`; sortable headers; exact-value tooltips; empty state.
- **Section-scoped select filters** — per-table categorical filters (chip-dropdown, never
  a native `<select>`), independent of the global slicer panel.
- **Derived fields + rule columns** — computed values and threshold→recommendation columns
  (e.g. flag `ROAS < 1` → suggest "Pause").
- **Number & date formatting policy** — abbreviated on cards/axes, exact in tables/tooltips;
  never abbreviate ratios (`1.2x`), rates (`3.4%`), or per-unit costs (`$2.45`).
- **Visual-design rules** — per-chart palettes, same-category-same-color, 6–8 category cap,
  green/red reserved for good/bad, ranked-bar top-to-bottom shading.
- **Optimize module** (`OPTIMIZE_MODULE_SPEC.md`) — an optional tab offered only for
  campaign/ads-type schemas.

## Unchanged from v1

Chrome (sidebar/header/filter-bar/slicer-panel/command-palette/toasts), design tokens,
the no-build single-file deploy model, and the discipline greps in DESIGN.md.
