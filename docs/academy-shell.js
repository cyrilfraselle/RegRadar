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

/* The learning path (academy.html) is where modules unlock in order. The
   practice rooms below it (Laundromat, Ownership, Desk) are open any time:
   the modules send learners to the right one. ENFORCE_GATE only matters if a
   module sets needs > 0; flip it to true to lock a room behind earlier ones. */
const ENFORCE_GATE=false;

/* The practice rooms. 'learn' is the learning path itself: it records the XP
   and the count of completed modules ('regradar-academy-progress' keeps its
   shape; the detailed completion records live in AcademyProgress). */
const MODULES=[
 {id:'learn',      n:'Learn', no:'00', file:'academy.html', needs:0, noTick:true,
  label:'Learning path', tag:'Nine short modules: explainer, risks, questions and the law.'},
 {id:'laundromat', n:'Laundromat', no:'01', file:'laundromat.html',
  label:'The launderer', needs:0,
  tag:'Play the adversary: thirteen typologies, eight jurisdictions.'},
 {id:'ownership',  n:'Ownership', no:'02', file:'ownership.html',
  label:'Ownership structures', needs:0,
  tag:'Read an ownership chart and designate the beneficial owners.'},
 {id:'desk',       n:'The Desk', no:'03', file:'desk.html',
  label:'Alerts and investigations', needs:0,
  tag:'One day: alerts, and hours you don’t get back.'},
];

const RANKS=[
 {xp:0,    n:'JUNIOR',         art:'·', blurb:'An access badge and a queue. Everything else is earned.'},
 {xp:600,  n:'ANALYST',        art:'▹', blurb:'You can tell a documented property purchase from a structured deposit. That’s further than it sounds.'},
 {xp:1600, n:'SENIOR ANALYST', art:'▸', blurb:'You close cleanly and you escalate deliberately. The investigators have noticed.'},
 {xp:3200, n:'INVESTIGATOR',   art:'◆', blurb:'You read the counterparty before the amount. That’s what separates an analyst from an alert-clearer.'},
 {xp:5500, n:'AML EXPERT',     art:'★', blurb:'Consistent across typologies, calibrated, economical. There’s no higher rank on this desk.'},
];

/* ── skill tree ──────────────────────────────────────────────────
   Global XP/rank says how far along the path you are. The skill
   tree says at what, specifically — nine subjects, each earned by
   the actions that actually exercise it, not by finishing a module. */
const SKILLS=[
 {id:'kyc',        icon:'🪪', n:'KYC / CDD'},
 {id:'tm',         icon:'🔍', n:'Transaction Monitoring'},
 {id:'sanctions',  icon:'🌍', n:'Sanctions & PEP'},
 {id:'media',      icon:'📰', n:'Adverse Media'},
 {id:'ubo',        icon:'🏢', n:'UBO / KYB'},
 {id:'risk',       icon:'⚠️', n:'Risk Assessment'},
 {id:'str',        icon:'📋', n:'STR/SAR & Escalation'},
 {id:'reg',        icon:'⚖️', n:'AML Regulation'},
 {id:'judgement',  icon:'🧠', n:'Investigation & Judgement'},
];
const MASTERY=[
 {n:'Introduced', xp:0},
 {n:'Basic',      xp:80},
 {n:'Proficient', xp:220},
 {n:'Advanced',   xp:450},
 {n:'Expert',     xp:800},
];
const BADGES=[
 {id:'first-case',      icon:'🎯', n:'First Investigation', d:'Close your first case on the desk.'},
 {id:'ubo-detective',   icon:'🏢', n:'UBO Detective',        d:'Solve all six ownership structures correctly.'},
 {id:'clean-sweep',     icon:'🧼', n:'Clean Sweep',          d:'Run a scheme from setup to walk-away with zero catches.'},
 {id:'red-flag',        icon:'🚩', n:'Red Flag Master',      d:'Get caught five times across runs — and learn what tripped it.'},
 {id:'sanctions-hunter',icon:'🌍', n:'Sanctions Hunter',     d:'Run three sanctions & PEP screenings.'},
 {id:'media-watcher',   icon:'📰', n:'Media Watcher',        d:'Pull adverse media three times during an investigation.'},
 {id:'by-the-book',     icon:'⚖️', n:'By The Book',          d:'Cite ten distinct AMLR articles across your case decisions.'},
 {id:'reporter',        icon:'📋', n:'The Reporter',         d:'File three STR/SAR reports.'},
 {id:'on-a-roll',       icon:'🔥', n:'On A Roll',            d:'Three days in a row on the desk.'},
 {id:'week-one',        icon:'🏆', n:'Week One',             d:'Complete all seven days of the desk journal.'},
];
const SKEY='regradar-skills-progress';
let SK={skills:{}, badges:[], streak:{count:0,last:null}, daily:{date:null,done:false}, seenLaw:[]};
function loadSK(){
  try{ const s=JSON.parse(localStorage.getItem(SKEY)||'null'); if(s) SK={...SK,...s}; }catch(e){}
}
function saveSK(){ try{ localStorage.setItem(SKEY,JSON.stringify(SK)); }catch(e){} }
function masteryOf(xp){
  let idx=0; MASTERY.forEach((t,i)=>{ if(xp>=t.xp) idx=i; });
  const cur=MASTERY[idx], nx=MASTERY[idx+1];
  const pct=nx? Math.round((xp-cur.xp)/(nx.xp-cur.xp)*100) : 100;
  return {tier:idx, name:cur.n, xp, next:nx? nx.xp-xp : 0, pct};
}
function todayStr(){ return new Date().toISOString().slice(0,10); }
function bumpStreak(){
  loadSK();
  const t=todayStr();
  if(SK.streak.last===t) return SK.streak.count;
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  SK.streak.count = SK.streak.last===y ? SK.streak.count+1 : 1;
  SK.streak.last=t; saveSK();
  return SK.streak.count;
}

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
/* mount() used to be the only entry point that called load() — fine for
   the classic pages, but the workstation never calls mount() and was
   silently reading P at its in-memory default (xp 0, no modules) on
   every fresh page load. Every read/write below goes through this
   instead, so progress survives a reload with or without mount(). */
