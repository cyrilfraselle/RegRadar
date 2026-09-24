/* ═══════════════════════════════════════════════════════════════════
   ACADEMY SHELL — la coque, en un seul endroit
   ───────────────────────────────────────────────────────────────────
   Chaque module se contentait auparavant de dessiner son propre HUD.
   Résultat : trois barres différentes, trois façons d'afficher l'XP, et
   aucun moyen de voir où l'on en est dans le parcours.

   Ici la coque est unique et les modules n'en connaissent rien : ils
   déclarent leur identifiant, et poussent leurs indicateurs propres
   (heures restantes, alerte en cours) via Shell.status().

   La progression est également unifiée. Chaque module écrivait son XP
   dans sa propre clé de stockage ; désormais une seule clé fait foi, et
   les anciennes sont reprises au premier chargement pour ne rien perdre.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const KEY='regradar-academy-progress';

/* Le parcours. L'ordre est la pédagogie : on ne reconnaît pas un schéma
   qu'on n'a jamais produit, donc l'offensive précède la défensive. */
const MODULES=[
 {id:'laundromat', n:'Laundromat', no:'01', file:'laundromat.html',
  label:'Le blanchisseur', needs:0,
  tag:'Jouer l\u2019adversaire : treize typologies, huit juridictions.'},
 {id:'ownership',  n:'Détention', no:'02', file:'ownership.html',
  label:'Structures de détention', needs:0,
  tag:'Lire un organigramme et désigner les bénéficiaires effectifs.'},
 {id:'desk',       n:'Le bureau', no:'03', file:'desk.html',
  label:'Alertes et enquêtes', needs:0,
  tag:'Une journée : des alertes, et des heures qu\u2019on ne récupère pas.'},
 {id:'filing',     n:'Déclaration', no:'04', file:null,
  label:'Rédiger la déclaration', needs:2, tag:'En conception.'},
 {id:'inspection', n:'Inspection', no:'05', file:null,
  label:'Défendre ses décisions', needs:3, tag:'En conception.'},
];

const RANKS=[
 {xp:0,    n:'STAGIAIRE',  art:'·', blurb:'Un accès et une file d\u2019attente. Tout le reste se gagne.'},
 {xp:600,  n:'ANALYSTE I', art:'▹', blurb:'Tu distingues un achat immobilier documenté d\u2019un dépôt structuré. C\u2019est plus loin qu\u2019il n\u2019y paraît.'},
 {xp:1500, n:'ANALYSTE II',art:'▸', blurb:'Tu clôtures proprement et tu escalades délibérément. Les enquêteurs l\u2019ont remarqué.'},
 {xp:2800, n:'SENIOR',     art:'◆', blurb:'Tu lis la contrepartie avant le montant. C\u2019est ce qui sépare un analyste d\u2019un vide-alertes.'},
 {xp:4500, n:'RESPONSABLE',art:'◈', blurb:'Tu pourrais calibrer une équipe — le moment où ceci cesse d\u2019être une formation.'},
 {xp:6800, n:'MLRO',       art:'★', blurb:'Constant d\u2019une typologie à l\u2019autre, calibré, économe. Il n\u2019y a pas de meilleur score.'},
];

let P={xp:0, modules:{}, user:'analyste'};

function load(){
  try{ const p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p) P={...P,...p}; }catch(e){}
  /* Reprise des anciennes clés : la progression déjà acquise ne doit pas
     disparaître parce qu'on a réorganisé le stockage. */
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

/* ── construction de la coque ───────────────────────────────────── */
function build(active){
  const outer=document.createElement('div');
  outer.className='ac-outer';
  outer.innerHTML=`
    <div class="ac-brand">
      <span class="mk"><i>A</i>REGRADAR ACADEMY</span>
      <span class="sep"></span>
      <span class="sim">SIMULATEUR DE FORMATION AML</span>
      <span class="rr">
        <a href="academy.html">Parcours</a>
        <a href="index.html">← RegRadar</a>
      </span>
    </div>
    <div class="ac-machine">
      <div class="ac-title">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="ac-sys"><b>MERIDIAAN</b><span>POSTE CONFORMITÉ · v4.2</span></span>
        <span class="env"><i></i>ENVIRONNEMENT SIMULÉ<span> · DONNÉES FICTIVES</span></span>
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
               : !open ? `title="Requiert ${m.needs} module(s) entamé(s)"` : '';
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
    <span class="xp">${P.xp.toLocaleString('fr-BE')} XP</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="nxt">${nx? `${(nx.xp-P.xp).toLocaleString('fr-BE')} XP → ${esc(nx.n)}` : 'rang maximal'}</span>
    <span class="mod" id="acMod">${extra||''}</span>`;
}

/* ── API exposée aux modules ────────────────────────────────────── */
const Shell={
  /* Monte la coque et rend le contenu existant de la page dans l'écran. */
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
  /* Indicateurs propres au module, à droite de la barre d'état.
     Exemple : Shell.status([{k:'Heures',v:'4 h',s:'warn'}]) */
  status(items){
    const el=document.getElementById('acMod'); if(!el) return;
    el.innerHTML=(items||[]).map(i=>
      `<span><span class="k">${esc(i.k)}</span> <span class="v ${i.s||''}">${esc(i.v)}</span></span>`
    ).join('');
  },
  /* XP : un seul compteur pour tout le parcours. Retourne true si promotion. */
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
      <button onclick="AcademyShell.closeRank()">CONTINUER</button>`;
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
  reset(){ P={xp:0,modules:{},user:'analyste',migrated:true}; save(); location.reload(); },
};

window.AcademyShell=Shell;
})();
