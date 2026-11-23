/* Gap assessment: obligations x controls, coloured by what is actually covered. No library. */
(function(){
'use strict';
var OBS=[],CONTROLS=[],APP=null,TODAY=new Date();
var CKEY='regradar-gap-config',SKEY='regradar-gap-snapshots',MKEY='regradar-obligations-mine';
var CFG={needOwner:true,needTest:true,overdueIsUntested:true};
var S={view:'map',firm:'',topic:'',status:'',sel:null,cmp:''};
var STAT={
  covered_tested:{label:'Covered and tested',cls:'s-ct',rank:4,todo:'Keep testing on schedule.'},
  covered_untested:{label:'Covered, not tested',cls:'s-cu',rank:3,todo:'Run and record a test of the control.'},
  partly:{label:'Partly covered',cls:'s-pc',rank:2,todo:'Approve the draft control or name an owner.'},
  not_covered:{label:'Not covered',cls:'s-nc',rank:1,todo:'Add a control that mitigates this obligation.'},
  na:{label:'Not applicable',cls:'s-na',rank:0,todo:'Dismissed for this firm.'}
};
var ORDER=['covered_tested','covered_untested','partly','not_covered','na'];
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2000)}
function jget(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function jset(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){toast('Browser storage is blocked or full.');return false}}

function artNum(o){var m=(o.source_url||'').match(/art=(\d+)/);return m?m[1]:((o.legal_basis||'').match(/(\d+)/)||[])[1]||''}
function ctlsFor(id){return GapLogic.ctlsFor(CONTROLS,id)}
function isNA(o){ // dismissed in the workspace, or moved to Not applicable on the register Kanban
  var legacy=!!(jget(MKEY,{}).dismissed||{})[o.id];
  return window.RegisterLogic&&window.RR&&window.RR.current?window.RegisterLogic.isNA(window.RR.current,o.id,legacy):legacy;
}
function statusOf(o){
  return GapLogic.statusOf(o,CONTROLS,CFG,function(c){return window.ControlsData.isOverdue(c,TODAY)},isNA(o));
}
function inScope(){return OBS.filter(function(o){return !S.firm||(o.who||[]).indexOf(S.firm)!==-1})}
function rows(){
  return inScope().map(function(o){return {o:o,st:statusOf(o)}}).filter(function(r){
    return (!S.topic||(r.o.topic||'Other')===S.topic)&&(!S.status||r.st===S.status)});
}
function title(o){var w=o.what||'';return w.length>90?w.slice(0,87)+'…':w}

