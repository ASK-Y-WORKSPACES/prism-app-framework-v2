# modules/optimize — campaign-optimization layout (v2, "Operator Cockpit")

Adds the `layout:'optimize'` section type: the operator loop from `OPTIMIZE_MODULE_SPEC.md`
(in this folder) — **01 suggested actions → 02 recommendations → 03 pending changes (review & send) →
04 campaigns ⇄ 05 campaign editor → 06 history & results.** Offer this only for
campaign/ads-type schemas (a cost metric + an outcome metric + an entity id/name + a
changeable status).

## Plain-language UI (v2.1)
The tab is written for operators who have never used it: the internal concepts keep their spec
names (console / staging / bulk editor / receipts), but the **UI says** Suggested actions · Recommendations
· Pending changes · Campaigns · Campaign editor · History & results. Every section headline has an
ⓘ tooltip explaining what it does, jargon is translated (CPA → "Cost / result", staged → "queued",
scored → "checked after 7 days"), and the section order walks the user through the flow top to
bottom: ask → review suggestions → review the queue → send → approve in the platform → see results.

## Recommendation engine + dismissal memory (no LLM)
Recommendations are **deterministic rules**, not an LLM: four thresholds over the campaign rows
(waste = spend with 0 results · expensive = cost/result > 1.8× the account average · winner =
< 0.6× · tired ads = CTR-decay fatigue ≥ 60) plus a per-platform coverage guardrail; card text is
templated, confidence copy is seeded static until real receipt stats exist. **Dismissals are
remembered** (localStorage, per browser): a dismissed rec never returns, and two preference-reason
dismissals ("Conflicts with strategy"/"Too risky") of the same rule type mute that rule — visible
as unmute chips + an "N dismissed · restore" link in the Recommendations header.

## The three governing rules (enforced by the module)
1. **The app stages; platforms publish.** A send lands in the platform's own staging surface
   (draft / paused batch) — go-live approval is always native. Not-connected sources deep-link
   out for a by-hand edit. There is no "make live" action anywhere.
2. **Nothing commits silently.** Recs, console commands, and bulk edits all become reviewable
   draft **batches** in 03 · Staging first. The console never stages directly — it drafts into
   the bulk editor for review.
3. **Every sent batch opens a receipt.** Forecast frozen at send; outcome verdict at +7 days
   (`beat / met / partial_miss / miss`) shown in 06 · Change history.

## Files (composed into base at the matching markers)
| File | Marker | Contents |
|---|---|---|
| `layout.html` | `@MODULE:LAYOUTS` | governance banner + KPI strip + the six cockpit sections |
| `modal.html` | `@MODULE:MODALS` | dismiss-reason modal + creative studio |
| `state.js` | `@MODULE:STATE` | the `opt:{…}` factory state (batches, console thread, bulk fields) |
| `loadhook.js` | `@MODULE:LOADHOOK` | builds entities + recs in `loadSection` |
| `methods.js` | `@MODULE:METHODS` | `optBuild`, batches, send/receipts, console grammar, bulk compute, creative studio |

## Suggested actions: data-driven, pre-validated chips (no input, no questions, no thread)
Chips are generated per-load from the live campaigns (`optConChips`) and each is checked to match
≥1 campaign before it renders, so a click never hits "no match". Only unambiguous scopes are
offered — bulk-pause the expensive tail (all > 1.5× the account average) and "scale +20%" per named
winner (< 0.6× average, matches exactly that campaign). Platform/theme grouping is avoided (it mixes
winners and losers). Empty-state line shown when nothing qualifies.
Deterministic quick commands parse instantly and free: `pause … cost per result > N` ·
`pause … that have X` · `change … that have X into paused` · `set budget ±N% for X` ·
`why is X expensive`. **Anything else falls through to the Asky investigation agent** (the same
LLM behind the chat panel and creative studio, via `/chat/start` + `/chat/poll` — deployed app
only, Mode-2 cookie auth). The agent receives the campaign list and must return structured JSON:
`{"kind":"act", field, value, campaignIds, reply}` → drafted into the Campaign editor exactly like
a quick command (select + amber prefill — **never sent, never staged directly**), or
`{"kind":"answer", reply}` → shown in the thread. In demo/synthetic mode only quick commands work
(no backend); unmatched input explains that.

## Creative studio (refresh ad copy → new paused ad set)
Each row's **✨ Refresh** opens a modal to regenerate ad copy (Asky agent; canned variants in
synthetic mode) and add it as a **new paused ad set** — inherently platform-staged, logged to
Staging/History as a batch. Real writes need `optimize.creative.accountPath` (e.g. `'/act_123'`).

## Connection model — connected vs. not connected (IMPORTANT)
A source can be edited from the app only when it has an API gateway. `optSourceConnected(source)`
is the single source of truth:

| `gateways[source]` | meaning | at send | history status |
|---|---|---|---|
| `{ connected:true }` (or `{ canWrite:true }`) | **connected** | pushed into the platform's staging area (paused draft `prism-batch-{id}`) | `AWAITING PLATFORM APPROVAL` → `LIVE` once approved natively |
| `{ connected:false }`, or no entry | **not connected** | the app deep-links out — the operator applies by hand, then marks approved | same vocabulary, lane labeled not connected |

Without a gateway the app never claims it changed anything. → A `deepLink[source]` is effectively
required for any not-connected source (otherwise a sensible per-platform default URL is used).
Default (no `gateways` entry) is **not connected** — opt in explicitly to push.

**Honest badges:** only a gateway-connected source shows green "live via API". A Prism-table-only
source shows its **data freshness** instead — "data updated today / yesterday / N days ago", from
the max date in its raw rows (`optSrcFresh`), never a false "live".

## Config — an optimize section
```js
{ id, label, icon:'optimize', layout:'optimize', source:'primary',
  subtitle:'…agent recommendations, staged as reviewable batches, approved natively in each platform…',
  optimize:{
    thresholds:{ bleedFloor:500, trimMult:1.8, scaleMult:0.6, fatigueRule:60 },
    gateways:{ <source>:{ connected:true } },        // connected → app pushes to the platform's staging area; omit → link-out only
    deepLink:{ <source>: row => 'https://…/?id='+row.rowId },  // recommended for not-connected sources
    creative:{ accountPath:'/act_123' },             // (optional) ad-account path for REAL creative ad-set writes
  },
}
```
In synthetic mode the whole loop is demoable offline: stage → send → approve → LIVE → the
`simulate +7d` control fills the receipt verdict.

## Compose
```bash
python3 compose.py optimize    # base + optimize
```
Pre-composed example: `presets/optimize/`. The full contract is `OPTIMIZE_MODULE_SPEC.md`.
