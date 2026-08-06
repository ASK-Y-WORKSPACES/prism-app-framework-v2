# Components (UI primitives)

> Renamed from `primitives/`. These are the **reference atoms** — `base/index.html`
> already inlines the ones it needs; reach here when extending base or a module
> with an additional atom (e.g. a new slicer type or chart card).

Drop-in HTML snippets, each module-agnostic — it expects certain Alpine state slots (declared in the base factory) and renders against them.

## Catalog

| File | Use when | Declared in shell factory |
|---|---|---|
| `kpi-card.html` | Rendering a metric tile in `<template x-for>` | `kpis[]`, `compare`, `renderSparkline()` |
| `chart-card.html` | Wrapping any ECharts viz with title + chrome | `chart` object, `renderChart()`, `drill()` |
| `filter-bar.html` | A module-type doesn't already inline its own | `range`, `granularity`, `compare`, `pinnedSlicers[]`, etc. |
| `slicer-chip.html` | Categorical slicer body (≤ 12 or > 12 with search) | `s`, `slicerValues`, `isSlicerSelected`, `toggleSlicerValue` |
| `slicer-date.html` | Date range slicer body | `range`, `presetRange()`, `calendarMode` |
| `slicer-numeric.html` | Numeric min/max slicer body | `s`, `filters`, `replaceFilter`, `removeFilter` |
| `chip.html` | A single filter rule chip | `r` (rule), `scope`, `slicerLabels`, mutations |
| `insights-band.html` | Top-of-page auto-insights banner | `insights[]`, `insightsOpen`, `applyCta()` |
| `widget-builder.html` | User-driven widget creation modal | `widgetBuilderOpen`, `addWidget()` |
| `drill-row.html` | DOM pill row below a drillable chart | `chart.data`, `chart.field`, `drill()` |
| `empty-state.html` | Inside a section that went empty after filters | `clearAll()`, `drillBack()`, `drillHistory` |
| `error-banner.html` | Top of `<main>` when `error` is set | `error` |
| `loading-skeleton.html` | While a card is loading | `loading` |
| `toast.html` | Toast stack (paste once near `</body>`) | `toasts[]` |
| `context-menu.html` | Right-click menu (paste once near `</body>`) | `ctxMenu`, `addFilter`, `drill` |
| `command-palette.html` | ⌘K palette (paste once near `</body>`) | `commandPaletteOpen`, `paletteItems()`, `paletteSelect()` |
| `sortable-table.html` | Any section needing a sortable HTML table | self-contained `x-data` |
| `chat-launcher.html` | Floating "ask me anything!" pill (paste once near `</body>`) | `chatOpen` |
| `chat-panel.html` | Slide-in chat panel (paste once near `</body>`) | `chatOpen`, `chatMessages[]`, `chatInput`, `chatProcessing`, `chatStarters[]`, `chatSend()`, `chatStarterClick()` |

## How to use

1. Open the chosen `module-types/<type>/index.html` — most primitives are already inlined.
2. When you need to extend (e.g. add a new chart card, support a numeric slicer): grep this folder for the relevant `COMPONENT:` marker.
3. Copy the HTML between the `<!-- COMPONENT: -->` opening marker and the file's end (omit the marker line itself — it's documentation).
4. Paste into the working `index.html` at the appropriate point. Verify the Alpine scope it expects is already declared.

## Convention

Every primitive begins with a `<!-- COMPONENT: name -->` block that names:

- **Purpose** — one line
- **Alpine scope expected** — which `x-data` slots and methods must exist
- **Usage** — typical insertion point

If you copy a primitive and find a scope slot missing, add it to the shell factory's state inventory and the methods to the lifecycle block — don't redefine state inside the primitive.
