/* ═══════════════════════════════════════════════════════════════════
   ACADEMY SHELL — the shell, in one place
   ───────────────────────────────────────────────────────────────────
   Each module used to draw its own HUD. Result: three different bars,
   three ways of showing XP, and no way to see where you stood in the
   learning path.

   Here the shell is unique and the modules know nothing about it: they
   declare their id, and push their own indicators (hours remaining,
   current alert) via Shell.status().

   Progress is also unified. Each module used to write its XP to its
   own storage key; now a single key is authoritative, and the old ones
   are migrated on first load so nothing is lost.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const KEY='regradar-academy-progress';

/* The path. The order IS the pedagogy: you can't recognise a pattern
   you've never produced, so offence precedes defence. */
const MODULES=[
 {id:'laundromat', n:'Laundromat', no:'01', file:'laundromat.html',
  label:'The launderer', needs:0,
  tag:'Play the adversary: thirteen typologies, eight jurisdictions.'},
 {id:'ownership',  n:'Ownership', no:'02', file:'ownership.html',
  label:'Ownership structures', needs:0,
  tag:'Read an ownership chart and designate the beneficial owners.'},
 {id:'desk',       n:'The Desk', no:'03', file:'desk.html',
  label:'Alerts and investigations', needs:0,
  tag:'One day: alerts, and hours you don’t get back.'},
 {id:'filing',     n:'Filing', no:'04', file:null,
  label:'Drafting the STR', needs:2, tag:'In development.'},
 {id:'inspection', n:'Inspection', no:'05', file:null,
  label:'Defending your decisions', needs:3, tag:'In development.'},
];

const RANKS=[
 {xp:0,    n:'TRAINEE',    art:'·', blurb:'An access badge and a queue. Everything else is earned.'},
 {xp:600,  n:'ANALYST I',  art:'▹', blurb:'You can tell a documented property purchase from a structured deposit. That’s further than it sounds.'},
 {xp:1500, n:'ANALYST II', art:'▸', blurb:'You close cleanly and you escalate deliberately. The investigators have noticed.'},
 {xp:2800, n:'SENIOR',     art:'◆', blurb:'You read the counterparty before the amount. That’s what separates an analyst from an alert-clearer.'},
 {xp:4500, n:'LEAD',       art:'◈', blurb:'You could calibrate a team — the point where this stops being training.'},
 {xp:6800, n:'MLRO',       art:'★', blurb:'Consistent across typologies, calibrated, economical. There’s no higher score.'},
];

let P={xp:0, modules:{}, user:'analyst'};

function load(){
  try{ const p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p) P={...P,...p}; }catch(e){}
  /* Migrate old keys: progress already earned shouldn't disappear just
     because storage got reorganised. */
  if(!P.migrated){
    try{
      const old=JSON.parse(localStorage.getItem('regradar-progress')||'null');
      if(old && old.xp) P.xp=Math.max(P.xp, old.xp);
      const desk=JSON.parse(localStorage.getItem('regradar-desk')||'null');
      if(desk){ if(desk.xp) P.xp=Math.max(P.xp,desk.xp);
        if(desk.done&&desk.done.length) P.modules.desk={done:desk.done.length,started:true}; }
      const own=JSON.parse(localStorage.getItem('regradar-ownership')||'null');
      if(own&&own.done){ const ok=Object.values(own.done).filter(x=>x==='right').length;
        if(ok) P.modules.ownership={done:ok,started:true}; }
      const ac=JSON.parse(localStorage.getItem('regradar-academy')||'null');
      if(ac&&ac.laundromat) P.modules.laundromat={done:ac.laundromat.plays||0,started:true};
    }catch(e){}
    P.migrated=true; save();
  }
}
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(P)); }catch(e){} }

const rankOf=xp=>{let r=RANKS[0];RANKS.forEach(x=>{if(xp>=x.xp)r=x});return r};
const nextRank=xp=>RANKS.find(x=>x.xp>xp)||null;
const esc=s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const doneCount=()=>MODULES.filter(m=>(P.modules[m.id]||{}).done>0).length;

function unlocked(m){ return m.file && doneCount()>=m.needs; }

/* ── shell construction ─────────────────────────────────────────── */
function build(active){
  const outer=document.createElement('div');
  outer.className='ac-outer';
  outer.innerHTML=`
    <div class="ac-brand">
      <span class="mk"><i>A</i>REGRADAR ACADEMY</span>
      <span class="sep"></span>
      <span class="sim">AML TRAINING SIMULATOR</span>
      <span class="rr">
        <a href="academy.html">Path</a>
        <a href="index.html">← RegRadar</a>
      </span>
    </div>
    <div class="ac-machine">
      <div class="ac-title">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="ac-sys"><b>MERIDIAAN</b><span>COMPLIANCE DESK · v4.2</span></span>
        <span class="env"><i></i>SIMULATED ENVIRONMENT<span> · FICTIONAL DATA</span></span>
      </div>
      <nav class="ac-tabs" id="acTabs"></nav>
      <div class="ac-screen" id="acScreen"></div>
      <div class="ac-status" id="acStatus"></div>
      <div class="ac-rank" id="acRank"></div>
    </div>`;
  return outer;
}

