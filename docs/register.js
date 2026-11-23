/* Register board: obligations as cards in the firm's handling columns. Logic in register-logic.js and gap-logic.js. */
(function(){
'use strict';
var RL=window.RegisterLogic,GL=window.GapLogic;
var OBS=[],CONTROLS=[],APP=null,SP=null,TODAY=new Date(),CARDS=[];
var MKEY='regradar-obligations-mine',CKEY='regradar-gap-config',VKEY='regradar-register-view';
var S={view:'board',f:{topic:'',who:'',priority:'',owner:''},sel:null};
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function toast(m){var t=$('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},3200)}
function jget(k,d){try{var v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function pill(c){return c==='controlled'?'done':c==='owned'?'live':c==='applicable'?'review':''}
function whoLabel(id){var e=((APP&&APP.entities)||[]).filter(function(x){return x.id===id})[0];return e?e.label:id}
function whoShort(w){var all=((APP&&APP.entities)||[]).length;return all&&w.length>=all?'All firm types':w.length>3?w.length+' firm types':w.map(whoLabel).join(', ')}
function ctx(){
  var cfg=Object.assign({},GL.DEFAULT_CFG,jget(CKEY,{}));  // the same "what counts as covered" setting as the gap view
  var dis=jget(MKEY,{}).dismissed||{};
  return {controls:CONTROLS,cfg:cfg,spine:SP,isOverdue:function(c){return window.ControlsData.isOverdue(c,TODAY)},legacyDismissed:function(id){return !!dis[id]}};
}
function recompute(){CARDS=RL.buildCards(OBS,ctx())}
function cardById(id){return CARDS.filter(function(c){return c.id===id})[0]}
function visible(){return RL.filterCards(CARDS,S.f)}

function cardHtml(c){
  var o=c.o,opts=RL.COLS.map(function(k){return '<option value="'+k.id+'"'+(k.id===c.col?' selected':'')+'>'+esc(k.label)+'</option>'}).join('');
  return '<li class="kb-card" data-id="'+esc(c.id)+'"><button type="button" class="open" data-open="'+esc(c.id)+'">'+
    '<div class="t">'+esc(RL.shortTitle(o))+'</div><div class="src">'+esc(o.legal_basis||'')+(o.topic?' · '+esc(o.topic):'')+'</div>'+
    '<div class="m"><span class="pill '+(o.priority==='high'?'risk':'')+'">'+esc(o.priority||'no priority')+'</span>'+
    '<span>'+esc(whoShort(o.who||[]))+'</span></div>'+
    '<div class="m"><span>Owner: '+esc(c.owner||'none')+'</span><span>'+c.ctlCount+' control'+(c.ctlCount===1?'':'s')+'</span></div></button>'+
    '<div class="foot"><label class="sr" for="mv-'+esc(c.id)+'">Move to</label><select class="sel" id="mv-'+esc(c.id)+'" data-move="'+esc(c.id)+'" aria-label="Move this obligation">'+opts+'</select>'+
    '<button type="button" class="grip" data-grip="'+esc(c.id)+'" aria-label="Drag to another column" title="Drag to another column"></button></div></li>';
}
function renderBoard(cards){
  var g=RL.group(cards);
  return '<div class="kb" id="kb">'+RL.COLS.map(function(k){
    var l=g[k.id];
    return '<section class="kb-col'+(k.id==='controlled'?' auto':'')+'" data-col="'+k.id+'" aria-label="'+esc(k.label)+'"><div class="kb-col-h"><h3>'+esc(k.label)+'</h3><span class="n">'+l.length+'</span></div>'+
      '<p class="hint">'+esc(k.hint)+'</p><ul class="kb-cards">'+(l.length?l.map(cardHtml).join(''):'<li class="empty-col">Nothing here.</li>')+'</ul></section>'}).join('')+'</div>';
}
function renderList(cards){
  var rank={};RL.COLS.forEach(function(k,i){rank[k.id]=i});
  var rows=cards.slice().sort(function(a,b){return rank[a.col]-rank[b.col]||RL.artNum(a.o)-RL.artNum(b.o)});
  if(!rows.length)return '<p class="rr-empty">Nothing matches these filters.</p>';
  return '<div class="rr-table-wrap"><table class="rr-table"><thead><tr><th>Obligation</th><th>Status</th><th>Priority</th><th>Applies to</th><th>Owner</th><th>Controls</th></tr></thead><tbody>'+rows.map(function(c){
    return '<tr><td><button type="button" class="linkbtn" data-open="'+esc(c.id)+'">'+esc(c.o.legal_basis||c.id)+'</button> '+esc(RL.shortTitle(c.o))+'</td><td><span class="pill '+pill(c.col)+'">'+esc(RL.colLabel(c.col))+'</span></td><td>'+esc(c.o.priority||'')+'</td><td>'+esc((c.o.who||[]).map(whoLabel).join(', '))+'</td><td>'+esc(c.owner||'none')+'</td><td>'+c.ctlCount+'</td></tr>'}).join('')+'</tbody></table></div>';
}
function render(){
  recompute();
  var all=CARDS,vis=visible(),n=all.length,c={};
  RL.COLS.forEach(function(k){c[k.id]=all.filter(function(x){return x.col===k.id}).length});
  $('lead').textContent=n+' verified AMLR obligations. '+c.controlled+' controlled and tested, '+c.owned+' owned, '+c.applicable+' applicable, '+c.not_assessed+' not assessed, '+c.na+' not applicable.'+(vis.length!==n?' Showing '+vis.length+' with the filters.':'');
  refreshOwners();
  $('view').innerHTML=S.view==='list'?renderList(vis):renderBoard(vis);
  document.querySelectorAll('.seg [role=tab]').forEach(function(b){b.setAttribute('aria-selected',String(b.getAttribute('data-v')===S.view))});
}

/* ---- moves ---- */
function doMove(id,to,owner){
  var c=cardById(id);if(!c)return;
  var chk=RL.canMove(c,to);
  if(!chk.ok){if(chk.reason)toast(chk.reason);render();return}
  if(chk.needsOwner&&owner==null){askOwner(c,to);return}
  try{RL.move(SP,c,to,{owner:owner});toast('Moved to '+RL.colLabel(to)+'.');}catch(e){toast(e.message)}
  render();if(S.sel===id)renderDetail();
}
function askOwner(c,to){
  var d=$('ownDlg');$('ownWhat').textContent=(c.o.legal_basis||c.id)+': '+RL.shortTitle(c.o);$('ownIn').value='';
  d.dataset.id=c.id;d.dataset.to=to;d.showModal();setTimeout(function(){$('ownIn').focus()},30);
  render(); // snap the card back to its column until an owner is named
}

/* ---- drag and drop: pointer events, so it works with a finger as well as a mouse ---- */
var drag=null;
function colAt(x,y){var el=document.elementFromPoint(x,y);return el&&el.closest?el.closest('.kb-col'):null}
document.addEventListener('pointerdown',function(e){
  if(S.view!=='board'||e.button>0)return;
  var grip=e.target.closest('[data-grip]'),cardEl=e.target.closest('.kb-card');
  if(!cardEl||e.target.closest('select'))return;
  if(e.pointerType!=='mouse'&&!grip)return;  // a finger scrolls the board; it drags only from the handle
  drag={id:cardEl.dataset.id,el:cardEl,x:e.clientX,y:e.clientY,on:false,ghost:null,pid:e.pointerId,grip:grip};
  if(grip){try{grip.setPointerCapture(e.pointerId)}catch(x){}}
});
document.addEventListener('pointermove',function(e){
  if(!drag||e.pointerId!==drag.pid)return;
  if(!drag.on){
    if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<8)return;
    drag.on=true;drag.el.classList.add('drag-src');
    var gh=drag.el.cloneNode(true);gh.classList.add('ghost');gh.classList.remove('drag-src');gh.removeAttribute('data-id');gh.setAttribute('aria-hidden','true');
    document.body.appendChild(gh);drag.ghost=gh;
  }
  e.preventDefault();
  drag.ghost.style.left=(e.clientX-40)+'px';drag.ghost.style.top=(e.clientY-20)+'px';
  var col=colAt(e.clientX,e.clientY);
  document.querySelectorAll('.kb-col.over').forEach(function(x){if(x!==col)x.classList.remove('over')});
  if(col)col.classList.add('over');
  var kb=$('kb');if(kb){var r=kb.getBoundingClientRect();if(e.clientX>r.right-40)kb.scrollLeft+=14;else if(e.clientX<r.left+40)kb.scrollLeft-=14}
},{passive:false});
function endDrag(e,cancel){
  if(!drag||e.pointerId!==drag.pid)return;
  var d=drag;drag=null;
  if(d.ghost)d.ghost.remove();
  d.el.classList.remove('drag-src');
  var col=d.on&&!cancel?colAt(e.clientX,e.clientY):null;
  document.querySelectorAll('.kb-col.over').forEach(function(x){x.classList.remove('over')});
  if(d.on){suppressClick=true;setTimeout(function(){suppressClick=false},0)}
  if(col)doMove(d.id,col.dataset.col);
}
var suppressClick=false;
document.addEventListener('pointerup',function(e){endDrag(e,false)});
document.addEventListener('pointercancel',function(e){endDrag(e,true)});
document.addEventListener('contextmenu',function(e){if(drag&&drag.on)e.preventDefault()});

/* ---- detail ---- */
function renderDetail(){
  var c=cardById(S.sel),d=$('dlg');if(!c)return;
  var o=c.o,actions=[];
  try{actions=SP.linked('OBL:'+o.id,'addresses','in').filter(function(e){return e.type==='issue'})}catch(e){}
  var opts=RL.COLS.map(function(k){return '<option value="'+k.id+'"'+(k.id===c.col?' selected':'')+'>'+esc(k.label)+'</option>'}).join('');
  d.innerHTML='<div class="dlg-h"><h2 id="dlgT">'+esc(o.legal_basis||o.id)+'</h2><button class="rr-x" type="button" aria-label="Close" data-close><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>'+
   '<div class="dlg-b"><p><span class="pill '+pill(c.col)+'">'+esc(RL.colLabel(c.col))+'</span> <span class="pill '+(o.priority==='high'?'risk':'')+'">'+esc(o.priority||'no priority')+'</span></p>'+
   '<p>'+esc(o.what||'')+'</p>'+
   '<p class="hint">Applies to: '+esc((o.who||[]).map(whoLabel).join(', ')||'not stated')+(o.who_note?'. '+esc(o.who_note):'')+'</p>'+
   (o.verbatim?'<h3>The law, verbatim</h3><blockquote>'+esc(o.verbatim)+'</blockquote>':'')+
   '<p><a href="'+esc(o.source_url||'law.html')+'">Read the article in full</a></p>'+
   '<h3>Status and owner</h3><div class="row"><label class="sr" for="dMove">Status</label><select class="sel" id="dMove" data-dmove="'+esc(c.id)+'">'+opts+'</select></div>'+
   '<div class="row"><label class="sr" for="dOwner">Owner</label><input class="in" id="dOwner" type="text" value="'+esc(c.ownerIsOwn?c.owner:'')+'" placeholder="'+esc(c.owner||'Owner name')+'"><button class="btn" type="button" data-save-owner="'+esc(c.id)+'">Save owner</button></div>'+
   '<h3>Controls</h3>'+(c.controls.length?'<ul>'+c.controls.map(function(k){return '<li><a href="workspace.html?view=controls&amp;control='+encodeURIComponent(k.id)+'">'+esc(k.name)+'</a>: owner '+esc(k.owner||'none')+', '+esc(k.status)+', last test '+esc(k.last_tested||'never')+'</li>'}).join('')+'</ul>':'<p>No control is mapped yet. <a href="workspace.html?view=controls">Open Controls</a>.</p>')+
   '<h3>Issues and actions</h3>'+(actions.length?'<ul>'+actions.map(function(a){return '<li><a href="actions.html">'+esc(a.title)+'</a> ('+esc(a.status)+')</li>'}).join('')+'</ul>':'<p>None linked.</p>')+'</div>'+
   '<div class="dlg-f"><button class="btn pri" type="button" data-close>Done</button></div>';
}
function openDetail(id){S.sel=id;renderDetail();var d=$('dlg');if(!d.open)d.showModal()}

/* ---- events ---- */
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.closest('[data-close]')){var dl=t.closest('dialog');if(dl)dl.close();return}
  if(t.tagName==='DIALOG'){t.close();return}
  var v=t.closest('[data-v]');if(v){S.view=v.dataset.v;try{localStorage.setItem(VKEY,S.view)}catch(x){}render();return}
  if(suppressClick)return;
  var o=t.closest('[data-open]');if(o){openDetail(o.dataset.open);return}
  var so=t.closest('[data-save-owner]');
  if(so){var c=cardById(so.dataset.saveOwner);try{RL.setOwner(SP,c,$('dOwner').value);toast('Owner saved.')}catch(x){toast(x.message)}render();renderDetail()}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.dataset.move){doMove(t.dataset.move,t.value);return}
  if(t.dataset.dmove){doMove(t.dataset.dmove,t.value);return}
  var map={fTopic:'topic',fWho:'who',fPrio:'priority',fOwner:'owner'};
  if(map[t.id]){S.f[map[t.id]]=t.value;render()}
});
$('ownForm').addEventListener('submit',function(){
  var d=$('ownDlg'),name=$('ownIn').value.trim();if(!name)return;
  doMove(d.dataset.id,d.dataset.to,name);
});

function setupFilters(){
  var ts={},ps={};OBS.forEach(function(o){ts[o.topic||'Other']=1;if(o.priority)ps[o.priority]=1});
  $('fTopic').innerHTML+=Object.keys(ts).sort().map(function(t){return '<option>'+esc(t)+'</option>'}).join('');
  var used={};OBS.forEach(function(o){(o.who||[]).forEach(function(w){used[w]=1})});
  $('fWho').innerHTML+=Object.keys(used).map(function(w){return '<option value="'+esc(w)+'">'+esc(whoLabel(w))+'</option>'}).join('');
  var order={high:0,medium:1,low:2};
  $('fPrio').innerHTML+=Object.keys(ps).sort(function(a,b){return (order[a]==null?9:order[a])-(order[b]==null?9:order[b])}).map(function(p){return '<option>'+esc(p)+'</option>'}).join('');
}
function refreshOwners(){
  var cur=$('fOwner').value,os={};CARDS.forEach(function(c){if(c.owner)os[c.owner]=1});
  $('fOwner').innerHTML='<option value="">Any owner</option><option value="__none">No owner</option>'+Object.keys(os).sort().map(function(n){return '<option>'+esc(n)+'</option>'}).join('');
  $('fOwner').value=cur;S.f.owner=$('fOwner').value;
}

Promise.all([
  fetch('data/obligations.json',{cache:'no-store'}).then(function(r){return r.json()}),
  window.ControlsData.load(),
  fetch('data/applicability.json',{cache:'no-store'}).then(function(r){return r.json()}).catch(function(){return null})
]).then(function(r){
  OBS=r[0].obligations||[];CONTROLS=r[1].controls;APP=r[2];SP=window.RR.current;
  var q=new URLSearchParams(location.search),sv=q.get('view');
  try{sv=sv||localStorage.getItem(VKEY)}catch(x){}
  if(sv==='list'||sv==='board')S.view=sv;
  setupFilters();render();
  var open=q.get('id');if(open&&cardById(open))openDetail(open);
}).catch(function(){$('view').innerHTML='<p class="rr-empty">Could not load the data. Check your connection and reload.</p>'});
})();
