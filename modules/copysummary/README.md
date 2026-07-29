# modules/copysummary — "Copy Performance Summary" button

Adds a **Copy Performance Summary** button to the toolbar of any `data-table`
section. One click copies the *currently visible* table to the clipboard as a
**real table in two flavors**: a styled `text/html` `<table>` (pastes formatted
into Docs / Slack / email) and a `text/plain` TSV (pastes as columns into Sheets /
Excel), both carrying a caption with the title, active date range + filter chips,
and a count line. Written via `ClipboardItem`, with a `writeText(TSV)` fallback.

Like the `optimize` module, this is **not on by default**. Offer it only when the
user is working with **campaign / ads performance** (or any table they'd want to
share into Slack). It is purely additive — no new tab, no data fetching of its own;
it reads the rows the table already shows.

## Files (composed into base at the matching markers)
| File | Marker | Contents |
|---|---|---|
| `layout.html` | `@MODULE:TABLEACTIONS` | the button (renders only when `sec.table.copySummary` is set) |
| `methods.js`  | `@MODULE:METHODS`      | `copyPerfSummary(sec)` — builds the text and writes it to the clipboard |

The `@MODULE:TABLEACTIONS` marker lives in the `data-table` toolbar in
`base/index.html` (right side, beside the row count). It is inert in standalone base.

## Config — enable per section
Add `copySummary` to a `data-table` section's `table` block:
```js
table:{
  copySummary:true,                       // or: { title:'TheDrop campaigns' } to override the header label
  sectionGroupBy:'platform',              // optional — adds section headers + per-platform Total rows
  rowDetail:'daily',                      // optional — copies every campaign broken down by day
  columns:[ … ],
}
```
`copySummary:true` uses the section's `tableTitle`/`label` as the header. Pass an
object `{ title }` to override it. The output shape mirrors the on-screen table:
`sectionGroupBy` and `rowDetail` (engine options in `base/`) reshape the copy too.

## Behavior
- Copies the same rows as `tableRows(sec)` — current section filters, sort order, and
  the row cap — so the clipboard matches the screen.
- Reuses the app's `fmt()`/`formatDate()` policy, so currency and rates match the cells.
- **Total** rows sum only summable columns (`currency`, `number`, `integer`, `count`);
  rates (`percent`, `ratio`, `perunit`) are left blank — never summed. With grouping, a
  per-group Total plus one grand Total.
- With `rowDetail:'daily'`, every campaign is expanded into its per-day rows
  (Campaign · Date · Spend · Impr. · Clicks · CTR · CPC · Conv. · CPA) via the engine's
  `dailyRows()`; the count line reads `N campaigns · M day-rows`.
- Writes `text/html` + `text/plain` via `ClipboardItem`; falls back to
  `writeText(TSV)` then a hidden-`textarea` `execCommand('copy')`. Confirms with a toast.

## Compose
```bash
python3 compose.py copysummary           # base + copysummary (button shows where a table sets copySummary)
python3 compose.py optimize copysummary  # combine with other modules
```
Pre-composed in `presets/dashboard/` (the Campaigns table sets `copySummary:true`).
Full contract: `COPYSUMMARY_MODULE_SPEC.md`.
