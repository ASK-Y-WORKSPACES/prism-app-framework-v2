# base/ — the foundation (runs standalone)

`base/index.html` is a complete, working single-file app on its own. Open it in a
browser (synthetic mode) to see it render. It contains:

- **Chrome** — sidebar, header, sticky filter bar, slicer panel, command palette, toasts, top progress.
- **Core section layouts** — `kpi-grid`, `breakdown-grid`, `data-table`, `comparison`.
- **Defaults on** — filtering, drilling (single-click peek → **Dig in**), per-metric tooltips, the **widget builder**, and **chat** (a real 4th filter scope).
- **Formatting** — abbreviated vs exact, never-abbreviate ratios/rates/per-unit.
- **Connections** — the slug-prefixed `getModelView` + gateway layer is inlined here (see `../connections/`).

## Use base alone
Copy `base/index.html`, fill `APP_CONFIG` (identity, `dataSources`, `slicers`,
`sections[]` using only the core layouts), zip at root, deploy.

## Add modules
`base/index.html` carries inert `@MODULE:*` comment markers where optional
modules slot in. To produce an app with modules, run the composer from the
framework root:

```bash
python3 compose.py            # rebuild every preset in presets/
python3 compose.py funnel     # print base + the funnel module to stdout
```

The markers (all inert HTML/JS comments, so base stays runnable):

| Marker | Where | Filled by |
|---|---|---|
| `<!-- @MODULE:LAYOUTS -->` | section renderer | each module's `layout.html` |
| `<!-- @MODULE:MODALS -->` | near modals | module modals (e.g. optimize verify) |
| `/* @MODULE:STATE */` | factory state | module state |
| `/* @MODULE:LOADHOOK */` | `loadSection()` | module per-section load hook |
| `/* @MODULE:RENDERHOOK */` | `renderSection()` | module chart-render hook |
| `/* @MODULE:METHODS */` | factory methods | module methods |

Available modules live in `../modules/`. Pre-composed results live in `../presets/`.
