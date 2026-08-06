    /* ── optimize module v2 — the guided operator loop (OPTIMIZE_MODULE_SPEC.md):
       01 suggested actions → 02 recommendations → 03 pending changes (review & send) →
       04 campaigns ⇄ 05 campaign editor → 06 history & results.
       Three governing rules:
       1. THIS APP STAGES; PLATFORMS PUBLISH. A send lands as a platform-staged draft / paused batch —
          go-live approval happens natively in the platform. There is no "make live" action here.
       2. NOTHING COMMITS SILENTLY. Every change — rec, console, bulk editor — becomes a reviewable
          draft batch in Staging before it can be sent.
       3. EVERY SENT BATCH OPENS A RECEIPT. Forecast frozen at send, outcome scored at +7 days. */
    optBuild(sec,rows){
      const ents=rows.map(r=>({ id:r.campaign_id, name:r.campaign_name, source:r.platform, status:r.status,
        cost:+r.spend||0, outcome:+r.conversions||0, ctr:+r.ctr||0, roas:+r.roas||0, cpa:r.cpa }));
      const active=ents.filter(e=>e.status==='ACTIVE');
      const withCpa=active.filter(e=>e.cpa!=null && isFinite(e.cpa));
      const avgCpa=withCpa.length? withCpa.reduce((a,b)=>a+b.cpa,0)/withCpa.length : 0;
      const avgCtr=active.length? active.reduce((a,b)=>a+b.ctr,0)/active.length : 0;
      // fatigue (0–100): CTR decay vs cohort mean · daily ≈ period spend / 7 (no budget column required)
      ents.forEach(e=>{ e.fatigue = avgCtr? Math.max(0, Math.min(100, Math.round(((avgCtr-e.ctr)/avgCtr)*100))) : 0; e.daily=e.cost/7; });
      this.opt.avgCpa=avgCpa;
      const th=(sec.optimize&&sec.optimize.thresholds)||{}; const bleedFloor=th.bleedFloor!=null?th.bleedFloor:500;
      const trim=th.trimMult||1.8, scale=th.scaleMult||0.6, fatRule=th.fatigueRule||60;
      let recs=[];
      for(const e of active){
        if(e.cost>=bleedFloor && e.outcome===0) recs.push(this.optRec(e,'pause','Critical','negative','Pause '+e.name,'$'+Math.round(e.cost)+' spent, 0 results in the period — pure waste.'));
        else if(e.cpa && e.outcome>=3 && e.cpa>trim*avgCpa) recs.push(this.optRec(e,'budget','High','warning','Lower budget −20% · '+e.name,'Cost per result $'+e.cpa.toFixed(0)+' vs your average $'+avgCpa.toFixed(0)+' — paying '+(e.cpa/avgCpa).toFixed(1)+'× the going rate.'));
        else if(e.cpa && e.outcome>=8 && e.cpa<scale*avgCpa) recs.push(this.optRec(e,'scale','Opportunity','positive','Raise budget +20% · '+e.name,'Cost per result $'+e.cpa.toFixed(0)+' beats your average — a winner with room to grow.'));
        else if(e.fatigue>=fatRule && e.outcome>=1) recs.push(this.optRec(e,'creative','High','warning','Refresh tired ad copy · '+e.name,'Fatigue '+e.fatigue+'/100 — people click it less than your average ad (CTR '+(e.ctr*100).toFixed(2)+'% vs '+(avgCtr*100).toFixed(2)+'%).'));
      }
      // source-coverage guardrail: ≥1 rec per source that has an active entity
      const srcs=[...new Set(active.map(e=>e.source))];
      for(const s of srcs){ if(!recs.some(r=>r.source===s)){ const worst=active.filter(e=>e.source===s).sort((a,b)=>b.cost-a.cost)[0];
        if(worst) recs.push(this.optRec(worst,'review','Medium','info','Review '+worst.name,'Your biggest spender on '+s+' — nothing wrong detected, but worth a look.')); } }
      // memory: dismissed recs never come back; muted rule types don't generate at all (both persisted per browser)
      recs=recs.filter(r=>!this.optRecStaged(r.id) && !this.opt.dismissed[r.id] && !this.opt.muted[r.kind]);
      this.opt.entities=ents; this.opt.recs=recs; this.opt.sources=[...new Set(ents.map(e=>e.source))];
      // Per-source DATA freshness. A source without an API gateway is read-only Prism data — the honest
      // badge there is "when was this data last updated": max date in the RAW rows (unfiltered), capped at today.
      try{ const all=this.rowsBySource((sec&&sec.source)||'primary');
        const dc=((APP_CONFIG.dataSources[(sec&&sec.source)||'primary']||{}).dateCol)||'event_date';
        const today=new Date().toISOString().slice(0,10); const fresh={};
        for(const r of all){ const s=r.platform; let v=r[dc]!=null?String(r[dc]).slice(0,10):(r.active_to?String(r.active_to).slice(0,10):null);
          if(!s||!v) continue; if(v>today) v=today;
          if(!fresh[s]||v>fresh[s]) fresh[s]=v; }
        this.opt.fresh=fresh; }catch(e){ this.opt.fresh={}; }
      // auto-stage: new recs stage themselves on arrival — the operator still reviews before anything is sent
      if(this.opt.autoStage && recs.length){ const n=recs.length; [...recs].forEach(r=>this.optStageRec(r,true));
        this.toast(n+' recommendation'+(n===1?'':'s')+' auto-queued — you still review in Pending changes before anything is sent'); }
      const cost=active.reduce((a,b)=>a+b.cost,0), outcome=active.reduce((a,b)=>a+b.outcome,0);
      const fatigued=active.filter(e=>e.fatigue>=fatRule).length;
      const cF=fmt('currency',cost), oF=fmt('count',outcome);
      const src='Ad platforms (active campaigns)';
      sec._optKpis=[
        {label:'Spend (active)',   val:cF.label, exact:cF.exact, tip:'Total spend of campaigns currently running.'},
        {label:'Results',          val:oF.label, exact:oF.exact, tip:'Total conversions from active campaigns — sales, leads, sign-ups.'},
        {label:'Cost / result',    val:outcome?('$'+(cost/outcome).toFixed(2)):'—', tip:'Spend ÷ results. Lower is better.'},
        {label:'Tired ads',        val:''+fatigued, tip:'Campaigns whose ads get noticeably fewer clicks than your average — time for fresh creative.'},
        {label:'Open recommendations', val:''+this.opt.recs.length, tip:'Suggested fixes you haven’t queued or dismissed yet.'}];
    },
    // rec card payload: title + why + concrete impact line + seeded confidence/calibration copy
    optRec(e,kind,sev,tone,title,why){
      const d=Math.round(e.daily||0);
      const impact = kind==='pause' ? ('stops ≈$'+d+'/day of wasted spend immediately')
        : kind==='budget' ? ('frees ≈$'+Math.round((e.daily||0)*0.2)+'/day · cost per result drifts back toward your average')
        : kind==='scale' ? ('≈'+Math.max(1,Math.round(e.outcome*0.2))+' more results/week at the same cost per result')
        : kind==='creative' ? 'fresh copy typically lowers cost per result 12–18%'
        : 'directional — no rule tripped';
      const conf={ pause:'88% (calibrated 84%, n=63)', budget:'81% (calibrated 78%, n=142)', scale:'76% (calibrated 74%, n=88)', creative:'72% (calibrated 70%, n=51)' }[kind]||'low–med (small sample)';
      return { id:kind+'-'+e.id, rowId:e.id, source:e.source, campaign:e.name, kind, sev, tone, title, why, impact, conf };
    },
    recBadge(r){ return r.tone==='negative'?'bg-[var(--negative-light)] text-[var(--negative)]':r.tone==='warning'?'bg-[var(--warning-light)] text-[var(--warning)]':r.tone==='positive'?'bg-[var(--positive-light)] text-[var(--positive)]':'bg-[var(--primary-light)] text-[var(--primary)]'; },
    statusBadge(s){ const tone=s==='ACTIVE'?'positive':s==='PAUSED'?'warning':'neutral'; return `<span class="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--${tone}-light)] text-[var(--${tone})]">${s}</span>`; },
    optSrcBadge(s){ return { agent:'bg-[var(--warning-light)] text-[var(--warning)]', bulk:'bg-[var(--primary-light)] text-[var(--primary)]', console:'bg-[var(--primary-light)] text-[var(--primary)]', manual:'bg-[var(--surface)] text-[var(--muted-foreground)]' }[s]||'bg-[var(--surface)] text-[var(--muted-foreground)]'; },
    optSrcLabel(s){ return { agent:'Recommendation', bulk:'Editor', console:'Suggestion', manual:'Manual' }[s]||s; },
    optNow(){ const d=new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); },
    optToggleSec(k){ this.opt.collapsed[k]=!this.opt.collapsed[k]; safeSet('optCollapsed', this.opt.collapsed); },
    // "data updated …" label for a read-only (no-gateway) source, from the max date in its raw rows
    optSrcFresh(s){ const v=this.opt.fresh&&this.opt.fresh[s]; if(!v) return null;
      const days=Math.max(0, Math.round((new Date(new Date().toISOString().slice(0,10)) - new Date(v))/86400000));
      return 'data updated '+(days===0?'today':days===1?'yesterday':days<=31?(days+' days ago'):('on '+v)); },
    // explanation tooltip — like metricTipHtml but WITHOUT the Source line (these are explanations, not metrics)
    optTipHtml(label,how){ const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<b>'+esc(label)+'</b>'+(how?('<br>'+esc(how)):''); },

    /* ── batches (the change model) — draft → platform_staged → live | rejected ── */
    optNewBatch(src,title,changes){ const b={ id:'b'+(this.opt.seq++), source:src, title, changes, status:'draft', createdAt:this.optNow(), sentAt:null, resolvedAt:null, lanes:null, forecast:null, outcome:null };
      this.opt.batches.unshift(b); return b; },
    optDrafts(){ return this.opt.batches.filter(b=>b.status==='draft'); },
    optDraftChanges(){ return this.optDrafts().reduce((a,b)=>a+b.changes.length,0); },
    optAwaiting(){ return this.opt.batches.filter(b=>b.status==='platform_staged').length; },
    optStagingList(){ return this.opt.batches.filter(b=>b.status==='draft'||b.status==='platform_staged'); },
    optHistory(){ return this.opt.batches.filter(b=>b.status!=='draft'); },
    optRecStaged(recId){ return this.opt.batches.some(b=>b.status==='draft'&&b.changes.some(c=>c.recId===recId)); },
    optStagedFor(rowId){ const out=[]; this.optDrafts().forEach(b=>b.changes.forEach(c=>{ if(c.rowId===rowId) out.push({batch:b,change:c}); })); return out; },
    optBatchSources(b){ return [...new Set(b.changes.map(c=>c.source))]; },
    optChange(r,param,before,after){ return { id:r.id+'-'+param.replace(/\W+/g,''), recId:r.id, rowId:r.rowId, target:r.campaign, source:r.source, param, before, after }; },
    optRecChanges(r){ const e=this.optEntity(r.rowId)||{}; const d=Math.round(e.daily||0);
      if(r.kind==='pause')    return [this.optChange(r,'Status','ACTIVE','PAUSED')];
      if(r.kind==='budget')   return [this.optChange(r,'Daily budget','≈$'+d+'/d','−20% (≈$'+Math.round(d*0.8)+'/d)')];
      if(r.kind==='scale')    return [this.optChange(r,'Daily budget','≈$'+d+'/d','+20% (≈$'+Math.round(d*1.2)+'/d)')];
      if(r.kind==='creative') return [this.optChange(r,'Ad copy','current (tired)','fresh copy → new paused ad set')];
      return [this.optChange(r,'Review','—','flagged for review in the platform')]; },
    optStageRec(r,silent){ if(this.optRecStaged(r.id)) return;
      this.optNewBatch('agent', r.title, this.optRecChanges(r));
      this.opt.recs=this.opt.recs.filter(x=>x.id!==r.id);
      if(!silent) this.toast('Queued — review it in 03 · Pending changes, then send'); },
    optDismissOpen(r){ this.opt.dismissRec=r; this.opt.dismissReason=''; this.opt.dismissNote=''; },
    /* Dismissal memory (localStorage, per browser):
       - a dismissed rec (this campaign + this rule) never comes back, across refreshes;
       - dismissing the SAME rule type twice with a preference reason ("Conflicts with strategy" /
         "Too risky") mutes that rule entirely — shown as a chip in the header, unmute anytime. */
    optDismissConfirm(){ const r=this.opt.dismissRec; if(!r) return;
      const reason=this.opt.dismissReason||'no reason given';
      this.opt.dismissed[r.id]={ kind:r.kind, reason, note:this.opt.dismissNote, at:this.optNow() };
      safeSet('optDismissed', this.opt.dismissed);
      const pref=/strategy|risky/i.test(reason);
      const sameKindPref=Object.values(this.opt.dismissed).filter(x=>x.kind===r.kind && /strategy|risky/i.test(x.reason||'')).length;
      if(pref && sameKindPref>=2 && !this.opt.muted[r.kind]){
        this.opt.muted[r.kind]={ at:this.optNow(), after:sameKindPref }; safeSet('optMuted', this.opt.muted);
        this.opt.recs=this.opt.recs.filter(x=>x.kind!==r.kind);
        this.toast('“'+this.optKindLabel(r.kind)+'” suggestions muted — you dismissed '+sameKindPref+' as against your strategy. Unmute anytime in Recommendations.');
      } else { this.toast('Dismissed — this suggestion won’t come back (remembered on this browser)'); }
      this.opt.recs=this.opt.recs.filter(x=>x.id!==r.id); this.opt.dismissRec=null; },
    optKindLabel(k){ return { pause:'Pause waste', budget:'Lower budget', scale:'Raise budget', creative:'Refresh ad copy', review:'Review' }[k]||k; },
    optUnmute(k){ delete this.opt.muted[k]; safeSet('optMuted', this.opt.muted); this.reloadSection(); this.toast('“'+this.optKindLabel(k)+'” suggestions are back on'); },
    optDismissedCount(){ return Object.keys(this.opt.dismissed).length; },
    optRestoreDismissed(){ this.opt.dismissed={}; safeSet('optDismissed', this.opt.dismissed); this.reloadSection(); this.toast('Dismissed suggestions restored'); },
    optRemoveChange(b,c){ b.changes=b.changes.filter(x=>x.id!==c.id);
      if(!b.changes.length) this.opt.batches=this.opt.batches.filter(x=>x.id!==b.id); this.reloadSection(); },
    optRemoveBatch(b){ this.opt.batches=this.opt.batches.filter(x=>x.id!==b.id); this.reloadSection(); },

    /* ── send = push to the PLATFORM'S staging area (draft / paused batch). Never live from here. ──
       Connected source (API gateway) → the app stages it in the platform for native approval.
       Not-connected source → deep-link out: the operator applies it by hand, then marks it approved. */
    // sources in this batch that have NO API connection — the app can't place anything for them
    optBatchManualSources(b){ return this.optBatchSources(b).filter(s=>!this.optSourceConnected(s)); },
    optBatchAllManual(b){ const s=this.optBatchSources(b); return s.length>0 && s.every(x=>!this.optSourceConnected(x)); },
    optSend(b, quiet){ if(b.status!=='draft'||!b.changes.length) return;
      b.forecast=this.optForecast(b); b.sentAt=this.optNow(); b.status='platform_staged';
      b.lanes=this.optBatchSources(b).map(s=>({ source:s, connected:this.optSourceConnected(s), n:b.changes.filter(c=>c.source===s).length, url:this.optDeepLink({source:s}) }));
      const conn=b.lanes.filter(l=>l.connected), manual=b.lanes.filter(l=>!l.connected);
      if(quiet) return;
      // A connected platform is updated through its API (a paused draft you approve there). A NOT-connected
      // platform has no API — nothing was placed; open it so the user signs in and makes the change themselves.
      manual.forEach(l=>{ try{ window.open(l.url, '_blank', 'noopener'); }catch(e){} });
      const plat=manual.length>1?'the platforms':'the platform';
      if(conn.length && manual.length)
        this.toast('Updated as paused drafts in '+conn.map(l=>l.source).join(', ')+' (approve go-live there). Opened '+plat+' for the rest — no API connection, so make those changes yourself, then mark them approved here for your records.');
      else if(conn.length)
        this.toast('Sent — the changes sit as a paused draft inside '+conn.map(l=>l.source).join(', ')+'. You approve go-live there, never here.');
      else
        this.toast('Opened '+plat+' — no API connection, so sign in and make the change yourself, then mark it approved here for your records.'); },
    optSendAll(){ const drafts=this.optDrafts().slice(); if(!drafts.length) return;
      drafts.forEach(b=>this.optSend(b, true));   // quiet: no per-batch toast / tab spam
      const manual=[...new Set(this.opt.batches.filter(b=>b.status==='platform_staged'&&b.lanes).flatMap(b=>b.lanes.filter(l=>!l.connected).map(l=>l.source)))];
      this.toast(drafts.length+' batch'+(drafts.length===1?'':'es')+' sent.'+(manual.length?(' Not connected: '+manual.join(', ')+' — open each from Pending changes (“Edit in …”) to make the change yourself, then mark approved.'):' Approve go-live in each platform.')); },
    // receipt half 1 — deterministic impact model, frozen at send
    optForecast(b){ let save=0, shift=0; const notes=[];
      b.changes.forEach(c=>{ const e=this.optEntity(c.rowId)||{daily:0};
        if(c.param==='Status'&&c.after==='PAUSED') save+=e.daily||0;
        else if(c.param==='Daily budget'){ const m=(c.after||'').replace(/−/g,'-').match(/([+-]\d+(?:\.\d+)?)\s*%/); if(m) shift+=(e.daily||0)*parseFloat(m[1])/100; }
        else if(c.param==='Ad copy') notes.push('fresh copy: cost per result typically drops 12–18%');
        else if(/negative/i.test(c.param)) notes.push('negative keywords: save 5–15% of wasted search spend'); });
      const parts=[]; if(save) parts.push('saves ≈$'+Math.round(save)+'/day');
      if(shift) parts.push((shift>0?'+':'−')+'$'+Math.abs(Math.round(shift))+'/day spend change');
      notes.forEach(n=>parts.push(n));
      return { text: parts.length?parts.join(' · '):'no measurable spend change — directional', confidence: b.changes.length>=3?'med':'low', frozenAt:this.optNow() }; },
    // the operator confirms what happened NATIVELY in the platform — the app only records it
    optResolve(b,status){ if(b.status!=='platform_staged') return; b.status=status; b.resolvedAt=this.optNow();
      if(status==='live') this.toast('Live — the result will be checked against the forecast in 7 days'); else this.toast('Rejected — draft discarded in the platform'); },
    // receipt half 2 — +7d scoring: a scoring job fills the verdict at +7d.
    // a revert is a NEW staged change (inverse), never an in-place undo
    optRevertBatch(b){ const inv=b.changes.map(c=>({ ...c, id:'rev-'+c.id+'-'+(this.opt.seq), recId:null, before:c.after, after:c.before }));
      this.optNewBatch('manual','Revert — '+b.title, inv); this.opt.stagingOpen=true; this.toast('Revert queued in Pending changes — review & send like any other change'); },

    /* ── 04 campaign list — search, chips, selection ── */
    optSelectedIds(){ return Object.keys(this.opt.selected).filter(k=>this.opt.selected[k]); },
    optEntity(id){ return this.opt.entities.find(e=>e.id===id); },
    optChips(){ return ['All',...this.opt.sources,'Needs attention']; },
    optVisible(){ const q=(this.opt.search||'').toLowerCase(), chip=this.opt.chip;
      return (this.opt.entities||[]).filter(e=>{
        if(q && !((e.name||'').toLowerCase().includes(q)||(e.source||'').toLowerCase().includes(q))) return false;
        if(chip==='All') return true;
        if(chip==='Needs attention') return (e.cpa!=null&&this.opt.avgCpa&&e.cpa>1.5*this.opt.avgCpa)||e.fatigue>=60||(e.cost>=200&&e.outcome===0);
        return e.source===chip; }).slice(0,60); },
    optAllChecked(){ const v=this.optVisible(); return v.length>0 && v.every(e=>this.opt.selected[e.id]); },
    optToggleAll(){ const on=!this.optAllChecked(); this.optVisible().forEach(e=>{ this.opt.selected[e.id]=on; }); },
    optCpaClass(e){ if(e.cpa==null||!this.opt.avgCpa) return ''; if(e.cpa>1.5*this.opt.avgCpa) return 'text-[var(--negative)] font-semibold'; if(e.cpa<0.6*this.opt.avgCpa) return 'text-[var(--positive)] font-semibold'; return ''; },
    optColumns(){ return [
      {label:'Campaign',     calc:'Campaign name from the ad platform.'},
      {label:'Platform',     calc:'Where this campaign runs.'},
      {label:'Status',       calc:'Running (ACTIVE), stopped (PAUSED), or finished (ENDED).'},
      {label:'Spend',        calc:'Total spend in the selected date range.'},
      {label:'Results',      calc:'Conversions this campaign produced.'},
      {label:'Cost / result',calc:'Spend ÷ results. Red = over 1.5× your average; green = under 0.6×.'},
      {label:'Fatigue',      calc:'0–100: how many fewer clicks its ads get vs your average. Over 60 = time to refresh.'},
      {label:'Queued',       calc:'Edits waiting in Pending changes — click a chip to remove one.'},
      {label:'Ad copy',      calc:'Have the agent write fresh ad copy as a new paused ad set.'},
    ]; },

    /* ── 05 bulk editor — field catalog, "no change" defaults, platform-specific skips ── */
    optSrcKind(s){ s=(s||'').toLowerCase(); if(/google|search|youtube|display|gdn|bing|sem/.test(s)) return 'search'; if(/meta|facebook|instagram|social|tiktok|snap|pinterest|linkedin/.test(s)) return 'social'; return 'other'; },
    optBulkFields(){ return [
      { key:'status',   label:'Status',         kind:'chips', options:['ACTIVE','PAUSED'], applies:null },
      { key:'budget',   label:'Daily budget',   kind:'text',  ph:'e.g. 120 or +20%',      applies:null },
      { key:'bid',      label:'Bid / cost cap', kind:'text',  ph:'e.g. -15%',             applies:null },
      { key:'daypart',  label:'Dayparting',     kind:'text',  ph:'e.g. Mon–Fri 8–20',     applies:null },
      { key:'negatives',label:'Negative keywords', kind:'text', ph:'comma-separated terms', applies:'search' },
      { key:'freqcap',  label:'Frequency cap',  kind:'text',  ph:'e.g. 2 per 7 days',     applies:'social' },
    ]; },
    optFieldApplies(f,e){ return !f.applies || this.optSrcKind(e.source)===f.applies; },
    optBulkPending(){ return this.optBulkFields().filter(f=>(this.opt.bulk[f.key]||'').toString().trim()!==''); },
    optBulkPreview(){ const ids=this.optSelectedIds(), pend=this.optBulkPending(); let n=0, sk=0;
      for(const id of ids){ const e=this.optEntity(id); if(!e) continue; for(const f of pend){ if(this.optFieldApplies(f,e)) n++; else sk++; } }
      return { n, sk }; },
    optBulkClear(){ this.opt.bulk={ status:'', budget:'', bid:'', daypart:'', negatives:'', freqcap:'' }; this.opt.bulkFrom=null; },
    optCurrent(fkey){ const ids=this.optSelectedIds(); if(!ids.length) return '—';
      if(fkey==='status'){ const st=[...new Set(ids.map(id=>(this.optEntity(id)||{}).status))]; return st.length===1?(st[0]||'—'):'mixed ('+st.length+')'; }
      if(fkey==='budget'){ const ds=ids.map(id=>Math.round((this.optEntity(id)||{}).daily||0)); const mn=Math.min.apply(null,ds), mx=Math.max.apply(null,ds); return mn===mx?('≈$'+mn+'/d'):('≈$'+mn+'–$'+mx+'/d (mixed)'); }
      return 'n/a'; },
    optSelMeta(){ const ids=this.optSelectedIds(); const by={}; ids.forEach(id=>{ const e=this.optEntity(id); if(e) by[e.source]=(by[e.source]||0)+1; });
      return ids.length+' campaign'+(ids.length===1?'':'s')+(Object.keys(by).length?(' — '+Object.entries(by).map(([s,n])=>n+' '+s).join(', ')):''); },
    optStageBulk(){
      const ids=this.optSelectedIds(), pend=this.optBulkPending();
      if(!ids.length){ this.toast('Select campaigns first','error'); return; }
      if(!pend.length){ this.toast('Set at least one field — every control defaults to “no change”','error'); return; }
      const changes=[]; let skipped=0;
      for(const id of ids){ const e=this.optEntity(id); if(!e) continue;
        for(const f of pend){ const raw=(this.opt.bulk[f.key]||'').toString().trim();
          if(!this.optFieldApplies(f,e)){ skipped++; continue; }
          let before='—', after=raw;
          if(f.key==='status'){ if(raw===e.status) continue; before=e.status; }
          else if(f.key==='budget'){ const d=Math.round(e.daily||0); before='≈$'+d+'/d';
            const m=raw.match(/^([+-]\d+(?:\.\d+)?)\s*%$/);
            if(m) after=m[1]+'% (≈$'+Math.round(d*(1+parseFloat(m[1])/100))+'/d)';
            else { const n=parseFloat(raw.replace(/[^0-9.]/g,'')); if(!isNaN(n)){ if(Math.round(n)===d) continue; after='$'+n+'/d'; } } }
          else if(f.key==='bid') before='current';
          changes.push({ id:'blk-'+f.key+'-'+id+'-'+this.opt.seq, recId:null, rowId:id, target:e.name, source:e.source, param:f.label, before, after }); } }
      if(!changes.length){ this.toast('Nothing to queue — the values match what the campaigns already have, or don’t apply to them','error'); return; }
      this.optNewBatch(this.opt.bulkFrom==='console'?'console':'bulk','Edit '+ids.length+' campaign'+(ids.length===1?'':'s')+' — '+pend.map(f=>f.label).join(', '),changes);
      this.optBulkClear(); this.opt.selected={}; this.opt.stagingOpen=true;
      this.toast(changes.length+' edit'+(changes.length===1?'':'s')+' queued'+(skipped?(' ('+skipped+' skipped — field doesn’t exist on that platform)'):'')+' — review in Pending changes, then send'); },

    /* ── 01 suggested actions. Chips run the deterministic grammar; ACT drafts into the campaign editor, never queues directly. (The free-text box was removed — the LLM fallback below stays behind the same interface for when it returns.) ── */
    optActive(){ return (this.opt.entities||[]).filter(e=>e.status==='ACTIVE'); },
    // action chips ONLY — generated from the data and pre-checked: a chip is offered only when its
    // command matches ≥1 campaign right now (so clicking never lands on "no match"), and only when its
    // TARGET SCOPE is unambiguous — the expensive tail (every hit truly is expensive) or a single named
    // winner/loser. Grouping by platform/theme is avoided because it mixes good and bad campaigns.
    optConChips(){
      const act=this.optActive(); if(!act.length) return [];
      const avg=this.opt.avgCpa; const out=[], seen=new Set();
      const add=(label,n)=>{ if(n>0 && !seen.has(label) && out.length<6){ seen.add(label); out.push(label); } };
      const withCpa=act.filter(e=>e.cpa!=null);
      // 1. bulk-pause the clearly-expensive tail (only appears if a tail exists)
      if(avg){ const th=Math.round(avg*1.5); add('pause all campaigns with cost per result > '+th, withCpa.filter(e=>e.cpa>th).length); }
      // 2. scale your best campaigns — one chip per named winner (cpa well below the account average).
      //    Full name → matches exactly that campaign, so it never sweeps in a weak one.
      const winners=avg ? [...withCpa].filter(e=>e.cpa<0.6*avg).sort((a,b)=>a.cpa-b.cpa).slice(0,3) : [];
      for(const w of winners) add('set budget +20% for '+w.name, this.optConMatch(act,w.name).length);
      // 3. pause your worst spenders — one chip per named loser, only when no bulk tail chip covered it
      const losers=avg ? [...withCpa].filter(e=>e.cpa>1.5*avg).sort((a,b)=>b.cpa-a.cpa) : [];
      const haveBulkPause=out.some(c=>/cost per result >/.test(c));
      if(!haveBulkPause) for(const w of losers.slice(0,3)) add('change all the campaigns that have '+w.name+' into paused', this.optConMatch(act,w.name).length);
      return out; },
    optConSend(txt){
      const t=(txt!=null?txt:this.opt.con.input).trim(); if(!t) return;
      const act=this.optActive(); let m;
      if(/^why\b/i.test(t)){ this.optConWhy(t); }
      else if(m=t.match(/pause\s+.*?(?:cp[al]|cost(?:\s+per\s+result)?)\s*(?:>|above|over)\s*\$?(\d+(?:\.\d+)?)/i)){
        const n=parseFloat(m[1]); this.optConAct(act.filter(e=>e.cpa!=null&&e.cpa>n),'status','PAUSED','cost per result > $'+n); }
      else if(m=t.match(/(?:set|raise|increase|lower|cut)\s+budgets?\s*(?:by\s*)?([+-]?\d+(?:\.\d+)?)\s*%\s*(?:for|on)\s+(.+)/i)){
        let pct=m[1]; if(!/^[+-]/.test(pct)) pct=(/(lower|cut)/i.test(t)?'-':'+')+pct;
        this.optConAct(this.optConMatch(act,m[2]),'budget',pct+'%','matching “'+m[2].trim()+'”'); }
      else if(m=t.match(/(?:change|set|turn)\s+.*?(?:have|with|named)\s+(.+?)\s+(?:into|to)\s+([a-z+\-0-9%]+)\s*$/i)){
        const y=m[2].toLowerCase();
        if(y==='paused'||y==='active') this.optConAct(this.optConMatch(act,m[1]),'status',y.toUpperCase(),'matching “'+m[1].trim()+'”');
        else if(/^[+-]?\d+%?$/.test(y)) this.optConAct(this.optConMatch(act,m[1]),'budget',((/^[+-]/.test(y)?y:'+'+y).replace(/%?$/,'%')),'matching “'+m[1].trim()+'”');
        else this.optConReply('I can set <b>status</b> (paused / active) or <b>budget</b> (±N%). Try “…into paused” or “…to +20%”.'); }
      else if(m=t.match(/pause\s+.*?(?:have|with)\s+(.+)/i)){ this.optConAct(this.optConMatch(act,m[1]),'status','PAUSED','matching “'+m[1].trim()+'”'); }
      // no quick-command match → hand the request to the Asky agent (same LLM as the chat panel &
      // creative studio). It can only DRAFT into the editor or ANSWER — it has no send/publish path.
      else { this.optConAgent(t); } },
    /* ── LLM fallback (deployed app only): ask the Asky investigation agent for a STRUCTURED verdict —
       {"kind":"act", field, value, campaignIds, reply} → drafted into the Campaign editor (never sent), or
       {"kind":"answer", reply} → shown in the thread. Quick commands above stay the instant, free path. */
    async optConAgent(t){
      this.toast('Working on it…');
      const rows=this.optActive().slice(0,150).map(e=>({ id:e.id, name:e.name, platform:e.source, status:e.status, spend:Math.round(e.cost), results:e.outcome, costPerResult:e.cpa!=null?+e.cpa.toFixed(2):null, fatigue:e.fatigue }));
      const prompt=[ 'You are the assistant inside a campaign-optimization app. The user typed:', '"'+t+'"',
        'Below is the live campaign list (JSON). Decide ONE of:',
        '1) The user wants to CHANGE campaigns → reply {"kind":"act","field":"status|budget|bid|daypart|negatives|freqcap","value":"...","campaignIds":["..."],"reply":"one short sentence explaining what you drafted and why"}.',
        '   status value must be "PAUSED" or "ACTIVE"; budget value an absolute number like "120" or relative like "+20%"/"-15%".',
        '   Pick campaignIds ONLY from the list — never invent. If nothing matches, use kind "answer" and say so.',
        '2) The user asks a QUESTION → reply {"kind":"answer","reply":"plain-text answer, max 3 sentences, grounded in the data"}.',
        'Reply ONLY the raw JSON object — no prose, no markdown fences.',
        'CAMPAIGNS: '+JSON.stringify(rows) ].join('\n');
      try{ const text=await this.optAgentText(prompt);
        const m=(text||'').match(/\{[\s\S]*\}/); if(!m) throw new Error('no JSON in reply');
        this.optConApplyAgent(JSON.parse(m[0]));
      }catch(err){
        this.optConReplaceBusy('I couldn’t get an answer from the assistant service ('+((err&&err.message)||'error')+'). Quick commands still work: <b>pause … cost per result &gt; N</b> · <b>change … that have X into paused</b> · <b>set budget +20% for X</b>.'); } },
    optConReplaceBusy(html){ this.optConReply(html); },
    // apply the agent's structured verdict — act = select + prefill the editor (review gate intact)
    optConApplyAgent(p){
      const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if(p && p.kind==='act' && ['status','budget','bid','daypart','negatives','freqcap'].includes(p.field)){
        const ids=(Array.isArray(p.campaignIds)?p.campaignIds:[]).map(String);
        const matched=this.opt.entities.filter(e=>ids.includes(String(e.id))||ids.includes(e.name));
        if(!matched.length){ this.optConReplaceBusy(esc(p.reply||'')+(p.reply?'<br>':'')+'None of the campaigns it named exist here, so nothing was drafted.'); return; }
        this.opt.selected={}; matched.forEach(e=>{ this.opt.selected[e.id]=true; });
        this.optBulkClear(); this.opt.bulk[p.field]=String(p.value==null?'':p.value); this.opt.bulkFrom='console';
        this.opt.collapsed.editor=false; safeSet('optCollapsed', this.opt.collapsed);
        const fl=(this.optBulkFields().find(f=>f.key===p.field)||{label:p.field}).label;
        this.optConReplaceBusy(esc(p.reply||'Drafted.')+'<br>→ <b>'+esc(fl)+' → '+esc(String(p.value))+'</b> for <b>'+matched.length+' campaign'+(matched.length===1?'':'s')+'</b>, drafted in the <b>Campaign editor (05)</b>. Review the highlighted fields, then <b>Add to Pending changes</b>.'); }
      else if(p && p.kind==='answer'){ this.optConReplaceBusy(esc(p.reply||'')); }
      else this.optConReplaceBusy('I didn’t get a usable reply — try rephrasing.'); },
    // same /chat/start + /chat/poll contract the chat panel & creative studio use (Mode-2 cookie auth)
    async optAgentText(prompt){
      const start=await fetch(apiBase()+'/chat/start',{ method:'POST', credentials:'include', headers:apiHeaders(), body:JSON.stringify({ workspaceId:wsId(), projectId:projId(), prompt }) }).then(r=>r.json());
      const id=start&&start.investigationId; if(!id) throw new Error((start&&start.error)||'could not start a session');
      let cursor=0, text='';
      for(let i=0;i<20;i++){
        const r=await fetch(apiBase()+'/chat/poll',{ method:'POST', credentials:'include', headers:apiHeaders(), body:JSON.stringify({ investigationId:id, workspaceId:wsId(), cursor, waitMs:8000 }) }).then(r=>r.json());
        if(r&&r.cursor!=null) cursor=r.cursor;
        for(const it of ((r&&r.items)||[])) if(it.kind==='message'&&it.text) text+=it.text;
        if(r&&(r.terminal||r.status==='completed'||r.status==='failed'||r.status==='awaiting_input')) break; }
      return text; },
    optConMatch(list,q){ q=(q||'').trim().toLowerCase().replace(/["'.]/g,'').replace(/\s+campaigns?\s*$/,''); if(!q) return [];
      return list.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.source||'').toLowerCase().includes(q)); },
    optConAct(matched,field,value,crit){
      if(!matched.length){ this.optConReply('No match for '+crit+' — try part of a campaign name or a platform ('+this.opt.sources.join(', ')+'). I never guess.'); return; }
      this.opt.selected={}; matched.forEach(e=>{ this.opt.selected[e.id]=true; });
      this.optBulkClear(); this.opt.bulk[field]=value; this.opt.bulkFrom='console';
      this.opt.collapsed.editor=false; safeSet('optCollapsed', this.opt.collapsed);   // never hide the drafted edits
      this.optConReply('Matched <b>'+matched.length+' campaign'+(matched.length===1?'':'s')+'</b> ('+crit+') → drafted <b>'+(field==='status'?('Status → '+value):('Daily budget → '+value))+'</b> in the <b>Campaign editor (05)</b>. Review the highlighted fields there, then <b>Add to Pending changes</b>.'); },
    optConWhy(t){
      const q=t.replace(/^why\s+(is|are|does|did)?\s*/i,'').replace(/\b(cpa|cpl|cost|per|result|spend|expensive|up|down|high|low|rising|falling|so)\b/gi,'').trim();
      const e=this.optConMatch(this.opt.entities,q)[0];
      if(!e){ this.optConReply('Which campaign? Try “why is <i>name</i> expensive”.'); return; }
      const avg=this.opt.avgCpa||0;
      const obs='Observed: '+e.name+' — $'+Math.round(e.cost)+' spent, '+e.outcome+' results, cost per result '+(e.cpa!=null?('$'+e.cpa.toFixed(0)):'—')+(avg?(' vs your average $'+avg.toFixed(0)):'')+', CTR '+(e.ctr*100).toFixed(2)+'%, fatigue '+e.fatigue+'/100.';
      let hyp; if(e.outcome===0) hyp='It spends but produces zero results — most often broken tracking or the wrong audience; pausing is the safe move.';
      else if(e.fatigue>=60) hyp='The ads are worn out — people click them less than they used to, so each result costs more. Fresh ad copy usually fixes it.';
      else if(avg&&e.cpa!=null&&e.cpa>1.5*avg) hyp='It pays well above your average per result — usually pricier auctions or too-broad targeting, not a volume problem. Lowering the budget tightens delivery.';
      else hyp='Its numbers sit close to your account average — the movement is probably normal fluctuation; give it a few more days.';
      const rec=this.opt.recs.find(r=>r.rowId===e.id);
      this.optConReply('<span class="text-[var(--primary)]">'+obs+'</span><br><i style="color:var(--chip-widget)">Likely reason: '+hyp+'</i>'+(rec?('<br>Related: <b>'+rec.title+'</b> is waiting in 02 · Recommendations.'):'')); },
    // replies surface as toasts now (no thread UI) — strip markup for the plain-text toast
    optConReply(html){ this.toast(String(html).replace(/<br\s*\/?>/gi,' — ').replace(/<[^>]+>/g,'')); },

    /* ── CONNECTION MODEL — a source can be edited from the app ONLY when an API gateway is declared
       (optimize.gateways[source] with connected:true / canWrite:true). No entry → NOT connected: the app
       never claims it changed anything; it deep-links the operator to the platform to apply by hand. ── */
    optSourceConnected(s){ const o=this.currentSection().optimize, gw=o&&o.gateways&&o.gateways[s];
      if(!gw) return false; if(gw.connected!=null) return !!gw.connected; return gw.canWrite===true; },
    optPlatformUrl(source){ const s=(source||'').toLowerCase();
      if(/google|search|youtube|gdn|display|gads/.test(s)) return 'https://ads.google.com/aw/campaigns';
      if(/meta|facebook|instagram|fb|social/.test(s))      return 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
      if(/tiktok/.test(s))    return 'https://ads.tiktok.com/i18n/dashboard';
      if(/linkedin/.test(s))  return 'https://www.linkedin.com/campaignmanager/';
      if(/twitter|(^|\b)x\b/.test(s)) return 'https://ads.x.com';
      if(/pinterest/.test(s)) return 'https://ads.pinterest.com';
      if(/snap/.test(s))      return 'https://ads.snapchat.com';
      return 'https://www.google.com/search?q='+encodeURIComponent((source||'ads')+' ads manager'); },
    optDeepLink(c){ const dl=this.currentSection().optimize&&this.currentSection().optimize.deepLink;
      const u=(dl && dl[c.source]) ? dl[c.source](c) : null; return u || this.optPlatformUrl(c.source); },

    /* ── creative studio: refresh ad copy for one entity → a NEW PAUSED ad set ──
       A direct action (not a cart change): the result is inherently platform-staged (paused until the
       operator enables it natively), so it logs straight to Staging/History as a platform_staged batch. */
    csReset(){ Object.assign(this.opt.cs, { ctx:null, ctxLoading:false, genBusy:false, genErr:null, variants:null, sel:0, edited:{headline:'',primaryText:'',description:''}, phase:'edit', applyBusy:false, applyErr:null, result:null }); },
    async csOpen(id){
      const e=this.optEntity(id); if(!e){ this.toast('Pick an entity','error'); return; }
      this.csReset(); this.opt.cs.open=true; this.opt.cs.entityId=id; this.opt.cs.ctxLoading=true;
      try{ const ctx=await this.csLoadContext(e); this.opt.cs.ctx=ctx; this.opt.cs.edited={ headline:ctx.headline||'', primaryText:ctx.primaryText||'', description:ctx.description||'' }; }
      catch(err){ this.opt.cs.genErr=(err&&err.message)||String(err); }
      finally{ this.opt.cs.ctxLoading=false; }
    },
    csClose(){ this.opt.cs.open=false; },
    csOver(field,max){ return (this.opt.cs.edited[field]||'').length>max; },
    // No API connection → we cannot READ the live ad, so there's nothing to "refresh" from. We can still
    // GENERATE fresh copy, because generation runs on the Asky agent (our backend), not the ad platform.
    // Build the context from the campaign details we already have in Prism and flag that there's no current ad.
    csDataContext(e){ const src=String(e.source||'').toLowerCase();
      const theme=String(e.name||'').split(/[\s_·|/-]+/).filter(x=>x && !/^\d+$/.test(x) && x.toLowerCase()!==src).join(' ');
      return { campaignId:e.id, adSetId:null, noCurrent:true, format:'link', headline:'', primaryText:'', description:'',
        seed:(theme||e.name||'this campaign') }; },
    async csLoadContext(e){
      if(!this.optSourceConnected(e.source)) return this.csDataContext(e);   // can't read the live ad without a connection
      const r=await gw('/'+e.id+'/ads', { fields:'adset_id,creative{object_story_spec,asset_feed_spec,image_url,title,body}', limit:8 });
      const ads=(r&&r.data)||[];
      const bodyOf=a=>{ const c=a.creative||{}, s=c.object_story_spec||{}; return c.body || (s.link_data&&s.link_data.message) || (s.video_data&&s.video_data.message) || (c.asset_feed_spec&&c.asset_feed_spec.bodies&&c.asset_feed_spec.bodies[0]&&c.asset_feed_spec.bodies[0].text) || ''; };
      const ad=ads.find(a=>a.adset_id&&bodyOf(a))||ads.find(a=>a.adset_id);
      if(!ad||!ad.adset_id) throw new Error('No ad found on this campaign to refresh.');
      const c=ad.creative||{}, s=c.object_story_spec||{}, ld=s.link_data||{}, vd=s.video_data||{};
      const format=vd.video_id?'video':((s.photo_data||ld.image_hash)?'image':'link');
      return { campaignId:e.id, adSetId:ad.adset_id, format, pageId:s.page_id||'', instagramUserId:s.instagram_user_id, videoId:vd.video_id,
        link: ld.link || (vd.call_to_action&&vd.call_to_action.value&&vd.call_to_action.value.link) || '',
        imageHash: ld.image_hash || (s.photo_data&&s.photo_data.image_hash) || vd.image_hash || '',
        caption: ld.caption, ctaType:(ld.call_to_action&&ld.call_to_action.type)||(vd.call_to_action&&vd.call_to_action.type),
        headline: c.title||ld.name||vd.title||'', primaryText: bodyOf(ad), description: ld.description||vd.link_description||'', imageUrl: c.image_url };
    },
    async csGenerate(){
      const cs=this.opt.cs; if(!cs.ctx) return; cs.genBusy=true; cs.genErr=null;
      try{ const v = await this.csAgentVariants(cs.ctx,3);
        cs.variants=v; if(v[0]){ cs.sel=0; cs.edited={...v[0]}; } }
      catch(err){ cs.genErr=(err&&err.message)||String(err); }
      finally{ cs.genBusy=false; }
    },
    csPick(i){ const cs=this.opt.cs; cs.sel=i; if(cs.variants&&cs.variants[i]) cs.edited={...cs.variants[i]}; },
    async csAgentVariants(ctx,n){ n=n||3;
      // With a connection we refresh the CURRENT copy; without one we can't read it, so we generate fresh
      // copy from the campaign's details (its name/theme) instead.
      const basis = ctx.noCurrent
        ? 'There is no existing ad copy available to reference (this campaign is not API-connected). Write brand-new copy for a campaign about: "'+(ctx.seed||'this campaign')+'".'
        : 'Refresh this under-performing ad. Current copy — headline: "'+ctx.headline+'"; primary: "'+ctx.primaryText+'"; description: "'+ctx.description+'".';
      const prompt=[ 'You are a senior Facebook/Instagram ads copywriter.',
        'Write '+n+' fresh ad creative variants. Each variant needs:',
        '- headline: punchy, <=40 characters','- primaryText: 1-2 sentences, <=125 characters','- description: short link description, <=30 characters',
        'Make the '+n+' variants distinct in angle (benefit-led, curiosity, urgency).',
        basis,
        'Return ONLY a raw JSON array — no prose, no markdown, no code fences. Example:','[{"headline":"...","primaryText":"...","description":"..."}]' ].join('\n');
      const start=await fetch(apiBase()+'/chat/start',{ method:'POST', credentials:'include', headers:apiHeaders(), body:JSON.stringify({ workspaceId:wsId(), projectId:projId(), prompt }) }).then(r=>r.json());
      const investigationId=start&&start.investigationId; if(!investigationId) throw new Error((start&&start.error)||'Could not start the generator.');
      let cursor=0, text='';
      for(let i=0;i<30;i++){
        const r=await fetch(apiBase()+'/chat/poll',{ method:'POST', credentials:'include', headers:apiHeaders(), body:JSON.stringify({ investigationId, workspaceId:wsId(), cursor, waitMs:8000 }) }).then(r=>r.json());
        if(r&&r.cursor!=null) cursor=r.cursor; for(const it of ((r&&r.items)||[])) if(it.kind==='message'&&it.text) text+=it.text;
        if(r&&(r.terminal||r.status==='completed'||r.status==='failed'||r.status==='awaiting_input')) break;
      }
      return this.csParse(text,n);
    },
    csParse(text,n){ const m=(text||'').match(/\[[\s\S]*\]/); if(!m) throw new Error('The generator didn’t return usable options — try again.');
      let arr; try{ arr=JSON.parse(m[0]); }catch(e){ throw new Error('Couldn’t parse the generated options — try again.'); }
      if(!Array.isArray(arr)) throw new Error('Unexpected generator output.');
      return arr.map(o=>({ headline:String(o.headline||'').trim(), primaryText:String(o.primaryText||o.primary_text||o.body||'').trim(), description:String(o.description||'').trim() }))
                .filter(v=>v.headline||v.primaryText).slice(0,n); },
    csCanConfirm(){ const cs=this.opt.cs; return !!(cs.variants && (cs.edited.headline||'').trim() && (cs.edited.primaryText||'').trim()); },
    async csConfirm(){
      const cs=this.opt.cs, e=this.optEntity(cs.entityId); if(!cs.ctx||!e) return;
      cs.applyBusy=true; cs.applyErr=null;
      const label=e.name+' — AI refresh';
      try{
        const connected=this.optSourceConnected(e.source);
        const cfg=(this.currentSection().optimize&&this.currentSection().optimize.creative)||{};
        // Three outcomes, mirroring the rest of the page: the app really creates it when it CAN (a connected
        // platform with a write path), simulates in demo, and otherwise hands off the finished copy + a link
        // to the platform. A connected real account still missing the ad-account path falls back to hand-off
        // (copy + link) rather than erroring — we never claim we changed something we couldn't.
        let result;
        if(connected && cfg.accountPath){ await this.csLaunchRealAdSet(cs.ctx, cs.edited, label, cfg.accountPath); result='live'; }
        else { result='manual'; }
        cs.result=result;
        // the result is a PAUSED ad set → platform_staged; go-live is flipped natively
        const b=this.optNewBatch('manual','New ad copy — '+e.name,
          [{ id:'cs-'+e.id+'-'+this.opt.seq, recId:null, rowId:e.id, target:e.name, source:e.source, param:'Ad copy', before:'current ad set', after:'new paused ad set (AI copy)' }]);
        b.status='platform_staged'; b.sentAt=this.optNow();
        b.forecast={ text:'new paused ad set — no spend until enabled in the platform', confidence:'low', frozenAt:this.optNow() };
        b.lanes=[{ source:e.source, connected: result!=='manual', n:1, url:this.optDeepLink({source:e.source, rowId:e.id}) }];
        cs.phase='done';
        this.toast(result==='live' ? 'New paused ad set created — enable it in the platform when ready'
          : result==='simulated' ? 'Simulated — new paused ad set (demo)'
          : 'Your copy is ready — open the platform to add it as a paused ad set yourself (logged here for your records)');
      }catch(err){ cs.applyErr=(err&&err.message)||String(err); }
      finally{ cs.applyBusy=false; }
    },
    async csLaunchRealAdSet(ctx, copy, label, acct){
      if(!ctx.pageId) throw new Error('Missing page id on the source creative.');
      const oss = ctx.format==='video'
        ? { page_id:ctx.pageId, ...(ctx.instagramUserId?{instagram_user_id:ctx.instagramUserId}:{}), video_data:{ video_id:ctx.videoId, ...(ctx.imageHash?{image_hash:ctx.imageHash}:{}), message:copy.primaryText, title:copy.headline, link_description:copy.description, call_to_action:{ type:ctx.ctaType||'SHOP_NOW', value:{ link:ctx.link } } } }
        : { page_id:ctx.pageId, ...(ctx.instagramUserId?{instagram_user_id:ctx.instagramUserId}:{}), link_data:{ link:ctx.link, message:copy.primaryText, name:copy.headline, description:copy.description, ...(ctx.caption?{caption:ctx.caption}:{}), image_hash:ctx.imageHash, call_to_action:{ type:ctx.ctaType||'SHOP_NOW' } } };
      const creative=await gwCreate(acct+'/adcreatives', { name:label+' — creative', object_story_spec:JSON.stringify(oss) });
      const adsetCopy=await gwCreate('/'+ctx.adSetId+'/copies', { deep_copy:'false', status_option:'PAUSED' });
      const newAdSetId=adsetCopy.copied_adset_id||adsetCopy.id; if(!newAdSetId) throw new Error('Ad-set copy did not return an id.');
      await gwCreate(acct+'/ads', { name:label+' — ad', adset_id:newAdSetId, creative:JSON.stringify({ creative_id:creative.id }), status:'PAUSED' });
    },
