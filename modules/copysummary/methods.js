    /* ── copysummary: copy the visible table as a REAL table on the clipboard ──
       Writes TWO clipboard flavors via the async Clipboard API (ClipboardItem):
         • text/html  — a styled <table> with a <caption> (title, range, filter chips, counts),
                        so it pastes as a formatted table into Docs / Slack / email.
         • text/plain — tab-separated rows, so it pastes as columns into Sheets / Excel.
       Fallback chain: ClipboardItem.write → clipboard.writeText(TSV) → hidden-textarea execCommand.

       Two opt-in shapes, read from the section's table config (no new state, no network):
         • sec.table.sectionGroupBy === 'platform' → a section header + a per-platform Total row,
           groups ordered by total spend desc (mirrors the on-screen grouping).
         • sec.table.rowDetail === 'daily' → each campaign is expanded into its per-day rows
           (Campaign · Date · Spend · Impr. · Clicks · CTR · CPC · Conv. · CPA) via the engine's
           dailyRows(), days listed in sequence under each campaign. Header reads "N campaigns · M day-rows".
       Numbers reuse the app's fmt()/formatDate() so cells read identically to the screen.
       Rates (percent/ratio/perunit) are never summed in a Total row. */
    copyPerfSummary(sec){
      try{
        const rows = this.tableRows(sec);
        if(!rows.length){ this.toast('Nothing to copy — no rows in view'); return; }
        const cfg     = (sec.table && sec.table.copySummary) || {};
        const title   = cfg.title || sec.tableTitle || sec.label || 'Performance';
        const groupBy = sec.table.sectionGroupBy;          // 'platform' → grouped output
        const daily   = sec.table.rowDetail === 'daily';   // per-day breakdown instead of one row per campaign

        const dailyCols = [
          {key:'campaign_name', label:'Campaign', type:'text'},
          {key:'event_date',    label:'Date',     type:'date'},
          {key:'spend',         label:'Spend',    type:'currency'},
          {key:'impressions',   label:'Impr.',    type:'number'},
          {key:'clicks',        label:'Clicks',   type:'number'},
          {key:'ctr',           label:'CTR',      type:'percent'},
          {key:'cpc',           label:'CPC',      type:'perunit'},
          {key:'conversions',   label:'Conv.',    type:'number'},
          {key:'cpa',           label:'CPA',      type:'perunit'},
        ];
        const cols = daily ? dailyCols : sec.table.columns.filter(c=>c.label && c.type!=='image');
        const isSummable = t => ['currency','number','integer','count'].includes(t);
        const leftAlign  = t => ['text','badge','status','date'].includes(t);

        const cell = (c,r)=>{ const v=r[c.key];
          if(v==null||v==='') return '—';
          if(c.type==='currency') return fmt('currency',v).exact;
          if(c.type==='percent')  return fmt('percent',v).label;
          if(c.type==='ratio')    return fmt('ratio',v).label;
          if(c.type==='perunit')  return fmt('perunit',v).label;
          if(c.type==='number'||c.type==='integer'||c.type==='count') return fmt('count',v).exact;
          if(c.type==='date')     return formatDate(v);
          return String(v);
        };
        // In daily mode each campaign becomes its run of day-rows (carry campaign_name/platform through).
        const expand = r => daily
          ? this.dailyRows(sec,r).map(d=>({ ...d, campaign_name:r.campaign_name, platform:r.platform }))
          : [r];

        // Section model: one section (flat) or one per group, ordered as on screen (spend desc).
        const groups=[];
        if(groupBy){
          for(const g of this.tableGroups(sec, rows, groupBy))
            groups.push({ label:String(g.label), campaigns:g.rows.length, rows:[].concat(...g.rows.map(expand)) });
        } else {
          groups.push({ label:null, campaigns:rows.length, rows:[].concat(...rows.map(expand)) });
        }
        const allRows = [].concat(...groups.map(g=>g.rows));

        const totalsFor = list => cols.map((c,i)=>{
          if(!isSummable(c.type)) return i===0 ? 'Total' : '';      // rates/ratios never summed
          const s=list.reduce((a,r)=>a+(+r[c.key]||0),0);
          return c.type==='currency' ? fmt('currency',s).exact : fmt('count',s).exact;
        });

        const totalCampaigns = rows.length;
        const totalDayRows   = allRows.length;
        const countLine = daily
          ? `${totalCampaigns} campaign${totalCampaigns===1?'':'s'} · ${totalDayRows} day-rows`
          : `${totalDayRows} row${totalDayRows===1?'':'s'}`;
        const chips = this.allChips();

        /* ── text/plain — tab-separated (Sheets/Excel paste as columns) ── */
        const tsv=[];
        tsv.push(`${title} — ${this.rangeLabel()}`);
        if(chips.length) tsv.push('Filters: '+chips.map(c=>c.text).join(' · '));
        tsv.push(countLine);
        tsv.push('');
        tsv.push(cols.map(c=>c.label).join('\t'));
        for(const g of groups){
          if(g.label!=null) tsv.push(`${g.label} (${g.campaigns} campaign${g.campaigns===1?'':'s'})`);
          for(const r of g.rows) tsv.push(cols.map(c=>cell(c,r)).join('\t'));
          if(g.label!=null) tsv.push(totalsFor(g.rows).join('\t'));
        }
        tsv.push(totalsFor(allRows).join('\t'));
        const text = tsv.join('\n');

        /* ── text/html — styled <table> (Docs/Slack/email paste as a formatted table) ──
           Inline hex colors are intentional: this markup is for FOREIGN paste targets that
           can't resolve the app's CSS variables, so it must carry literal colors. */
        const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const al = c => leftAlign(c.type) ? 'left' : 'right';
        const th = cols.map(c=>`<th style="text-align:${al(c)};padding:5px 10px;border-bottom:2px solid #d0d5dd;font:600 12px sans-serif;color:#475467;white-space:nowrap">${esc(c.label)}</th>`).join('');
        const dataRow = r => '<tr>'+cols.map(c=>`<td style="text-align:${al(c)};padding:4px 10px;border-bottom:1px solid #eaecf0;font:13px sans-serif;color:#101828;white-space:nowrap">${esc(cell(c,r))}</td>`).join('')+'</tr>';
        const groupRow = g => `<tr><td colspan="${cols.length}" style="text-align:left;padding:9px 10px 3px;font:700 12px sans-serif;color:#101828;background:#f9fafb">${esc(g.label)} · ${g.campaigns} campaign${g.campaigns===1?'':'s'}</td></tr>`;
        const totalRow = (list,strong)=>'<tr>'+totalsFor(list).map((v,i)=>`<td style="text-align:${al(cols[i])};padding:5px 10px;border-top:${strong?'2px':'1px'} solid #d0d5dd;font:${strong?700:600} 12px sans-serif;color:#101828;background:${strong?'#f2f4f7':'#fcfcfd'}">${esc(v)}</td>`).join('')+'</tr>';

        let body='';
        for(const g of groups){
          if(g.label!=null) body+=groupRow(g);
          body+=g.rows.map(dataRow).join('');
          if(g.label!=null) body+=totalRow(g.rows,false);
        }
        body+=totalRow(allRows,true);

        const caption = `<caption style="caption-side:top;text-align:left;padding:0 0 7px">`
          + `<div style="font:700 15px sans-serif;color:#101828">${esc(title)}</div>`
          + `<div style="font:12px sans-serif;color:#475467">${esc(this.rangeLabel())} · ${esc(countLine)}</div>`
          + (chips.length?`<div style="font:12px sans-serif;color:#475467">Filters: ${esc(chips.map(c=>c.text).join(' · '))}</div>`:'')
          + `</caption>`;
        const html = `<table style="border-collapse:collapse;font-family:sans-serif">${caption}<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;

        /* ── clipboard: HTML + TSV via ClipboardItem, then writeText(TSV), then execCommand ── */
        const done=()=>this.toast('Performance summary copied — paste into Docs, Slack, or Sheets');
        const fail=()=>this.toast('Copy failed');
        const writePlain=()=> (navigator.clipboard && navigator.clipboard.writeText)
          ? navigator.clipboard.writeText(text).then(done, fail)
          : this._copyFallback(text, done, fail);
        if(navigator.clipboard && window.ClipboardItem){
          try{
            const item=new ClipboardItem({
              'text/html':  new Blob([html], {type:'text/html'}),
              'text/plain': new Blob([text], {type:'text/plain'}),
            });
            navigator.clipboard.write([item]).then(done, writePlain);
          }catch(e){ writePlain(); }
        } else { writePlain(); }
      }catch(e){ this.toast('Copy failed'); }
    },
    _copyFallback(text, done, fail){
      const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ fail(); } ta.remove();
    },