function paintTabs(active){
  const el=document.getElementById('acTabs'); if(!el) return;
  el.innerHTML=MODULES.map(m=>{
    const rec=P.modules[m.id]||{};
    const open=unlocked(m);
    const cls=[m.id===active?'on':'', open?'':'locked'].filter(Boolean).join(' ');
    const tick=rec.done>0?'<span class="tick">✓</span>':'';
    const attr = open&&m.id!==active ? `onclick="location.href='${m.file}'"`
               : !open ? `title="Requires ${m.needs} module(s) started"` : '';
    return `<button class="ac-tab ${cls}" ${attr}>
      <span class="n">${m.no}</span>${esc(m.n)}${tick}</button>`;
  }).join('')+'<span class="ac-tab grow"></span>';
}

function paintStatus(extra){
  const el=document.getElementById('acStatus'); if(!el) return;
  const r=rankOf(P.xp), nx=nextRank(P.xp);
  const pct=nx? Math.round((P.xp-r.xp)/(nx.xp-r.xp)*100) : 100;
  el.innerHTML=`
    <span class="who">${esc(P.user)}@meridiaan</span>
    <span class="rk">${esc(r.n)}</span>
    <span class="xp">${P.xp.toLocaleString('en-US')} XP</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="nxt">${nx? `${(nx.xp-P.xp).toLocaleString('en-US')} XP → ${esc(nx.n)}` : 'max rank'}</span>
    <span class="mod" id="acMod">${extra||''}</span>`;
}

/* ── API exposed to modules ─────────────────────────────────────── */
const Shell={
  /* Mounts the shell and renders the page's existing content into the screen. */
  mount(moduleId){
    load();
    const kids=Array.from(document.body.children);
    const outer=build(moduleId);
    document.body.appendChild(outer);
    const screen=document.getElementById('acScreen');
    kids.forEach(k=>{ if(k.tagName!=='SCRIPT') screen.appendChild(k); });
    paintTabs(moduleId); paintStatus('');
    return screen;
  },
  /* Module-specific indicators, on the right of the status bar.
     Example: Shell.status([{k:'Hours',v:'4 h',s:'warn'}]) */
  status(items){
    const el=document.getElementById('acMod'); if(!el) return;
    el.innerHTML=(items||[]).map(i=>
      `<span><span class="k">${esc(i.k)}</span> <span class="v ${i.s||''}">${esc(i.v)}</span></span>`
    ).join('');
  },
  /* XP: a single counter for the whole path. Returns true on promotion. */
  award(moduleId, xp){
    const before=rankOf(P.xp).n;
    P.xp+=xp;
    const rec=P.modules[moduleId]||{done:0,started:true};
    rec.started=true; P.modules[moduleId]=rec;
    save();
    const after=rankOf(P.xp);
    paintStatus(document.getElementById('acMod')?.innerHTML||'');
    if(after.n!==before){ Shell.promote(after); return true; }
    return false;
  },
  complete(moduleId, n){
    const rec=P.modules[moduleId]||{done:0};
    rec.done=Math.max(rec.done||0, n||((rec.done||0)+1));
    rec.started=true; P.modules[moduleId]=rec; save();
    paintTabs(moduleId);
  },
  promote(r){
    const el=document.getElementById('acRank'); if(!el) return;
    el.innerHTML=`<div class="k">PROMOTION</div><div class="art">${r.art}</div>
      <h2>${esc(r.n)}</h2><p>${esc(r.blurb)}</p>
      <button onclick="AcademyShell.closeRank()">CONTINUE</button>`;
    el.classList.add('on');
  },
  closeRank(){ const el=document.getElementById('acRank'); if(el) el.classList.remove('on'); },
  toast(msg){
    const s=document.getElementById('acScreen'); if(!s) return;
    const t=document.createElement('div'); t.className='ac-toast'; t.textContent=msg;
    s.appendChild(t); setTimeout(()=>t.remove(),2700);
  },
  get xp(){ return P.xp; },
  get rank(){ return rankOf(P.xp); },
  get modules(){ return MODULES; },
  get progress(){ return P; },
  reset(){ P={xp:0,modules:{},user:'analyst',migrated:true}; save(); location.reload(); },
};

window.AcademyShell=Shell;
})();
