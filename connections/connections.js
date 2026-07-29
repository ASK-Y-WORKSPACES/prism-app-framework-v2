/* ════════════════════════════════════════════════════════════════════════
   Prism connection layer — the canonical reference.
   These helpers are INLINED into base/index.html (connections are foundational,
   not an optional module). This file is the authoritative copy: if you change
   the contract, change it here and in base/index.html together. For a non
   single-file build you can import this module directly.

   Contract: see ./CONNECTIONS.md. Values come from APP_CONFIG (filled from the
   project-spec): appSlug, workspaceId, projectId, dataSources{...}.
   ════════════════════════════════════════════════════════════════════════ */

function apiBase(){ return '/' + (APP_CONFIG.appSlug || '') + '/api'; }   // slug-prefixed — NOT bare /api (drops the cookie)
function wsId(){ return APP_CONFIG.workspaceId; }
function projId(){ return APP_CONFIG.projectId; }
function apiHeaders(extra){ return Object.assign({ 'Accept':'application/json', 'Content-Type':'application/json', 'X-Workspace-Id':wsId() }, extra||{}); }

/* ── Table data: POST /<slug>/api/Data/getModelView (the only place that retries: cold start) ── */
async function queryModel(modelId, sql, retries){
  retries = retries==null ? 12 : retries;
  for(let attempt=0;;attempt++){
    const r = await fetch(`${apiBase()}/Data/getModelView`, { method:'POST', credentials:'include', headers:apiHeaders(),
      body:JSON.stringify({ workspaceId:wsId(), projectId:projId(), modelId, query:sql }) });
    let j={}; try{ j = await r.json(); }catch(e){}
    const code = j.errorCode || j.code;
    if((code==='WAREHOUSE_COLD_START' || j.retryable) && attempt<retries){
      await new Promise(s=>setTimeout(s, Math.min(((j.retryAfterSeconds)||5)*1000, 10000))); continue;
    }
    if(!r.ok || j.error || j.Success===false) throw new Error(j.error || j.errorMessage || ('HTTP '+r.status));
    const D = j.Data || j.data;                                            // mixed-case defensively
    if(D && D.colSchema){ const cols = D.colSchema.map(c=>c.name); return (D.data||[]).map(row=>Object.fromEntries(cols.map((c,i)=>[c,row[i]]))); }
    return j.rows || D || [];
  }
}

/* ── API gateway: /<slug>/api/gw/... — writes encode params in the query string, no body ── */
function gwBase(){ return apiBase() + '/gw'; }
function providerError(j){ return (j && (j.error_user_msg||j.error_user_title||j.message||j.ErrorMessage||j.error)) || 'gateway error'; }
async function gw(path, params){
  const qs = new URLSearchParams(params||{}).toString();
  const r = await fetch(`${gwBase()}${path}${qs?('?'+qs):''}`, { credentials:'include', headers:apiHeaders() });
  const j = await r.json(); if(!r.ok || j.error) throw new Error(providerError(j)); return j;
}
async function gwWrite(path, params){
  const qs = new URLSearchParams(params||{}).toString();
  const r = await fetch(`${gwBase()}${path}?${qs}`, { method:'POST', credentials:'include', headers:apiHeaders() });
  const j = await r.json(); if(!r.ok || j.error) throw new Error(providerError(j)); return j;
}
const gwCreate = gwWrite;   // returns the created { id }

/* ── queryAny: route a section's data source to prism SQL or a REST gateway ── */
async function queryAny(ds, spec){
  if(ds.kind==='prism') return queryModel(ds.prism, spec.sql);
  if(ds.kind==='rest'){ const j = await gw((ds.base||'')+(spec.path||''), spec.params); return ds.map ? ds.map(j) : j; }
  throw new Error('Unknown data source kind: '+ds.kind);
}

/* ── Chat / agent: /<slug>/api/chat/{start,respond,poll} (real mode; synthetic stubs in base) ──
   chatStart(text)  -> POST /chat/start   -> { investigationId }
   chatRespond(id,text) -> POST /chat/respond
   chatPoll(id,cursor)  -> POST /chat/poll { waitMs:8000 } until terminal | awaiting_input  */

// (export for non single-file builds)
if (typeof module !== 'undefined') module.exports = { apiBase, apiHeaders, queryModel, gw, gwWrite, gwCreate, providerError, queryAny };
