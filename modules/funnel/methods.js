    computeFunnel(rows,fn){
      // demo: each step has a `rate` (step conversion). Real mode: count DISTINCT identity
      // WHERE step.sql, per step. Base scales with the filtered set so the funnel reacts to filters.
      const base = Math.max(rows.reduce((a,b)=>a+(+b.impressions||0),0), rows.length*100);
      let prev=base;
      const out = fn.steps.map((s,i)=>{
        const count = i===0 ? base : Math.round(prev*(s.rate!=null?s.rate:0.5));
        const row={ name:s.name, count,
          pctOverall: base?count/base:0,                 // reached this step, as a share of the top of the funnel
          pctStep:    i===0?1:(prev?count/prev:0),        // step-to-step conversion (share of the PREVIOUS step who continued)
          drop:       i===0?0:(prev?1-(count/prev):0),    // step-to-step drop-off (1 − conversion)
          lost:       i===0?0:Math.max(0, prev-count) };  // ABSOLUTE identities lost since the previous step
        prev=count; return row;
      });
      // flag the single worst step-to-step drop (the bottleneck) so the table can call it out
      let worst=-1, wd=-1; out.forEach((r,i)=>{ if(i>0 && r.drop>wd){ wd=r.drop; worst=i; } });
      if(worst>=0) out[worst].isBottleneck=true;
      return out;
    },
