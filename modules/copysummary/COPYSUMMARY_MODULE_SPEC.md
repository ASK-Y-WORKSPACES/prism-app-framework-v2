# copysummary module — contract

A one-click **Copy Performance Summary** action for any `data-table` section. It
turns the rows currently on screen into a **real table on the clipboard, in two
flavors at once**, so it pastes correctly wherever it lands:

- **`text/html`** — a styled `<table>` with a `<caption>` (title, active range,
  filter chips, counts). Pastes as a formatted table into Docs / Slack / email.
- **`text/plain`** — tab-separated rows. Pastes as columns into Sheets / Excel.

Written via the async Clipboard API (`ClipboardItem` + `navigator.clipboard.write`),
with a `navigator.clipboard.writeText(TSV)` fallback and a hidden-`textarea`
`execCommand('copy')` last resort. Built for the case where someone is reviewing
campaign performance and wants to drop it into a channel, a doc, or a sheet.

**Not on by default.** Offer it only when the app is about campaign/ads
performance (or any table the user would share into Slack). Enable it per section.

## Slots
| Slot (marker) | File | What it adds |
|---|---|---|
| `@MODULE:TABLEACTIONS` | `layout.html` | the toolbar button, gated on `sec.table.copySummary` |
| `@MODULE:METHODS` | `methods.js` | `copyPerfSummary(sec)` |

`@MODULE:TABLEACTIONS` is an inert marker in the `data-table` toolbar of
`base/index.html` (right side, before the row count). With the module absent the
marker composes to nothing; with it present but no section opting in, the button
simply never renders.

## Enabling
On a `data-table` section's `table` object:
- `copySummary: true` — enable; header label falls back to `tableTitle` → `label`.
- `copySummary: { title:'…' }` — enable with an explicit header label.

## copyPerfSummary(sec) — behavior contract
1. **Rows = `tableRows(sec)`.** Exactly what's visible: section filters, sort, and
   the row cap all already applied. Empty → a toast, no clipboard write.
2. **Shape follows the table's opt-in options** (read from `sec.table`):
   - **`rowDetail:'daily'`** → each campaign is expanded into its per-day rows via
     the engine's `dailyRows(sec,row)`. Columns become **Campaign · Date · Spend ·
     Impr. · Clicks · CTR · CPC · Conv. · CPA**, with each campaign's days listed in
     sequence. Otherwise → one row per campaign using `table.columns` (minus `image`
     and label-less columns), order and labels preserved.
   - **`sectionGroupBy:'platform'`** → rows are grouped under a per-platform section
     header row + a per-platform **Total** row, groups ordered by total spend desc
     (mirrors the on-screen grouping). Otherwise → one flat block.
3. **Cell formatting** reuses the engine's `fmt()`/`formatDate()` so currency,
   percent, ratio, per-unit and counts read identically to the on-screen cells.
4. **Totals rows** sum only summable types (`currency`, `number`, `integer`,
   `count`). Rates (`percent`, `ratio`, `perunit`) are left blank — never summed.
   A per-group Total row when grouped, and one grand Total row at the end.
5. **Caption / heading.** `<title> — <rangeLabel()>`, then `Filters: …` (only if any
   global/drill/chat chips are active), then a count line: `N campaigns · M day-rows`
   in daily mode, else `<n> rows`. In the HTML flavor this is a `<caption>`.
6. **Clipboard.** `ClipboardItem` with both `text/html` (styled `<table>`) and
   `text/plain` (TSV) → `navigator.clipboard.write`. Falls back to
   `navigator.clipboard.writeText(TSV)`, then a hidden-`textarea` `execCommand('copy')`.
   Confirms via `toast()`.

No new state, no network. The HTML flavor uses literal hex colors on purpose —
foreign paste targets (Docs/Slack/email) can't resolve the app's CSS variables.
`dailyRows`/`tableGroups` are engine helpers in `base/` shared with the on-screen
grouped + expandable table, so copy and screen never drift.

## Compose
```bash
python3 compose.py copysummary             # base + this module
python3 compose.py optimize copysummary    # alongside other modules
```
Pre-composed in `presets/dashboard/` (Campaigns table sets `copySummary:true`).
