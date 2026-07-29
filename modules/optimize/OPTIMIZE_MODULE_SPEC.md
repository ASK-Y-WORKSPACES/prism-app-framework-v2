# Optimize Module — Portable Spec (v2, "Operator Cockpit")

A **schema-adaptive campaign-optimization module** that runs on top of any Prism data model.
It reads "optimizable entities" (campaigns/ad sets/line items — anything with a **cost** metric, an
**outcome** metric, and a **state** you can change), generates ranked agent recommendations,
collects every intended change into reviewable **batches** in a Staging area, sends batches to each
platform's **own staging surface** (draft / paused batch), and scores every send with a **receipt**
(forecast frozen at send, outcome at +7 days).

v2 supersedes the v1 "arm → sign-off → launch → verify-modal" flow. The operator loop is now the
six-part cockpit, ordered as a guided flow: **01 Suggested actions (console; chips only, no free-text box) →
02 Recommendations → 03 Pending changes (staging) → 04 Campaigns ⇄ 05 Campaign editor (bulk
editor) → 06 History & results.** Spec names stay canonical below; the UI uses the plain-language
labels in parentheses, and every section headline carries an ⓘ tooltip explaining the section. This spec is a **Prism-agnostic contract** — the ad-platform
shapes used as examples are illustrative profiles, never the contract. Standing up Optimize on a
new Prism = authoring one `optimize` config (§13); no engine or UI changes.

---

## 0. The three governing rules (non-negotiable)

1. **The app stages; platforms publish.** Every change leaves the app as a *platform-staged draft*
   (e.g. a Google Ads Draft or a Meta paused batch). Final go-live approval happens natively in the
   platform. The app has no "make live" button and no code path that activates a change. For a
   **not-connected** source (no API gateway) the same rule degrades gracefully: the app deep-links
   the operator to the platform to apply the change by hand — it never claims it changed anything.
2. **Nothing commits silently.** Every change — from a recommendation, the console, or the bulk
   editor — lands in **03 Staging** as a reviewable draft batch before it can be sent. There is no
   path from intent to platform that skips Staging.
3. **Every sent batch opens a receipt.** Forecast frozen at send (deterministic impact model),
   outcome scored at **+7 days after go-live**. Receipts are append-only and render in
   **06 Change history**.

---

## 1. Goal & non-goals

One surface for a paid-media operator to: see where spend is wasted, get agentic recommendations
with confidence + impact, act in bulk or in natural language, review everything in a staging cart,
send to the platform's native approval surface, and learn from receipts.

**Non-goals:** a reporting dashboard (the analytics tabs do that) · budget pacing · MMM/attribution ·
approvals *inside* the app (the platform **is** the approval) · undo of live changes (a revert is a
new staged change) · ad-level bulk editing.

---

## 2. Data contract — what a Prism must provide

The module binds source rows to entities via column roles (resolved by config, else inference):

| Role | Required | Meaning | Example column |
|---|---|---|---|
| `id` / `name` | ✅ | stable entity id + label | campaign_id / campaign_name |
| `status` | ✅ | maps to `ACTIVE / PAUSED / ENDED` | status |
| `cost` | ✅ | spend in the period | spend |
| `outcome` | ✅ | conversions/goal count | conversions |
| `source` | ◻︎ | channel/platform partition (drives lanes, gateways, coverage) | platform |
| `ctr` | ◻︎ | enables fatigue scoring | ctr |
| `dailyBudget` | ◻︎ | current daily budget; when absent it is **estimated ≈ cost/7** and labeled `≈` | daily_budget |

Derived: `cpa = cost/outcome` (null at 0), `fatigue` (0–100 CTR decay vs cohort mean), `daily`.

---

## 3. Change model — batches (the state machine)

```js
Batch {
  id, source: 'agent'|'bulk'|'console'|'manual',
  title, createdAt, sentAt?, resolvedAt?,
  changes: [{ id, recId?, rowId, target, source /*platform*/, param, before, after }],
  status: 'draft' → 'platform_staged' → 'live' | 'rejected',
  lanes:   [{ source, connected, n, url }],          // set at send
  forecast:{ text, confidence, frozenAt },           // receipt half 1 — frozen at send
  outcome: { verdict:'beat'|'met'|'partial_miss'|'miss', text, scoredAt },  // receipt half 2 — +7d
}
```

No other transitions are permitted. `draft` batches are editable (per-change ✕, remove batch);
everything after send is immutable. A **revert** stages the inverse changes as a *new* draft batch.

---

## 4. Section specs

### 01 · Recommendations
Rule-based rec cards over the active cohort (all thresholds in `optimize.thresholds`):

