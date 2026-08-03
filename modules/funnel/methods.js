    // ── funnel: REAL per-step computation (askycore#904 — no fabricated counts, ever) ──
    // Each step declares ONE of:
    //   • sql:    a boolean SQL predicate over the loaded rows' columns (e.g. "clicks > 0").
    //             Steps CHAIN: a row reaches step i only if it satisfies steps 1..i. The count is
    //             DISTINCT `funnel.identity` values when that column exists on the rows, else the
    //             matching row count.
    //   • metric: a numeric column SUMmed over the filtered rows — for aggregate-grain data where
    //             each row already carries per-stage totals (impressions / clicks / conversions).
    // All steps must use the same mode. There is NO demo fallback: an unparseable predicate, a
    // missing column, or a mixed config THROWS, and the section shows the error instead of
    // plausible-looking invented numbers. (`step.rate` is dead — it fabricated every count.)
    computeFunnel(rows,fn){
      const steps=(fn&&fn.steps)||[];
      if(!steps.length) return [];
      if(steps.some(s=>s.rate!=null && s.sql==null && s.metric==null))
        throw new Error('funnel: `rate` is no longer supported — declare `sql` (predicate) or `metric` (column) per step');
      // union of column names over a sample, so "column not found" is reliable on sparse rows
      const cols=new Set(); rows.slice(0,200).forEach(r=>Object.keys(r).forEach(k=>cols.add(k)));
      const metricMode=steps.every(s=>s.metric!=null);
      if(!metricMode && !steps.every(s=>s.sql!=null))
        throw new Error('funnel: every step needs `sql` (or every step `metric`) — mixing modes is ambiguous');
      let counts;
      if(metricMode){
        for(const s of steps) if(rows.length && !cols.has(s.metric))
          throw new Error(`funnel step "${s.name}": column "${s.metric}" not found in the loaded rows`);
        counts=steps.map(s=>Math.round(rows.reduce((a,r)=>a+(+r[s.metric]||0),0)));
      }else{
        const preds=steps.map(s=>{
          try{ return this._sqlPredicate(s.sql, rows.length?cols:null); }
          catch(e){ throw new Error(`funnel step "${s.name}": ${e.message}`); }
        });
        const ident=fn.identity && cols.has(fn.identity) ? fn.identity : null;
        let alive=rows;
        counts=preds.map(p=>{
          alive=alive.filter(p);
          return ident ? new Set(alive.map(r=>r[ident])).size : alive.length;
        });
      }
      const base=counts[0]||0;
      let prev=base;
      const out=steps.map((s,i)=>{
        const count=counts[i];
        const row={ name:s.name, count,
          pctOverall: base?count/base:0,                    // reached this step, as a share of the top of the funnel
          pctStep:    i===0?1:(prev?count/prev:0),          // step-to-step conversion (share of the PREVIOUS step who continued)
          drop:       i===0?0:Math.max(0, prev?1-(count/prev):0),  // step-to-step drop-off (1 − conversion, floored at 0)
          lost:       i===0?0:Math.max(0, prev-count) };    // ABSOLUTE volume lost since the previous step
        prev=count; return row;
      });
      // flag the single worst step-to-step drop (the bottleneck) so the table can call it out
      let worst=-1, wd=-1; out.forEach((r,i)=>{ if(i>0 && r.drop>wd){ wd=r.drop; worst=i; } });
      if(worst>=0) out[worst].isBottleneck=true;
      return out;
    },
    // Compile a SQL boolean predicate (the subset builders actually write) into a row→bool closure.
    // Supports: AND OR NOT, parentheses, = != <> > >= < <=, IS [NOT] NULL, [NOT] IN (…),
    // [NOT] LIKE '…%', TRUE/FALSE, numeric + 'string' literals, bare or "quoted" identifiers.
    // Comparisons against NULL/missing values are false (SQL semantics); an identifier that exists
    // in NO loaded row throws (a silent 0 would look exactly like a real 0 — the original sin here).
    _sqlPredicate(sql, cols){
      const src=String(sql||'').trim();
      if(!src) throw new Error('empty predicate');
      // tokenize
      const toks=[]; const re=/\s*(>=|<=|<>|!=|=|>|<|\(|\)|,|'(?:[^']|'')*'|"[^"]+"|[A-Za-z_][A-Za-z0-9_.]*|-?\d+(?:\.\d+)?)/y;
      let i=0;
      while(i<src.length){
        re.lastIndex=i; const m=re.exec(src);
        if(!m){ throw new Error(`cannot parse predicate near "${src.slice(i,i+20)}"`); }
        toks.push(m[1]); i=re.lastIndex;
      }
      let p=0;
      const peek=()=>toks[p], kw=t=>typeof toks[p]==='string'&&toks[p].toUpperCase()===t&&(p++,true);
      const err=m=>{ throw new Error(m+(toks[p]?` near "${toks[p]}"`:' at end of predicate')); };
      const isIdent=t=>t!=null && (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(t) || /^"[^"]+"$/.test(t));
      const identName=t=>t[0]==='"'?t.slice(1,-1):t;
      const RESERVED=new Set(['AND','OR','NOT','IN','IS','NULL','LIKE','TRUE','FALSE']);
      const colRef=name=>{
        if(cols && !cols.has(name)) throw new Error(`column "${name}" not found in the loaded rows`);
        return r=>r[name];
      };
      const value=()=>{           // → {get:r=>val} for literals/columns
        const t=peek();
        if(t==null) err('expected a value');
        if(/^-?\d/.test(t)){ p++; const n=parseFloat(t); return {get:()=>n}; }
        if(t[0]==="'"){ p++; const s=t.slice(1,-1).replace(/''/g,"'"); return {get:()=>s}; }
        const u=t.toUpperCase();
        if(u==='NULL'){ p++; return {get:()=>null}; }
        if(u==='TRUE'){ p++; return {get:()=>true}; }
        if(u==='FALSE'){ p++; return {get:()=>false}; }
        if(isIdent(t) && !RESERVED.has(u)){ p++; const g=colRef(identName(t)); return {get:g}; }
        err('expected a value');
      };
      const missing=v=>v==null||v==='';
      const cmp=(op,a,b)=>{
        if(missing(a)||missing(b)) return false;                       // NULL never compares true
        const na=+a, nb=+b, num=!isNaN(na)&&!isNaN(nb)&&a!==''&&b!=='';
        const x=num?na:String(a), y=num?nb:String(b);
        switch(op){ case '=': return x===y||(!num&&a===b); case '!=': case '<>': return !(x===y);
          case '>': return x>y; case '>=': return x>=y; case '<': return x<y; case '<=': return x<=y; }
        return false;
      };
      const atom=()=>{
        if(kw('NOT')){ const f=atom(); return r=>!f(r); }
        if(peek()==='('){ p++; const f=orExpr(); if(peek()!==')') err('expected )'); p++; return f; }
        if(peek()!=null && peek().toUpperCase()==='TRUE'){ p++; return ()=>true; }
        if(peek()!=null && peek().toUpperCase()==='FALSE'){ p++; return ()=>false; }
        const lhs=value();
        // IS [NOT] NULL
        if(kw('IS')){ const neg=kw('NOT'); if(!kw('NULL')) err('expected NULL');
          return r=>neg? !missing(lhs.get(r)) : missing(lhs.get(r)); }
        const neg=kw('NOT');
        if(kw('IN')){ if(peek()!=='(') err('expected ('); p++;
          const vals=[]; for(;;){ vals.push(value()); if(peek()===','){ p++; continue; } break; }
          if(peek()!==')') err('expected )'); p++;
          const f=r=>{ const v=lhs.get(r); return !missing(v) && vals.some(x=>cmp('=',v,x.get(r))); };
          return neg? r=>!f(r) : f; }
        if(kw('LIKE')){ const pat=value();
          const f=r=>{ const v=lhs.get(r), q=pat.get(r); if(missing(v)||missing(q)) return false;
            const rx=new RegExp('^'+String(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.')+'$','i');
            return rx.test(String(v)); };
          return neg? r=>!f(r) : f; }
        if(neg) err('expected IN or LIKE after NOT');
        const op=peek();
        if(!['=','!=','<>','>','>=','<','<='].includes(op)) err('expected a comparison operator');
        p++; const rhs=value();
        return r=>cmp(op, lhs.get(r), rhs.get(r));
      };
      const andExpr=()=>{ let f=atom(); while(kw('AND')){ const g=atom(); const h=f; f=r=>h(r)&&g(r); } return f; };
      const orExpr =()=>{ let f=andExpr(); while(kw('OR')){ const g=andExpr(); const h=f; f=r=>h(r)||g(r); } return f; };
      const fn=orExpr();
      if(p<toks.length) err('unexpected trailing tokens');
      return fn;
    },