let loaded=false;
function ensureLoad(){ if(!loaded){ loaded=true; load(); } }

const rankOf=xp=>{let r=RANKS[0];RANKS.forEach(x=>{if(xp>=x.xp)r=x});return r};
const nextRank=xp=>RANKS.find(x=>x.xp>xp)||null;
const esc=s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/* A module counts as done once it has been COMPLETED at least once — a
   finished laundromat run, one ownership file solved, one desk day closed.
   Merely opening it (started) does not count. */
const doneCount=()=>MODULES.filter(m=>(P.modules[m.id]||{}).done>0).length;

function unlocked(m){ return !!m.file && doneCount()>=m.needs; }
function lockWhy(m){
  if(!m.file) return 'In development — not open yet.';
  const n=m.needs-doneCount();
  return `Locked — complete ${m.needs} module${m.needs>1?'s':''} first (${doneCount()} of ${m.needs} done). `
    +`${n} more to go.`;
}

/* ═══ accessibility helpers, shared by every simulator page ═══════════
   announce(): one polite live region for strikes, XP, verdicts, flags.
   openDialog()/closeDialog(): role=dialog + aria-modal + label, focus
   moved in on open, Tab trapped, Esc closes, focus restored on close.
   keepFocus(): re-render a container without dropping focus to <body>. */
let liveEl=null, liveQ=[], liveT=null;
function liveRegion(){
  if(liveEl && document.body.contains(liveEl)) return liveEl;
  liveEl=document.getElementById('acLive');
  if(!liveEl){
    liveEl=document.createElement('div');
    liveEl.id='acLive'; liveEl.className='ac-sr';
    liveEl.setAttribute('role','status');
    liveEl.setAttribute('aria-live','polite');
    liveEl.setAttribute('aria-atomic','true');
    document.body.appendChild(liveEl);
  }
  return liveEl;
}
/* Messages sent within ~120 ms are read as one ("Strike 2 of 3. +40 XP"). */
function announce(msg){
  if(!msg) return;
  liveQ.push(String(msg).replace(/\s+/g,' ').trim());
  clearTimeout(liveT);
  liveT=setTimeout(()=>{
    const el=liveRegion();
    const t=liveQ.map(x=>x.replace(/[.\s]+$/,'')).filter(Boolean).join('. ')+'.';
    liveQ=[]; el.textContent='';
    setTimeout(()=>{ el.textContent=t; },40);
  },120);
}

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),'
  +'textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const isShown=n=>!!n && n.getClientRects().length>0 && getComputedStyle(n).visibility!=='hidden';