| Rule | Condition (defaults) | Rec | Sev |
|---|---|---|---|
| Bleeding | `cost ≥ bleedFloor(500) && outcome === 0` | pause | Critical |
| Overspend | `outcome ≥ 3 && cpa > trimMult(1.8)·avg` | budget −20% | High |
| Winner | `outcome ≥ 8 && cpa < scaleMult(0.6)·avg` | scale +20% | Opportunity |
| Fatigue | `fatigue ≥ fatigueRule(60) && outcome ≥ 1` | refresh creative | High |

**Source-coverage guardrail:** ≥1 rec per source that has an active entity (a "Review" rec for its
worst entity when nothing tripped). Card anatomy: sev badge + source → title → why → **impact**
(concrete, e.g. "stops −$89/day at risk") → footer `Stage fix` / `Dismiss` / **confidence with
calibration copy** (seeded static until real receipt aggregates reach n≥30).
`Stage fix` creates a `Batch{source:'agent'}` with the concrete before→after changes.
`Dismiss` opens a reason modal (didn't work before / conflicts with strategy / reasoning wrong /
too risky + free text) — logged to the rec feedback store.
**Auto-stage toggle:** new recs stage themselves on arrival; a toast reminds "you still review
before anything is sent."

### 02 · Console (ask & act)
Input + suggestion chips + collapsible thread. **Two verbs**, deterministic regex grammar (an LLM
slot can replace the parser behind the same interface later):

| Pattern | Effect |
|---|---|
| `pause … cpa > N` | select matches → bulk editor: Status=PAUSED |
| `pause … that have X` | Status=PAUSED |
| `change/set/turn … have X into/to Y` | Y∈{paused,active}→Status · ±N%→Budget |
| `set/raise/lower budget ±N% for X` | Budget ±N% |
| `why is X …` | diagnostic reply: `Observed:` facts + *Hypothesis* + pointer to the related rec |
| fallback | help listing the grammar |

**Act never stages directly** — it selects the matched campaigns in 04, pre-fills the Bulk editor
(fields highlight amber), and replies "Matched N campaigns → drafted in the Bulk editor. Review the
highlighted fields, then Stage changes." Zero matches → explicit "no match", never a guess.

