(() => {
  const {element:h}=window.slx;
  const svgNS='http://www.w3.org/2000/svg';
  function svg(tag,attributes={}) {
    const node=document.createElementNS(svgNS,tag);
    for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
    return node;
  }
  function icon(name) {
    const graphic=svg('svg',{viewBox:'0 0 24 24',class:'console-icon',fill:'none',stroke:'currentColor','stroke-width':'1.65',
      'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'});
    graphic.append(svg('use',{href:`/assets/admin/lucide.svg#${name}`}));
    return graphic;
  }
  function iconButton(name,label,run) {
    const button=h('button',{type:'button',className:'console-icon-button',title:label,ariaLabel:label},icon(name));
    button.addEventListener('click',run);
    return button;
  }
  function badge(label,tone='neutral') { return h('span',{className:`console-badge is-${tone}`},label); }
  function empty(title,description,graphic='circle-dashed') {
    return h('div',{className:'console-empty'},icon(graphic),h('strong',{},title),description?h('p',{},description):null);
  }
  function table(columns,rows,label) {
    return h('div',{className:'console-table-scroll',tabIndex:0,role:'region',ariaLabel:label},h('table',{className:'console-table',ariaLabel:label},
      h('thead',{},h('tr',{},columns.map(column=>h('th',{scope:'col'},column)))),
      h('tbody',{},rows.map(row=>h('tr',{},row.map((value,i)=>{
        const cell=h('td',{},value); cell.dataset.column=columns[i]; return cell;
      }))))));
  }
  function modal(title,body,drawer=false) {
    const heading=h('h2',{},title);
    const dialog=h('dialog',{className:`console-modal${drawer?' is-drawer':''}`,ariaLabel:title},
      h('div',{className:'console-modal-top'},heading,iconButton('x','Закрити',()=>dialog.close())),body);
    dialog.addEventListener('click',event=>{if(event.target===dialog) dialog.close();});
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);dialog.showModal();
    return dialog;
  }
  function menu(label,children) {
    const trigger=h('summary',{ariaLabel:label,title:label,className:'console-icon-button'},icon('ellipsis'));
    const details=h('details',{className:'console-menu'},trigger,h('div',{className:'console-menu-items'},children));
    details.addEventListener('keydown',event=>{
      if(event.key==='Escape'){details.open=false;trigger.focus();}
    });
    details.addEventListener('focusout',event=>{if(!details.contains(event.relatedTarget)) details.open=false;});
    return details;
  }
  function chart(days) {
    if (!days.length) return empty('Ще немає даних',null,'chart-no-axes-combined');
    const width=640,height=215,left=38,right=615,top=22,bottom=173;
    const max=Math.max(1,...days.map(row=>row.count));
    const points=days.map(({day,count},i)=>({day,count,x:left+(right-left)*i/Math.max(1,days.length-1),y:bottom-(bottom-top)*count/max}));
    const graphic=svg('svg',{viewBox:`0 0 ${width} ${height}`,class:'console-chart',role:'group','aria-label':'Заявки за днями, шкала UTC'});
    const label=(x,y,value,anchor='start')=>{const t=svg('text',{x,y,'text-anchor':anchor});t.textContent=value;graphic.append(t);};
    for(const value of [...new Set([0,Math.floor(max/2),max])]) {
      const y=bottom-(bottom-top)*value/max;
      graphic.append(svg('line',{x1:left,x2:right,y1:y,y2:y,class:'chart-grid'}));label(25,y+4,value,'end');
    }
    const path=points.map(({x,y},i)=>`${i?'L':'M'} ${x} ${y}`).join(' ');
    graphic.append(svg('path',{d:`${path} L ${points.at(-1).x} ${bottom} L ${left} ${bottom} Z`,class:'chart-area'}),
      svg('path',{d:path,class:'chart-line'}));
    const tooltip=h('output',{className:'console-chart-tooltip',ariaLive:'polite'},'Наведіть курсор або виберіть точку.');
    for (const [i,{day,count,x,y}] of points.entries()) {
      const point=svg('circle',{cx:x,cy:y,r:6,tabindex:0,class:'chart-point','aria-label':`${day}: ${count}`});
      const title=svg('title');title.textContent=`${day} · ${count}`;point.append(title);
      const update=()=>{tooltip.textContent=`${day} · ${count} заявок`;};
      point.addEventListener('mouseenter',update);point.addEventListener('focus',update);graphic.append(point);
      if(i===0 || i===points.length-1 || (i%4===0 && i<points.length-3)) label(x,195,day.slice(5),'middle');
    }
    return h('figure',{className:'console-chart-wrap'},graphic,tooltip);
  }
  window.slxConsole={icon,iconButton,badge,empty,table,modal,menu,chart};
})();
