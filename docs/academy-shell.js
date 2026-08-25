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
   you've never produced, so offence precedes defence. The path is
   locked: each module requires the ones before it. */
const MODULES=[
 {id:'laundromat', n:'Laundromat', no:'01', file:'laundromat.html',
  label:'The launderer', needs:0,
  tag:'Play the adversary: thirteen typologies, eight jurisdictions.'},
 {id:'ownership',  n:'Ownership', no:'02', file:'ownership.html',
  label:'Ownership structures', needs:1,
  tag:'Read an ownership chart and designate the beneficial owners.'},
 {id:'desk',       n:'The Desk', no:'03', file:'desk.html',
  label:'Alerts and investigations', needs:2,
  tag:'One day: alerts, and hours you don’t get back.'},
 {id:'filing',     n:'Filing', no:'04', file:null,
  label:'Drafting the STR', needs:2, tag:'In development.'},
 {id:'inspection', n:'Inspection', no:'05', file:null,
  label:'Defending your decisions', needs:3, tag:'In development.'},
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
        <a href="workstation.html">Path</a>
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
    ensureLoad();
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