### 03 · Staging
Collapsed bar: `N pending changes in M batches · K sent, awaiting platform approval` + green
`Send all to platforms ↗`. Expanded: governance line ("Everything below is a draft… This app has no
'make live' button — by design."), then batch cards newest-first: source badge, title,
`HH:MM · N changes`, per-change table (✕ | Target | Platform | Parameter | before→after),
`Remove` / `Send to platform ↗`. Removing the last change removes the batch.
**Send** freezes the forecast, splits the batch into per-platform lanes:
- **connected lane** → "uploaded as a paused draft 'prism-batch-{id}' — approve go-live in {platform} ↗"
- **not-connected lane** → "open {platform}, apply by hand, then mark approved"
The operator then records what happened natively: `✓ Approved in platform` → `live` (receipt opens)
or `Rejected in platform` → `rejected`.

### 04 · Campaign list
Search + filter chips (`All / <each source> / Needs attention`) + select-all-visible checkbox +
selection hint (`N selected → bulk editor`). Columns: ☑ · Campaign · Source · Status · Cost ·
Outcome · CPA (red >1.5× avg, green <0.6×) · Fatigue · **Staged** (chip per draft change on the
row; click removes it from its batch) · Creative (✨ Refresh → creative studio).

### 05 · Bulk editor
Empty state points at the list and the console. With a selection: meta header
(`N campaigns — a Search, b Social`), then the field catalog — every control defaults to
**"no change"**; a set field turns amber:

| Field | Applies |
|---|---|
| Status (chips) · Daily budget (abs `120` or `±20%`) · Bid/cost cap (±%) · Dayparting | all sources |
| Add negatives | search-type sources only |
| Frequency cap | social-type sources only |

Compute rules: relative budget resolves per campaign against its (estimated) daily; a value equal
to current is dropped; non-applicable platform fields are **skipped and counted**. Footer:
`N staged edits · K skipped (n/a for platform)` + `Stage changes → Staging` → creates
`Batch{source:'bulk'|'console'}` titled `Bulk edit — N campaigns (M parameters)`, clears pending,
opens Staging, toasts.

### 06 · Change history
One row per sent batch, newest first: When · Source badge · Batch · Changes · Platforms · Status ·
Receipt. Status vocabulary (exact): `AWAITING PLATFORM APPROVAL` (amber) · `LIVE — approved in
platform HH:MM` (green) · `REJECTED IN PLATFORM — draft discarded by operator` (red). Receipt
column: `opens at go-live` → `scores +7d` (synthetic mode adds a `simulate +7d` control) →
`✓ beat forecast — …` / `~ partial miss — …` / `✗ miss — …`. Row click expands the full change
table + forecast/outcome detail + `Revert` (stages the inverse as a new draft).

---

## 5. Receipts (deterministic impact model)

At send: pause → saved/day = est. daily spend; budget ±% → Δspend/day; creative → "recovers CPA
12–18%" copy; negatives → "saves 5–15% of wasted search spend" copy. Confidence `med` when ≥3
changes, else `low`. At +7d a scoring job (simulated in synthetic mode) writes the verdict:
`beat / met / partial_miss / miss`. Calibration copy on rec cards ("calibrated 78%, n=142") is
seeded static until real receipt aggregates reach n≥30.

---

## 6. Connection model — connected vs. not connected

`optSourceConnected(source)` is the single source of truth (config: `optimize.gateways`):

| `gateways[source]` | meaning | at send | history |
|---|---|---|---|
| `{connected:true}` / `{canWrite:true}` | **connected** — API gateway | app pushes the batch into the platform's staging area (draft / paused) | `AWAITING PLATFORM APPROVAL` → `LIVE` once approved natively |
| `{connected:false}` or no entry | **not connected** | deep-link out; the operator applies by hand, then marks approved | same vocabulary, lane labeled "not connected" |

→ A `deepLink[source]` is effectively required for any not-connected source (falls back to a
per-platform default URL). Default (no entry) is **not connected** — pushing is opt-in.
**The gateway contract has no publish/activate capability — this is the architectural enforcement
of rule #1.**

### Creative studio (refresh ad copy → new paused ad set)
A direct action, not a cart change — the result is *inherently* platform-staged (a **paused** ad
set that spends nothing until enabled natively). Generate variants (Asky investigation agent
`/chat/start`+`/chat/poll`; canned variants in synthetic mode) → pick & edit (char budgets
40/125/30) → confirm. Logged to Staging/History as a `platform_staged` batch. Real writes require
`optimize.creative.accountPath`.

---

## 7–12. UI composition, scoring, security (unchanged contracts)

- **Scoring (pure):** fatigue = CTR decay vs cohort mean (0–100); CPA per entity; cohort averages
  over active entities only.
- **Slicers/KPIs:** KPI strip = cost · outcomes · blended CPA · fatigued count · open recs, over
  the filtered set. Chips are generated from the bound `source` dimension — never hardcoded.
- **Security:** writes only via declared gateways; sends for not-connected sources never claim
  success; deep-links open the operator's own authenticated session; the module never handles
  platform credentials; every batch records provenance (Agent/Bulk/Console/Manual) and status.
- **Demo fallback:** with nothing connected the module runs on synthetic rows spanning every
  configured source; sends are simulated; the `simulate +7d` control drives receipt scoring so the
  **full loop is demoable offline**: rec → stage → send → approve → LIVE → verdict.

---

## 13. Per-deployment configuration

```js
{ id, label, icon:'optimize', layout:'optimize', source:'primary',
  subtitle:'…',
  optimize:{
    thresholds:{ bleedFloor:500, trimMult:1.8, scaleMult:0.6, fatigueRule:60 },
    gateways:{ <source>:{ connected:true } },   // connected → app pushes to the platform's staging area; omit → link-out only
    deepLink:{ <source>: row => 'https://…' },  // recommended for every not-connected source
    creative:{ accountPath:'/act_123' },        // optional — real creative ad-set writes
  },
}
```

Standing up Optimize on a new Prism = author this one block. No engine/UI changes.

---

## 14. Acceptance criteria

1. With only required roles bound, the module renders entities, KPIs, and recs with no errors.
2. Recs always include ≥1 per source that has an active entity; every rec card carries impact +
   confidence; Dismiss requires/records a reason; auto-stage stages new recs with the reminder toast.
3. **No path from intent to platform skips Staging** — recs, console, and bulk editor all create
   draft batches; the console only drafts into the bulk editor.
4. A draft change is removable from the list row, the batch card, and via Remove batch; removal of
   the last change removes the batch.
5. Send produces per-platform lanes with correct connected/not-connected copy + deep links; batch
   status becomes `AWAITING PLATFORM APPROVAL`; approve/reject is recorded, never performed, by the app.
6. Every sent batch has a forecast frozen at send; live batches score a verdict at +7d (simulated
   control in synthetic mode); history shows all three statuses with the exact vocabulary.
7. Revert stages inverse changes as a new draft — no in-place undo.
8. The full loop works offline in synthetic mode end-to-end.
9. Re-pointing at a different Prism requires only a new `optimize` config.
