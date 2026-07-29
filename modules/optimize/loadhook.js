        // optimize — build optimizable entities + ranked agent recs (OPTIMIZE_MODULE_SPEC)
        if(sec.layout==='optimize'){
          // dismissal + collapse memory lives in localStorage (per browser) — hydrate once before the first build
          if(!this.opt._hydrated){ this.opt.dismissed=safeGet('optDismissed',{})||{}; this.opt.muted=safeGet('optMuted',{})||{};
            this.opt.collapsed=Object.assign({assistant:false,recs:false,campaigns:false,editor:false,history:false}, safeGet('optCollapsed',{})||{}); this.opt._hydrated=true; }
          try{ this.optBuild(sec,rows); }catch(e){ sec._optKpis=[]; }
        }