function renderStats(){
  var all=inScope().map(statusOf),n=all.length,c={};
  ORDER.forEach(function(k){c[k]=all.filter(function(x){return x===k}).length});
  var applicable=n-c.na,tested=c.covered_tested;
  $('lead').textContent=n+' verified AMLR obligations in scope. '+tested+' are covered and tested; '+c.not_covered+' have no control at all.';
  $('stats').innerHTML=
   '<div class="rr-stat"><div class="n">'+tested+' of '+applicable+'</div><div class="l">Covered and tested</div><div class="s">owned, approved, tested</div></div>'+
   '<div class="rr-stat"><div class="n">'+c.covered_untested+'</div><div class="l">Covered, not tested</div><div class="s">control exists, no test</div></div>'+
   '<div class="rr-stat"><div class="n">'+c.partly+'</div><div class="l">Partly covered</div><div class="s">draft or no owner</div></div>'+
   '<div class="rr-stat risk"><div class="n">'+c.not_covered+'</div><div class="l">Not covered</div><div class="s">no control mapped</div></div>';
  $('legend').innerHTML=ORDER.map(function(k){return '<span><i class="sw '+STAT[k].cls+'"></i>'+STAT[k].label+' ('+c[k]+')</span>'}).join('');
}
function renderMap(rs){
  var by={};rs.forEach(function(r){var t=r.o.topic||'Other';(by[t]=by[t]||[]).push(r)});
  var h=Object.keys(by).sort().map(function(t){
    var l=by[t].sort(function(a,b){return +artNum(a.o)-+artNum(b.o)});
    var ok=l.filter(function(r){return r.st==='covered_tested'}).length;
    return '<section class="topic"><h3>'+esc(t)+' <small>'+ok+' of '+l.length+' covered and tested</small></h3><div class="tiles">'+
      l.map(function(r){return '<button type="button" class="tile '+STAT[r.st].cls+'" data-id="'+esc(r.o.id)+'" aria-pressed="'+(S.sel===r.o.id)+'" title="'+esc(title(r.o))+'"><b>Art. '+esc(artNum(r.o))+'</b><span>'+STAT[r.st].label+'</span></button>'}).join('')+'</div></section>'}).join('');
  return h||'<p class="rr-empty">Nothing matches these filters.</p>';
}
function renderList(rs){
  return '<div class="rr-table-wrap"><table class="rr-table"><thead><tr><th>Article</th><th>Obligation</th><th>Status</th><th>Controls</th><th>Owner</th><th>Last test</th></tr></thead><tbody>'+
   rs.sort(function(a,b){return STAT[a.st].rank-STAT[b.st].rank||+artNum(a.o)-+artNum(b.o)}).map(function(r){
    var cs=ctlsFor(r.o.id);
    return '<tr><td><button type="button" class="btn sm" data-id="'+esc(r.o.id)+'">Art. '+esc(artNum(r.o))+'</button></td><td>'+esc(title(r.o))+'</td><td>'+STAT[r.st].label+'</td><td>'+cs.length+'</td><td>'+esc(cs.map(function(c){return c.owner||'none'}).join(', '))+'</td><td>'+esc(cs.map(function(c){return c.last_tested||'never'}).join(', '))+'</td></tr>'}).join('')+'</tbody></table></div>';
}
function snaps(){return jget(SKEY,[])}
function renderCompare(){
  var sn=snaps();
  if(!sn.length)return '<p class="rr-empty">No snapshots yet. Use Save snapshot to date the current picture; later you can compare it with today.</p>';
  if(!S.cmp||!sn.some(function(s){return s.id===S.cmp}))S.cmp=sn[sn.length-1].id;
  var s=sn.filter(function(x){return x.id===S.cmp})[0],ch=[];
  inScope().forEach(function(o){var a=s.items[o.id],b=statusOf(o);if(a&&a!==b)ch.push({o:o,a:a,b:b})});
  return '<div class="rr-filters"><label for="cmpSel">Compare today with</label><select class="sel" id="cmpSel">'+sn.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===S.cmp?' selected':'')+'>'+esc(x.label)+'</option>'}).join('')+'</select></div>'+
   (ch.length?'<div class="rr-table-wrap"><table class="rr-table cmp"><thead><tr><th>Article</th><th>Then</th><th>Now</th></tr></thead><tbody>'+ch.map(function(c){
     var up=STAT[c.b].rank>STAT[c.a].rank;return '<tr><td>Art. '+esc(artNum(c.o))+'</td><td>'+(STAT[c.a]?STAT[c.a].label:esc(c.a))+'</td><td class="'+(up?'up':'down')+'">'+STAT[c.b].label+(up?' (better)':' (worse)')+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="rr-empty">No obligation changed status since this snapshot.</p>');
}
function renderView(){
  var rs=rows(),v=S.view;
  $('view').innerHTML=v==='map'?renderMap(rs):v==='list'?renderList(rs):renderCompare();
  document.querySelectorAll('.seg [role=tab]').forEach(function(b){b.setAttribute('aria-selected',String(b.getAttribute('data-v')===v))});
}
function renderDetail(){
  var o=OBS.filter(function(x){return x.id===S.sel})[0];
  if(!o)return;
  var st=statusOf(o),cs=ctlsFor(o.id);
  $('detail').innerHTML='<h2>Art. '+esc(artNum(o))+' · '+esc(o.topic||'')+'</h2><p><span class="pill">'+STAT[st].label+'</span></p><p>'+esc(o.what)+'</p>'+
   '<p><a href="'+esc(o.source_url||'law.html')+'">Read the law</a> · '+esc(o.legal_basis||'')+'</p>'+
   '<h3>Controls</h3>'+(cs.length?'<ul>'+cs.map(function(c){return '<li><a href="workspace.html?view=controls&amp;control='+encodeURIComponent(c.id)+'">'+esc(c.name)+'</a>: owner '+esc(c.owner||'none')+', '+esc(c.status)+', last test '+esc(c.last_tested||'never')+'</li>'}).join('')+'</ul>':'<p>None mapped.</p>')+
   '<h3>What to do next</h3><p>'+esc(STAT[st].todo)+'</p><p class="help">Creating an action from a gap comes in a later slice (it needs the ticket model).</p>';
}
function renderAll(){renderStats();renderView();renderDetail()}

/* ---- export: a real .xlsx written without a library (stored zip, inline strings) ---- */
var CRC=(function(){var t=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zip(files){
  var enc=new TextEncoder(),parts=[],cen=[],off=0;
  function u16(n){return [n&255,(n>>8)&255]}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  files.forEach(function(f){
    var nm=enc.encode(f.name),d=enc.encode(f.data),crc=crc32(d);
    var head=[0x50,0x4b,3,4].concat(u16(20),u16(0x800),u16(0),u16(0),u16(0x21),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0));
    parts.push(new Uint8Array(head),nm,d);
    cen.push([0x50,0x4b,1,2].concat(u16(20),u16(20),u16(0x800),u16(0),u16(0),u16(0x21),u32(crc),u32(d.length),u32(d.length),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off)),Array.prototype.slice.call(nm));
    off+=head.length+nm.length+d.length;
  });
  var cd=[].concat.apply([],cen),end=[0x50,0x4b,5,6].concat(u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(off),u16(0));
  return new Blob(parts.concat([new Uint8Array(cd),new Uint8Array(end)]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function col(i){return String.fromCharCode(65+i)}
function xlsx(){
  var head=['Obligation','Article','Topic','Obligation text','Status','Controls','Owners','Last tests'];
  var data=[head].concat(inScope().map(function(o){var cs=ctlsFor(o.id);
    return [o.id,'Art. '+artNum(o),o.topic||'',o.what||'',STAT[statusOf(o)].label,cs.map(function(c){return c.name}).join('; '),cs.map(function(c){return c.owner||'none'}).join('; '),cs.map(function(c){return c.last_tested||'never'}).join('; ')]}));
  var sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
   data.map(function(r,i){return '<row r="'+(i+1)+'">'+r.map(function(v,j){return '<c r="'+col(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')+'</t></is></c>'}).join('')+'</row>'}).join('')+'</sheetData></worksheet>';
  var X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  var blob=zip([
   {name:'[Content_Types].xml',data:X+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
   {name:'_rels/.rels',data:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
   {name:'xl/workbook.xml',data:X+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Gap assessment" sheetId="1" r:id="rId1"/></sheets></workbook>'},
   {name:'xl/_rels/workbook.xml.rels',data:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
   {name:'xl/worksheets/sheet1.xml',data:sheet}]);
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='regradar-gap-assessment-'+TODAY.toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
}
function snapshot(){
  var items={};inScope().forEach(function(o){items[o.id]=statusOf(o)});
  var sn=snaps(),d=TODAY.toISOString().slice(0,10);
  sn.push({id:'s'+Date.now(),label:d+' ('+Object.keys(items).length+' obligations)',date:d,items:items});
  if(jset(SKEY,sn.slice(-20)))toast('Snapshot saved on this device.');
}

function setup(){
  var c=jget(CKEY,null);if(c)CFG=Object.assign(CFG,c);
  var f={cfgOwner:'needOwner',cfgTest:'needTest',cfgOverdue:'overdueIsUntested'};
  Object.keys(f).forEach(function(id){var el=$(id);el.checked=!!CFG[f[id]];el.addEventListener('change',function(){CFG[f[id]]=el.checked;jset(CKEY,CFG);renderAll()})});
  $('firmSel').innerHTML+=((APP&&APP.entities)||[]).map(function(e){return '<option value="'+esc(e.id)+'">'+esc(e.label)+'</option>'}).join('');
  var ts={};OBS.forEach(function(o){ts[o.topic||'Other']=1});
  $('topicSel').innerHTML+=Object.keys(ts).sort().map(function(t){return '<option>'+esc(t)+'</option>'}).join('');
  $('statSel').innerHTML+=ORDER.map(function(k){return '<option value="'+k+'">'+STAT[k].label+'</option>'}).join('');
  $('firmSel').addEventListener('change',function(e){S.firm=e.target.value;renderAll()});
  $('topicSel').addEventListener('change',function(e){S.topic=e.target.value;renderView()});
  $('statSel').addEventListener('change',function(e){S.status=e.target.value;renderView()});
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-id],[data-v],[data-act]');if(!t)return;
    if(t.dataset.id){S.sel=t.dataset.id;renderView();renderDetail()}
    else if(t.dataset.v){S.view=t.dataset.v;renderView()}
    else if(t.dataset.act==='xlsx')xlsx();
    else if(t.dataset.act==='print')window.print();
    else if(t.dataset.act==='snap'){snapshot();if(S.view==='compare')renderView()}
  });
  document.addEventListener('change',function(e){if(e.target.id==='cmpSel'){S.cmp=e.target.value;renderView()}});
  var q=new URLSearchParams(location.search);if(q.get('view'))S.view=q.get('view');
  renderAll();
}
Promise.all([
  fetch('data/obligations.json',{cache:'no-store'}).then(function(r){return r.json()}),
  window.ControlsData.load(),
  fetch('data/applicability.json',{cache:'no-store'}).then(function(r){return r.json()}).catch(function(){return null})
]).then(function(r){OBS=r[0].obligations||[];CONTROLS=r[1].controls;APP=r[2];setup()})
 .catch(function(){$('view').innerHTML='<p class="rr-empty">Could not load the data. Check your connection and reload.</p>'});
})();