const focusables=root=>Array.from(root.querySelectorAll(FOCUSABLE)).filter(isShown);
const DLG=[], WAIT=[];
let dlgWired=false;

function inertAround(el){
  const out=[]; let n=el;
  while(n && n!==document.body && n.parentElement){
    Array.from(n.parentElement.children).forEach(s=>{
      if(s===n || s.id==='acLive' || s.tagName==='SCRIPT' || s.tagName==='STYLE' || s.hasAttribute('inert')) return;
      s.setAttribute('inert',''); out.push(s);
    });
    n=n.parentElement;
  }
  return out;
}
function activate(d){
  const el=d.el, o=d.o;
  d.inerted=inertAround(el);
  DLG.push(d);
  if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','-1');
  let f=typeof o.focus==='function'? o.focus() : (typeof o.focus==='string'? el.querySelector(o.focus) : o.focus);
  if(f && !f.matches?.(FOCUSABLE) && !f.hasAttribute('tabindex')) f.setAttribute('tabindex','-1');
  if(!f) f=focusables(el)[0];
  (f||el).focus({preventScroll:!!o.noScroll});
}
function wireDialogs(){
  if(dlgWired) return; dlgWired=true;
  document.addEventListener('keydown',e=>{
    const d=DLG[DLG.length-1]; if(!d) return;
    if(e.key==='Escape'){
      e.preventDefault(); e.stopPropagation();
      (d.o.onEscape||(()=>closeDialog(d.el)))();
      return;
    }
    if(e.key!=='Tab') return;
    const f=focusables(d.el), a=document.activeElement;
    if(!f.length){ e.preventDefault(); d.el.focus(); return; }
    const first=f[0], last=f[f.length-1];
    if(!d.el.contains(a)) { e.preventDefault(); first.focus(); }
    else if(e.shiftKey && (a===first || a===d.el)){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && a===last){ e.preventDefault(); first.focus(); }
  },true);
}
/* o: {label | labelledBy, focus (selector|element|fn), opener, onEscape} */
function openDialog(el,o){
  if(!el) return null;
  o=o||{}; wireDialogs();
  el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
  if(o.labelledBy){ el.setAttribute('aria-labelledby',o.labelledBy); el.removeAttribute('aria-label'); }
  else if(o.label){ el.setAttribute('aria-label',o.label); el.removeAttribute('aria-labelledby'); }
  const ae=document.activeElement;
  const d={el,o,opener:o.opener||(ae&&ae!==document.body?ae:null)};
  if(DLG.some(x=>x.el===el)) return d;
  if(DLG.length){ WAIT.push(d); return d; }   /* queued behind the dialog on top */
  activate(d); return d;
}
/* o: {after: runs before focus is restored (e.g. re-render),
       fallback: ()=>element when the opener is gone, noRestore} */
function closeDialog(el,o){
  if(!el) return; o=o||{};
  const i=DLG.findIndex(d=>d.el===el);
  if(i<0){
    const j=WAIT.findIndex(w=>w.el===el); if(j>=0) WAIT.splice(j,1);
    el.removeAttribute('aria-modal');
    if(o.after) o.after();
    return;
  }
  const d=DLG.splice(i,1)[0];
  d.inerted.forEach(n=>n.removeAttribute('inert'));
  el.removeAttribute('aria-modal');
  if(o.after) o.after();
  const nx=WAIT.length? WAIT.shift() : null;
  if(nx && isShown(nx.el)){ activate(nx); return; }
  if(o.noRestore) return;
  let t=d.opener;
  if(!(t && document.contains(t) && isShown(t) && !t.closest('[inert]'))) t=o.fallback? o.fallback() : null;
  if(t && t.focus) t.focus({preventScroll:false});
}

/* Re-render a container without losing keyboard focus: the focused
   control is found again by its onclick / data-fk / id / label. */
