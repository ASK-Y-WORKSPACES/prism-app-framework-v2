#!/usr/bin/env python3
"""
Prism App Framework v2 — composer.

`base/index.html` is the foundation: chrome + engine + the core section layouts
(kpi-grid / breakdown-grid / data-table / comparison) + filtering, drill, chat,
widgets, formatting, and the connection layer. It runs standalone and carries
inert `@MODULE:*` markers where optional modules slot in.

Each folder under `modules/<name>/` holds ONLY that module's delta (layout HTML,
load/render hooks, factory state, methods). This script splices base + chosen
modules into a deployable single-file `index.html` under `presets/<name>/`.

Usage:
  python3 compose.py                 # rebuild every preset in presets/
  python3 compose.py funnel optimize # print a one-off app (base + those modules) to stdout

To make a new app: pick the closest preset, or compose base + the modules you
want, then fill APP_CONFIG.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
BASE = (ROOT / "base/index.html").read_text()

# ── module partials (slot -> marker in base) ──────────────────────────────
MARK = {
    "layouts":     "      <!-- @MODULE:LAYOUTS -->",
    "tableactions":"            <!-- @MODULE:TABLEACTIONS -->",
    "modals":      "<!-- @MODULE:MODALS -->",
    "state":       "    /* @MODULE:STATE */",
    "loadhook":    "        /* @MODULE:LOADHOOK */",
    "renderhook":  "      /* @MODULE:RENDERHOOK */",
    "methods":     "    /* @MODULE:METHODS */",
}
def read(p):
    f = ROOT / p
    return f.read_text().rstrip() if f.exists() else ""

MODULES = {
    "funnel": {
        "layouts":   read("modules/funnel/layout.html"),
        "loadhook":  read("modules/funnel/loadhook.js"),
        "renderhook":read("modules/funnel/renderhook.js"),
        "methods":   read("modules/funnel/methods.js"),
    },
    "optimize": {
        "layouts":  read("modules/optimize/layout.html"),
        "modals":   read("modules/optimize/modal.html"),
        "state":    read("modules/optimize/state.js"),
        "loadhook": read("modules/optimize/loadhook.js"),
        "methods":  read("modules/optimize/methods.js"),
    },
    "copysummary": {
        "tableactions": read("modules/copysummary/layout.html"),
        "methods":      read("modules/copysummary/methods.js"),
    },
}

def compose(modules, sections, hide_date=False):
    t = BASE
    for slot, marker in MARK.items():
        parts = [MODULES[m][slot] for m in modules if MODULES[m].get(slot)]
        t = t.replace(marker, "\n\n".join(parts))
    # swap APP_CONFIG.sections
    t = re.sub(r"  sections:\[\n.*?\n  \],\n  chatStarters:",
               "  sections:[\n" + sections + "\n  ],\n  chatStarters:", t, count=1, flags=re.DOTALL)
    if hide_date:
        t = t.replace("const APP_CONFIG = {\n", "const APP_CONFIG = {\n  hideDate:true,\n", 1)
    return t

# ── section snippets (config only — no engine code) ───────────────────────
OVERVIEW = """    {
      id:'overview', label:'Overview', icon:'grid', layout:'kpi-grid', source:'primary',
      subtitle:'Spend and return across all platforms, broken down by platform, device, and day.',
      kpis:[
        { label:'Total Spend', agg:'sum', expr:'spend',   format:'currency', favorableUp:false, source:'Ad platforms', tooltip:'SUM(spend) across ad-platform rows over the filtered set.' },
        { label:'Revenue',     agg:'sum', expr:'revenue', format:'currency', favorableUp:true,  source:'Ad platforms', tooltip:'SUM(revenue / conversion value) over the filtered set.' },
        { label:'ROAS', agg:'ratio', num:'revenue', den:'spend',       format:'ratio',   favorableUp:true, source:'Ad platforms', tooltip:'SUM(revenue) ÷ SUM(spend) over the filtered set — pooled, not an average of per-row ratios.' },
        { label:'CTR',  agg:'ratio', num:'clicks',  den:'impressions', format:'percent', favorableUp:true, source:'Ad platforms', tooltip:'SUM(clicks) ÷ SUM(impressions) over the filtered set — pooled, not an average of per-row rates.' },
      ],
      charts:[
        { title:'Spend over time', metric:'spend', agg:'sum', dimension:'event_date', type:'area',  sort:'asc',  palette:1, source:'Ad platforms', tooltip:'Daily SUM(spend) across ad platforms.' },
        { title:'Spend vs ROAS over time', metric:'spend', agg:'sum', metricY:'roas', aggY:'ratio', numY:'revenue', denY:'spend', dimension:'event_date', type:'dualAxis', palette:1, source:'Ad platforms', tooltip:'SUM(spend) (left) vs pooled SUM(revenue) ÷ SUM(spend) per bucket (right) — dual axis because the scales differ by orders of magnitude.' },
        { title:'Spend share by platform', metric:'spend', agg:'sum', dimension:'platform', type:'donut', sort:'desc', palette:2, source:'Ad platforms', tooltip:'Share of SUM(spend) by platform.' },
      ],
    },"""
CHANNELS = """    {
      id:'channels', label:'Channels', icon:'chart', layout:'breakdown-grid', source:'primary',
      subtitle:'How each channel performs — share of spend, device split, and the spend↔revenue efficiency cloud.',
      charts:[
        { title:'Spend share by platform', metric:'spend',       agg:'sum', dimension:'platform',  type:'donut',     sort:'desc', palette:1, source:'Ad platforms', tooltip:'Share of SUM(spend) by platform.' },
        { title:'Conversions by device',   metric:'conversions', agg:'sum', dimension:'device',     type:'rankedBar', sort:'desc', palette:2, source:'Ad platforms', tooltip:'SUM(platform-reported conversions) by device.' },
        { title:'Revenue by objective',    metric:'revenue',     agg:'sum', dimension:'objective',  type:'bar',       sort:'desc', palette:3, source:'Ad platforms', tooltip:'SUM(revenue) by campaign objective.' },
        { title:'Spend vs revenue (per campaign)', metric:'spend', metricY:'revenue', dimension:'campaign_name', type:'scatter', palette:4, source:'Ad platforms', tooltip:'Each point is a campaign: x = SUM(spend), y = SUM(revenue).' },
      ],
    },"""
CAMPAIGNS = """    {
      id:'campaigns', label:'Campaigns', icon:'table', layout:'data-table', source:'primary',
      subtitle:'Every campaign with spend, efficiency, and a suggested action when metrics cross a threshold.',
      tableTitle:'Campaigns',
      table:{
        copySummary:{ title:'Campaign performance' },  // requires the `copysummary` module — adds a "Copy Performance Summary" button
        sectionGroupBy:'platform',   // group rows under per-platform headers, ordered by total spend desc
        rowDetail:'daily',           // each campaign row expands to a per-day breakdown (Date/Spend/Impr/Clicks/CTR/CPC/Conv/CPA)
        columns:[
          { key:'creative', label:'', type:'image', sortable:false },
          { key:'campaign_name', label:'Campaign', type:'text', source:'Ad platforms', tooltip:'Campaign name as reported by the ad platform.' },
          { key:'platform', label:'Platform', type:'badge', source:'Ad platforms', tooltip:'Originating ad platform.' },
          { key:'status', label:'Status', type:'status', source:'Ad platforms', tooltip:'Serving status reported by the platform.' },
          { key:'spend', label:'Spend', type:'currency', source:'Ad platforms', tooltip:'SUM(spend) for this campaign.' },
          { key:'ctr', label:'CTR', type:'percent', num:'clicks', den:'impressions', source:'Ad platforms', tooltip:'clicks ÷ impressions per row; the totals row pools SUM(clicks) ÷ SUM(impressions).' },
          { key:'roas', label:'ROAS', type:'ratio', num:'revenue', den:'spend', source:'Ad platforms', tooltip:'revenue ÷ spend per row; the totals row pools SUM(revenue) ÷ SUM(spend).' },
          { key:'cpa', label:'CPA', type:'perunit', num:'spend', den:'conversions', source:'Ad platforms', tooltip:'spend ÷ conversions per row; the totals row pools SUM(spend) ÷ SUM(conversions).' },
          { key:'_action', label:'Action', type:'badge', source:'Derived', tooltip:'Suggested action from the ROAS threshold rule.' },
        ],
        derived:[ { name:'_action', fn:(r,ctx)=> r.roas<1 ? 'Pause' : (r.roas>ctx.avgRoas*1.5 ? 'Scale' : 'Keep') } ],
        rules:[ { when:r=>r.roas<1, flag:'bad', suggest:'ROAS < 1 — pausing recommended.' } ],
      },
    },"""
CONVERSION_DASH = """    {
      id:'conversion', label:'Conversion', icon:'funnel', layout:'funnel', source:'primary',
      subtitle:'Where sessions drop off across the journey, from impression to conversion.',
      funnelTitle:'Acquisition funnel', funnel:{ identity:'sessions', steps:[
        { name:'Impressions', rate:1,    sql:'TRUE' },
        { name:'Clicks',      rate:0.32, sql:'clicks > 0' },
        { name:'Add to cart', rate:0.45, sql:'add_to_cart = 1' },
        { name:'Conversions', rate:0.38, sql:'conversions > 0' },
      ]},
    },"""
CONVERSION_FUNNEL = """    {
      id:'conversion', label:'Conversion', icon:'funnel', layout:'funnel', source:'primary',
      subtitle:'Where sessions drop off across the journey, from first touch to conversion.',
      funnelTitle:'Acquisition funnel', funnel:{ identity:'sessions', steps:[
        { name:'Visited',     rate:1,    sql:'TRUE' },
        { name:'Engaged',     rate:0.52, sql:'engaged = 1' },
        { name:'Add to cart', rate:0.41, sql:'add_to_cart = 1' },
        { name:'Purchased',   rate:0.36, sql:'purchases > 0' },
      ]},
    },"""
SEGMENTS = """    {
      id:'segments', label:'Segments', icon:'chart', layout:'breakdown-grid', source:'primary',
      subtitle:'Conversion volume by channel and device, to spot where the funnel leaks.',
      charts:[
        { title:'Conversions by platform', metric:'conversions', agg:'sum', dimension:'platform', type:'rankedBar', sort:'desc', palette:1, source:'Analytics', tooltip:'SUM(on-property conversions) by platform.' },
        { title:'Conversions by device',   metric:'conversions', agg:'sum', dimension:'device',   type:'bar',       sort:'desc', palette:2, source:'Analytics', tooltip:'SUM(on-property conversions) by device.' },
      ],
    },"""
LEADERBOARD = """    {
      id:'leaderboard', label:'Leaderboard', icon:'chart', layout:'comparison', source:'primary',
      subtitle:'Channels ranked by revenue, with spend small-multiples beside the leaderboard.',
      charts:[
        { title:'Revenue by platform', metric:'revenue', agg:'sum', dimension:'platform', type:'rankedBar', sort:'desc', palette:2, source:'Ad platforms', tooltip:'SUM(revenue) by platform, ranked.' },
        { title:'Spend vs ROAS (per campaign)', metric:'spend', metricY:'roas', dimension:'campaign_name', type:'scatter', palette:1, source:'Ad platforms', tooltip:'Each point is a campaign: x = SUM(spend), y = revenue ÷ spend.' },
      ],
      tableTitle:'Top campaigns',
      table:{
        columns:[
          { key:'campaign_name', label:'Campaign', type:'text', source:'Ad platforms', tooltip:'Campaign name as reported by the ad platform.' },
          { key:'platform', label:'Platform', type:'badge', source:'Ad platforms', tooltip:'Originating ad platform.' },
          { key:'revenue', label:'Revenue', type:'currency', source:'Ad platforms', tooltip:'SUM(revenue) for this campaign.' },
          { key:'spend', label:'Spend', type:'currency', source:'Ad platforms', tooltip:'SUM(spend) for this campaign.' },
          { key:'roas', label:'ROAS', type:'ratio', num:'revenue', den:'spend', source:'Ad platforms', tooltip:'revenue ÷ spend per row; the totals row pools SUM(revenue) ÷ SUM(spend).' },
        ],
        filters:[ {field:'platform',label:'Platform',kind:'select'} ],
      },
    },"""
CATALOG = """    {
      id:'catalog', label:'Catalog', icon:'table', layout:'data-table', source:'primary',
      subtitle:'Browse and search every record. No time dimension — filter by attributes.',
      tableTitle:'Records',
      table:{
        columns:[
          { key:'creative', label:'', type:'image', sortable:false },
          { key:'campaign_name', label:'Name', type:'text', source:'Ad platforms', tooltip:'Record name.' },
          { key:'platform', label:'Platform', type:'badge', source:'Ad platforms', tooltip:'Originating platform.' },
          { key:'objective', label:'Objective', type:'badge', source:'Ad platforms', tooltip:'Campaign objective.' },
          { key:'status', label:'Status', type:'status', source:'Ad platforms', tooltip:'Serving status.' },
          { key:'conversions', label:'Conversions', type:'number', source:'Analytics', tooltip:'SUM(conversions) for this record.' },
          { key:'revenue', label:'Revenue', type:'currency', source:'Analytics', tooltip:'SUM(attributed revenue) for this record.' },
        ],
        filters:[ {field:'platform',label:'Platform',kind:'select'}, {field:'objective',label:'Objective',kind:'select'}, {field:'status',label:'Status',kind:'select'} ],
      },
    },"""
OPTIMIZE_SEC = """    {
      // Optimize tab — offered only for campaign/ads-type schemas (cost + outcome + entity + changeable status).
      id:'optimize', label:'Optimize', icon:'optimize', layout:'optimize', source:'primary',
      subtitle:'Tune all your campaigns from one place: the agent spots wasted spend and winners worth scaling, drafts the fixes, and everything you approve is applied to your ad platforms — with results checked 7 days later.',
      optimize:{
        thresholds:{ bleedFloor:500, trimMult:1.8, scaleMult:0.6 },
        gateways:{ Search:{canWrite:true}, Social:{canWrite:true}, Video:{canWrite:false}, Display:{canWrite:false} },
      },
    },"""

PRESETS = {
    "dashboard":  (["funnel","optimize","copysummary"], "\n".join([OVERVIEW,CHANNELS,CAMPAIGNS,CONVERSION_DASH,LEADERBOARD,OPTIMIZE_SEC]), False),
    "funnel":     (["funnel"],                          "\n".join([CONVERSION_FUNNEL,SEGMENTS]), False),
    "comparison": ([],                                  LEADERBOARD, False),
    "catalog":    ([],                                  CATALOG, True),
    "optimize":   (["optimize"],                        OPTIMIZE_SEC, False),
}

if __name__ == "__main__":
    if len(sys.argv) > 1:  # one-off: compose base + named modules with the dashboard section set
        sys.stdout.write(compose([m for m in sys.argv[1:]], "\n".join([OVERVIEW,CHANNELS,CAMPAIGNS]), False))
    else:
        for name,(mods,secs,hd) in PRESETS.items():
            d = ROOT / "presets" / name; d.mkdir(parents=True, exist_ok=True)
            out = compose(mods, secs, hd)
            assert "@MODULE:" not in out, f"{name}: unreplaced marker"
            (d / "index.html").write_text(out)
            print(f"presets/{name}: {len(out.splitlines())} lines (modules={mods or 'none'}, hideDate={hd})")
