        // funnel — per-step count of identities reaching each step (point 9)
        if(sec.layout==='funnel' && sec.funnel){
          try{ sec._funnel=this.computeFunnel(rows,sec.funnel); }catch(e){ sec._funnel=[]; }
        }
