        // funnel — per-step count of identities reaching each step (point 9).
        // FAIL LOUD: a bad predicate / missing column surfaces on the tab (sec._funnelError)
        // instead of silently rendering an empty — or worse, fabricated — funnel (askycore#904).
        if(sec.layout==='funnel' && sec.funnel){
          try{ sec._funnel=this.computeFunnel(rows,sec.funnel); sec._funnelError=null; }
          catch(e){ sec._funnel=[]; sec._funnelError=(e&&e.message)||String(e); }
        }
