# modules/funnel — funnel section layout

Adds the `layout:'funnel'` section type: an ECharts funnel chart + a step
drop-off table (% overall / % of previous / drop-off bars). Drops into `base/`
so a funnel tab can sit beside dashboard tabs.

## Files (composed into base at the matching markers)
| File | Marker | Contents |
|---|---|---|
| `layout.html` | `@MODULE:LAYOUTS` | the funnel chart + step table block |
| `loadhook.js` | `@MODULE:LOADHOOK` | computes `sec._funnel` in `loadSection` |
| `renderhook.js` | `@MODULE:RENDERHOOK` | renders the ECharts funnel in `renderSection` |
| `methods.js` | `@MODULE:METHODS` | `computeFunnel(rows, fn)` |

## Config — a funnel section
```js
{ id, label, icon:'funnel', layout:'funnel', source:'primary',
  subtitle:'…what drops off, and how it's broken down…',
  funnelTitle:'Acquisition funnel',
  funnel:{ identity:'sessions', steps:[
    { name:'Visited', rate:1,    sql:'TRUE' },          // demo uses `rate`; real mode counts DISTINCT identity WHERE `sql`
    { name:'Engaged', rate:0.52, sql:'engaged = 1' },
  ]},
}
```

## Compose
```bash
python3 compose.py funnel     # base + funnel
```
Pre-composed example: `presets/funnel/`.
