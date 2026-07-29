      // funnel chart
      if(sec.layout==='funnel'){
        const el=document.getElementById(`funnel-${sec.id}`);
        if(el){ const inst=echarts.getInstanceByDom(el)||echarts.init(el,null,{renderer:'svg'});
          inst.setOption({animation:false, tooltip:{trigger:'item', backgroundColor:cssVar('--surface-elevated'), borderColor:chartColor(6), borderWidth:1, textStyle:{color:cssVar('--foreground'),fontSize:12}, formatter:p=>`${p.name}<br/>${p.value.toLocaleString()}`},
            series:[{type:'funnel', left:'8%', width:'84%', top:10, bottom:10, minSize:'14%', gap:2, sort:'descending',
              label:{position:'inside', color:'#fff', fontSize:12, formatter:p=>`${p.name}  ${formatAbbrev(p.value)}`},
              data:(sec._funnel||[]).map((f,i)=>({name:f.name, value:f.count, itemStyle:{color:chartColor(i+1)}}))}]}, true);
          inst.resize(); this._charts[`funnel-${sec.id}`]=inst; }
      }
