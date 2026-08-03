# modules/funnel — funnel section layout

Adds the `layout:'funnel'` section type: an ECharts funnel chart + a step
drop-off table (% overall / % of previous / drop-off bars). Drops into `base/`
so a funnel tab can sit beside dashboard tabs.

## Files (composed into base at the matching markers)
| File | Marker | Contents |
|---|---|---|
| `layout.html` | `@MODULE:LAYOUTS` | the funnel chart + step table block (incl. the fail-loud error banner) |
| `loadhook.js` | `@MODULE:LOADHOOK` | computes `sec._funnel` in `loadSection`; errors → `sec._funnelError` |
| `renderhook.js` | `@MODULE:RENDERHOOK` | renders the ECharts funnel in `renderSection` |
| `methods.js` | `@MODULE:METHODS` | `computeFunnel(rows, fn)` + `_sqlPredicate(sql, cols)` |

## Config — a funnel section

Every step count is **computed from the loaded rows** — there is no demo/rate
mode (askycore#904: `step.rate` used to *fabricate* every count; it now throws).
Steps declare ONE of two modes, and all steps in a funnel must use the same one:

**`sql` mode** — event/entity-grain rows, one predicate per step. Steps CHAIN:
a row reaches step *i* only if it satisfies every predicate up to *i*. The count
is `COUNT(DISTINCT identity)` when the `identity` column exists on the rows,
else the matching row count.

```js
{ id, label, icon:'funnel', layout:'funnel', source:'primary',
  funnelTitle:'Campaign conversion funnel',
  funnel:{ identity:'campaign_id', steps:[
    { name:'All campaigns', sql:'TRUE' },
    { name:'Got clicks',    sql:'clicks > 0' },
    { name:'Converted',     sql:'conversions > 0' },
    { name:'Profitable',    sql:'revenue > spend' },
  ]},
}
```

Supported predicate SQL: `AND OR NOT`, parentheses, `= != <> > >= < <=`,
`IS [NOT] NULL`, `[NOT] IN (…)`, `[NOT] LIKE '…%'`, `TRUE/FALSE`, numeric and
`'string'` literals, bare or `"quoted"` column names (column-to-column
comparisons work). Comparisons against NULL/missing are false, per SQL.

**`metric` mode** — aggregate-grain rows where each row already carries
per-stage totals; each step SUMs one numeric column:

```js
funnel:{ steps:[
  { name:'Impressions', metric:'impressions' },
  { name:'Clicks',      metric:'clicks' },
  { name:'Conversions', metric:'conversions' },
]}
```

**Fail loud.** An unparseable predicate, a column not present in the loaded
rows, a `rate`-only step, or mixed modes throws — `loadhook` catches it into
`sec._funnelError` and the tab shows a "Funnel not computed — …" banner instead
of plausible-looking invented numbers.

## Compose
```bash
python3 compose.py     # rebuild every preset (Windows: python -X utf8 compose.py)
```
Pre-composed examples: `presets/funnel/` (sql mode), `presets/dashboard/`
(metric mode). `presets/pricing/` is hand-maintained — it carries the same
funnel module code; keep it in sync when this module changes.