function sig(n){
  /* identity = onclick / data-* / id when there is one; visible text only as a last resort */
  const data=Array.from(n.attributes).filter(a=>/^data-/.test(a.name)).map(a=>a.name+'='+a.value).join(',');
  const ident=(n.getAttribute('onclick')||'')+'|'+data+'|'+(n.id||'');
  return n.tagName+'|'+(ident!=='||'? ident : (n.textContent||'').replace(/\s+/g,' ').trim().slice(0,40));
}
function keepFocus(container,fn,fallback){
  const a=document.activeElement;
  const had=container && a && a!==container && container.contains(a);
  const key=had? sig(a) : null;
  const r=fn();
  if(had && container){
    const q='button,a[href],input,select,textarea,[tabindex]';
    let t=Array.from(container.querySelectorAll(q)).find(n=>sig(n)===key);
    if(!t && fallback) t=typeof fallback==='function'? fallback() : fallback;
    if(t && t.focus) t.focus({preventScroll:true});
  }
  return r;
}
/* Move focus to a view's heading after a navigation (keeps it out of <body>). */
function focusHeading(root,sel){
  if(!root) return;
  const h=root.querySelector(sel||'h1,h2,[data-focus]')||root;
  if(!h.hasAttribute('tabindex')) h.setAttribute('tabindex','-1');
  h.focus({preventScroll:true});
}

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
        <a href="academy.html">Learning path</a>
        <a href="index.html"><span aria-hidden="true">← </span>RegRadar</a>
      </span>
    </div>
    <div class="ac-machine">
      <div class="ac-title">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="ac-sys"><b>CF BANK</b><span>COMPLIANCE DESK · v4.2</span></span>
        <span class="env"><i aria-hidden="true"></i>SIMULATED ENVIRONMENT<span> · FICTIONAL DATA</span></span>
      </div>
      <nav class="ac-tabs" id="acTabs" aria-label="Academy modules"></nav>
      <main class="ac-screen" id="acScreen"></main>
      <div class="ac-status" id="acStatus"></div>
      <div class="ac-rank" id="acRank"></div>
    </div>`;
  return outer;
}

function tabsHTML(active){
  return MODULES.map(m=>{
    const rec=P.modules[m.id]||{};
    const tick=(rec.done>0 && !m.noTick)?'<span class="tick"><span aria-hidden="true">✓</span><span class="ac-sr"> completed</span></span>':'';
    if(unlocked(m)){
      return `<a class="ac-tab ${m.id===active?'on':''}" href="${m.file}"${m.id===active?' aria-current="page"':''}>
        <span class="n">${m.no}</span>${esc(m.n)}${tick}</a>`;
    }
    const why=lockWhy(m);
    return `<button type="button" class="ac-tab locked" aria-disabled="true" data-why="${esc(why)}" title="${esc(why)}">
      <span class="n">${m.no}</span>${esc(m.n)}<span class="lk"> · ${m.file?'locked':'soon'}</span>
      <span class="ac-sr">. ${esc(why)}</span></button>`;
  }).join('')+'<span class="ac-tab grow" aria-hidden="true"></span>';
}
function paintTabs(active){
  const el=document.getElementById('acTabs'); if(!el) return;
  el.setAttribute('aria-label','Academy modules');
  el.innerHTML=tabsHTML(active);
}
/* A locked tab is aria-disabled, not disabled: it stays focusable and says why. */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.ac-tab.locked');
  if(!b) return;
  const why=b.dataset.why||'Locked';
  announce(why); Shell.toast(why);
});

function paintStatus(extra){
  const el=document.getElementById('acStatus'); if(!el) return;
  const r=rankOf(P.xp), nx=nextRank(P.xp);
  const pct=nx? Math.round((P.xp-r.xp)/(nx.xp-r.xp)*100) : 100;
  el.innerHTML=`
    <span class="who">${esc(P.user)}@cfbank</span>
    <span class="rk">${esc(r.n)}</span>
    <span class="xp">${P.xp.toLocaleString('en-US')} XP</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="nxt">${nx? `${(nx.xp-P.xp).toLocaleString('en-US')} XP → ${esc(nx.n)}` : 'max rank'}</span>
    <span class="mod" id="acMod">${extra||''}</span>`;
}

/* A module opened by direct URL before the path allows it: same rule as the
   locked tab, shown as a card over the (inert) page — the page's own script
   still runs underneath, so nothing throws. */
function gate(m,screen){
  const prior=MODULES.filter(x=>x.file && x.no<m.no && !((P.modules[x.id]||{}).done>0));
  const first=prior[0]||MODULES.find(x=>x.file);
  const g=document.createElement('div');
  g.className='ac-gate';
  g.innerHTML=`<div role="region" aria-labelledby="acGateT">
    <div class="k">MODULE ${esc(m.no)} · LOCKED</div>
    <h1 id="acGateT">${esc(m.n)} opens after you complete ${m.needs} module${m.needs>1?'s':''}.</h1>
    <p>${esc(lockWhy(m))} The path is built in order — you cannot recognise a pattern you have
      never produced — so each module needs the one before it. Start with
      <b>${esc(first.n)}</b>.</p>
    <div class="acts"><a href="${first.file}">GO TO ${esc(first.n.toUpperCase())}</a>
      <a class="sec" href="workstation.html">SEE THE PATH</a></div></div>`;
  Array.from(screen.children).forEach(k=>k.setAttribute('inert',''));
  screen.appendChild(g);
  const h=g.querySelector('h1'); h.setAttribute('tabindex','-1');
  announce(m.n+' is locked. '+lockWhy(m));
  setTimeout(()=>h.focus({preventScroll:true}),0);
}

/* ── API exposed to modules ─────────────────────────────────────── */
const Shell={
  /* Mounts the shell and renders the page's existing content into the screen. */
  mount(moduleId){
    ensureLoad();
    const kids=Array.from(document.body.children);
    const outer=build(moduleId);
    document.body.appendChild(outer);
    const screen=document.getElementById('acScreen');
    kids.forEach(k=>{ if(k.tagName!=='SCRIPT') screen.appendChild(k); });
    paintTabs(moduleId); paintStatus('');
    const me=MODULES.find(x=>x.id===moduleId);
    if(ENFORCE_GATE && me && !unlocked(me)) gate(me, screen);
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
    ensureLoad();
    const before=rankOf(P.xp).n;
    P.xp+=xp;
    const rec=P.modules[moduleId]||{done:0,started:true};
    rec.started=true; P.modules[moduleId]=rec;
    save();
    bumpStreak();
    loadSK(); SK.daily={date:todayStr(), done:true}; saveSK();
    const after=rankOf(P.xp);
    paintStatus(document.getElementById('acMod')?.innerHTML||'');
    if(xp) announce('+'+xp+' XP');
    if(after.n!==before){ Shell.promote(after); return true; }
    return false;
  },
  complete(moduleId, n){
    ensureLoad();
    const rec=P.modules[moduleId]||{done:0};
    rec.done=Math.max(rec.done||0, n||((rec.done||0)+1));
    rec.started=true; P.modules[moduleId]=rec; save();
    paintTabs(moduleId);
  },
  promote(r){
    const el=document.getElementById('acRank'); if(!el) return;
    el.innerHTML=`<div class="k">PROMOTION</div><div class="art" aria-hidden="true">${r.art}</div>
      <h2 id="acRankT">${esc(r.n)}</h2><p>${esc(r.blurb)}</p>
      <button type="button" onclick="AcademyShell.closeRank()">CONTINUE</button>`;
    el.classList.add('on');
    announce('Promoted to '+r.n);
    openDialog(el,{labelledBy:'acRankT', onEscape:()=>Shell.closeRank()});
  },
  closeRank(){
    const el=document.getElementById('acRank'); if(!el) return;
    el.classList.remove('on');
    closeDialog(el);
  },
  toast(msg){
    announce(msg);
    const s=document.getElementById('acScreen'); if(!s) return;
    const t=document.createElement('div'); t.className='ac-toast'; t.textContent=msg;
    t.setAttribute('aria-hidden','true');   /* announced once, via the live region */
    s.appendChild(t); setTimeout(()=>t.remove(),2700);
  },
  /* shared a11y helpers (see top of file) */
  announce, openDialog, closeDialog, keepFocus, focusHeading, focusables,
  get dialogOpen(){ return DLG.length>0 || WAIT.length>0; },
  get reducedMotion(){ return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); },
  /* Fills <nav id="acTabs"> on pages that don't mount() the whole shell
     (laundromat.html) with the same tabs, same lock rule. */
  renderTabs(active){ ensureLoad(); paintTabs(active); },
  isUnlocked(id){ ensureLoad(); const m=MODULES.find(x=>x.id===id); return !!m && unlocked(m); },
  get xp(){ ensureLoad(); return P.xp; },
  get rank(){ ensureLoad(); return rankOf(P.xp); },
  get ranks(){ return RANKS; },
  get modules(){ return MODULES; },
  get progress(){ ensureLoad(); return P; },
  reset(){ P={xp:0,modules:{},user:'analyst',migrated:true}; save();
    SK={skills:{},badges:[],streak:{count:0,last:null},daily:{date:null,done:false},seenLaw:[]}; saveSK();
    location.reload(); },

  /* ── skill tree ── */
  get skillDefs(){ return SKILLS; },
  get skills(){
    loadSK();
    return SKILLS.map(s=>({...s, ...masteryOf(SK.skills[s.id]||0)}));
  },
  awardSkill(id, xp){
    loadSK();
    const before=masteryOf(SK.skills[id]||0).tier;
    SK.skills[id]=(SK.skills[id]||0)+xp;
    saveSK();
    const after=masteryOf(SK.skills[id]).tier;
    return after>before ? masteryOf(SK.skills[id]) : null; /* returns tier-up info, else null */
  },
  markLawSeen(article){
    if(!article) return false;
    loadSK();
    if(SK.seenLaw.includes(article)) return false;
    SK.seenLaw.push(article); saveSK();
    return SK.seenLaw.length;
  },
  /* Same extraction workstation.html's markLawSeen() wrapper used to do
     inline — a case's `law` field is a full citation sentence, not a
     bare article number. Kept here so every module (and the shared
     engine) can call one thing instead of repeating the regex. */
  markLawSeenFromText(text){
    if(!text) return false;
    const m=String(text).match(/Art(?:s|icles?)?\.?\s*[\dIVXLC]+(?:\([\da-z]+\))*/i);
    if(!m) return false;
    return Shell.markLawSeen(m[0].replace(/\s+/g,' '));
  },
  get lawSeenCount(){ loadSK(); return SK.seenLaw.length; },

  /* ── badges ── */
  get badgeDefs(){ return BADGES; },
  get badges(){ loadSK(); return BADGES.map(b=>({...b, earned:SK.badges.includes(b.id)})); },
  awardBadge(id){
    loadSK();
    if(SK.badges.includes(id)) return false;
    SK.badges.push(id); saveSK();
    return BADGES.find(b=>b.id===id) || true;
  },
  /* Evaluates all 10 badge conditions against current progress and
     returns the newly-earned ones. Pure — no toast/notify here, since
     not every host page has the same popup system; the caller decides
     how to announce them (workstation.html's checkBadges() wrapper
     already does, via notify()). Moved out of workstation.html so
     ownership.html (and any future module) can call the same
     evaluation instead of only the module that happened to define it. */
  checkBadges(){
    ensureLoad();
    const newly=[];
    const give=id=>{ const b=Shell.awardBadge(id); if(b) newly.push(b); };
    let own=null, desk=null, lb=null, lbStats=null, deskStats=null, tabStats=null;
    try{ own=JSON.parse(localStorage.getItem('regradar-ownership')||'null'); }catch(e){}
    try{ desk=JSON.parse(localStorage.getItem('regradar-desk')||'null'); }catch(e){}
    try{ lb=JSON.parse(localStorage.getItem('regradar-academy')||'null'); }catch(e){}
    try{ lbStats=JSON.parse(localStorage.getItem('regradar-lb-stats')||'null'); }catch(e){}
    try{ deskStats=JSON.parse(localStorage.getItem('regradar-desk-stats')||'null'); }catch(e){}
    try{ tabStats=JSON.parse(localStorage.getItem('regradar-tab-stats')||'null'); }catch(e){}
    const ownOk = own&&own.done ? Object.values(own.done).filter(x=>x==='right').length : 0;
    const deskSeen = desk&&desk.seen ? Object.keys(desk.seen).length : 0;
    if(ownOk>0 || deskSeen>0 || (lb&&lb.laundromat&&lb.laundromat.runs)) give('first-case');
    if(ownOk>=6) give('ubo-detective');
    if(desk&&desk.done&&desk.done.length>=7) give('week-one');
    if(Shell.lawSeenCount>=10) give('by-the-book');
    if(Shell.streak>=3) give('on-a-roll');
    if(lbStats&&lbStats.catches>=5) give('red-flag');
    if(lbStats&&lbStats.cleanRuns>=1) give('clean-sweep');
    if(deskStats&&deskStats.sar>=3) give('reporter');
    if(tabStats&&tabStats.sanc>=3) give('sanctions-hunter');
    if(tabStats&&tabStats.news>=3) give('media-watcher');
    return newly;
  },

  /* ── streak & daily case ── */
  bumpStreak,
  get streak(){ loadSK(); return SK.streak.count; },
  get dailyDone(){ loadSK(); return SK.daily.date===todayStr() && SK.daily.done; },
  markDailyDone(key){
    loadSK(); SK.daily={date:todayStr(), key, done:true}; saveSK();
  },
};

window.AcademyShell=Shell;
})();
