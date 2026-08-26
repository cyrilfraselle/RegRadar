/* ═══════════════════════════════════════════════════════════════════
   ACADEMY ENGINE — shared module logic
   ───────────────────────────────────────────────────────────────────
   ownership.html and workstation.html's embedded ownership window used
   to carry two independent copies of the ownership-chart solver, the
   chart layout/renderer, and the submit/scoring logic. Same data, two
   implementations that could silently drift. This is the one copy;
   both pages call into it.

   Colors are read from CSS custom properties (--ink, --grid, --phos,
   --amber, --alarm, --ice, --violet, --console, --raised, --mono) —
   see academy-engine.css. ownership.html already defines these;
   workstation.html aliases its own palette onto the same names, so one
   chart implementation renders correctly in either skin.
   ═══════════════════════════════════════════════════════════════════ */
window.AcademyEngine = (function(){
'use strict';

const esc = s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ═══════════════════════════════════════════════════════════════════
   OWNERSHIP
   ═══════════════════════════════════════════════════════════════════ */
const Ownership = (function(){

  /* ── solver: multiply along paths, add across them, stop on loop,
        trustee ignored (legal title, no economic interest) ── */
  function solve(entities, edges, root){
    const persons=new Set(entities.filter(e=>e.type==='person').map(e=>e.id));
    const res={};
    (function walk(n,f,path){
      edges.forEach(e=>{
        if(e.to!==n || path.includes(e.from)) return;
        if(e.kind==='trustee') return;
        const nf=f*(e.pct/100);
        if(persons.has(e.from)){
          if(!res[e.from]) res[e.from]={pct:0,paths:[]};
          res[e.from].pct+=nf*100;
          res[e.from].paths.push({chain:[...path,e.from], pct:nf*100});
        } else walk(e.from,nf,[...path,e.from]);
      });
    })(root,1,[root]);
    return res;
  }

  /* ── chart layout: tiers by longest path from the target ── */
  function layout(entities, edges, root, W, H){
    const tier={}; tier[root]=0;
    (function walk(cur,d,path){
      edges.forEach(e=>{
        if(e.to!==cur || path.includes(e.from)) return;
        if(tier[e.from]===undefined || tier[e.from]<d+1) tier[e.from]=d+1;
        walk(e.from,d+1,[...path,e.from]);
      });
    })(root,0,[root]);
    entities.forEach(e=>{ if(tier[e.id]===undefined) tier[e.id]=1; });
    const maxT=Math.max(...Object.values(tier));
    const rows={};
    entities.forEach(e=>{ (rows[tier[e.id]]=rows[tier[e.id]]||[]).push(e); });
    const pos={};
    const top=44, bottom=H-44;
    for(let t=0;t<=maxT;t++){
      const r=rows[t]||[];
      const y = maxT===0? bottom : bottom-(bottom-top)*(t/maxT);
      const slot=W/(r.length+1);
      r.forEach((e,i)=>{ pos[e.id]={x:Math.round(slot*(i+1)), y:Math.round(y)}; });
    }
    return pos;
  }

  function drawChart(entities, edges, root, opts){
    opts=opts||{};
    const W=760;
    const depth=(()=>{const t={};t[root]=0;
      (function w(c,d,p){edges.forEach(e=>{if(e.to!==c||p.includes(e.from))return;
        t[e.from]=Math.max(t[e.from]||0,d+1);w(e.from,d+1,[...p,e.from])})})(root,0,[root]);
      return Math.max(1,...Object.values(t))})();
    const H=Math.max(210, 120+depth*95);
    const pos=layout(entities,edges,root,W,H);
    const NW=opts.small?110:132, NH=opts.small?34:40;

    let svg='';
    edges.forEach(e=>{
      const a=pos[e.from], b=pos[e.to]; if(!a||!b) return;
      const back = a.y>=b.y;                       // upward edge = loop
      const col = e.kind==='trustee'?'var(--ink-3)' : back?'var(--amber)':'var(--ink-3)';
      const dash = e.kind==='trustee'?'5 4' : back?'6 4':'';
      const off = back?46:0;
      const my=(a.y+b.y)/2;
      const d=`M${a.x},${a.y-NH/2} C${a.x+off},${my} ${b.x+off},${my} ${b.x},${b.y+NH/2}`;
      svg+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4"
              stroke-dasharray="${dash}" opacity=".65"/>`;
      const mx=(a.x+b.x)/2+off*.72;
      const lbl = e.kind==='trustee' ? 'trustee' : e.kind==='beneficiary' ? 'benef.' : e.pct+' %';
      svg+=`<g class="ae-edg" data-e="${esc(e.from)}>${esc(e.to)}" style="cursor:${e.doc?'pointer':'default'}">
        <rect x="${mx-26}" y="${my-9}" width="52" height="18" fill="var(--console)"
          stroke="${col}" stroke-width=".8" opacity=".95"/>
        <text x="${mx}" y="${my+4}" text-anchor="middle" font-family="var(--mono)"
          font-size="10" font-weight="700" fill="${col}">${lbl}</text></g>`;
    });

    entities.forEach(e=>{
      const p=pos[e.id]; if(!p) return;
      const isC=e.id===root, isP=e.type==='person';
      const dashed = e.type==='trust'||e.type==='nominee';
      const stroke = isC?'var(--alarm)' : isP?'var(--violet)' : dashed?'var(--amber)':'var(--ink-3)';
      const fill = isC?'var(--alarm)' : (opts.picked&&opts.picked.has(e.id))?'var(--violet)':'var(--console)';
      const txt = (isC||(opts.picked&&opts.picked.has(e.id)))?'var(--console)':'var(--ink)';
      const nm = e.name.length>17? e.name.slice(0,16)+'…' : e.name;
      svg+=`<g class="ae-nod" data-n="${esc(e.id)}" style="cursor:${isP?'pointer':'default'}">
        <rect x="${p.x-NW/2}" y="${p.y-NH/2}" width="${NW}" height="${NH}" fill="${fill}"
          stroke="${stroke}" stroke-width="${isP?2:1.3}" stroke-dasharray="${dashed?'4 3':''}"/>
        <text x="${p.x}" y="${p.y-2}" text-anchor="middle" font-family="var(--mono)"
          font-size="10.5" font-weight="700" fill="${txt}">${esc(nm)}</text>
        <text x="${p.x}" y="${p.y+11}" text-anchor="middle" font-family="var(--mono)"
          font-size="8" fill="${txt}" opacity=".7">${esc(e.juris)} · ${isP?'PERSON':e.type.toUpperCase()}</text>
      </g>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Ownership chart"><g class="ae-oz">${svg}</g></svg>`;
  }

  /* ── zoom/pan + node/edge click wiring for one chart instance.
        wrap: the element containing the <svg> (e.g. .ae-chart).
        opts: {onNodeClick(entityId), onEdgeClick(fromId,toId)} ── */
  function wireChart(wrap, opts){
    opts=opts||{};
    const svg=wrap.querySelector('svg'); if(!svg) return null;
    const oz=svg.querySelector('.ae-oz');
    let ZS=1,ZX=0,ZY=0;
    const az=()=>{ if(oz) oz.setAttribute('transform',`translate(${ZX},${ZY}) scale(${ZS})`); };
    svg.querySelectorAll('.ae-nod').forEach(el=>el.addEventListener('click',ev=>{
      ev.stopPropagation();
      if(opts.onNodeClick) opts.onNodeClick(el.dataset.n);
    }));
    svg.querySelectorAll('.ae-edg').forEach(el=>el.addEventListener('click',ev=>{
      ev.stopPropagation();
      const [f,t]=el.dataset.e.split('>');
      if(opts.onEdgeClick) opts.onEdgeClick(f,t);
    }));
    let drag=false,sx=0,sy=0;
    svg.addEventListener('mousedown',e=>{if(e.target.closest('.ae-nod,.ae-edg'))return;
      drag=true;sx=e.clientX-ZX;sy=e.clientY-ZY;svg.classList.add('ae-drag')});
    window.addEventListener('mouseup',()=>{drag=false;svg.classList.remove('ae-drag')});
    window.addEventListener('mousemove',e=>{if(!drag)return;ZX=e.clientX-sx;ZY=e.clientY-sy;az()});
    return {
      zoom(f){ ZS=Math.max(.5,Math.min(3,ZS*f)); az(); },
      reset(){ ZS=1;ZX=0;ZY=0;az(); },
    };
  }

  function chartTools(){
    return `<div class="ae-ctools">
      <button type="button" class="ae-ct-b" data-ae-zoom="1.2">+</button>
      <button type="button" class="ae-ct-b" data-ae-zoom=".85">−</button>
      <button type="button" class="ae-ct-b" data-ae-zoom="reset">⤾</button></div>`;
  }
  function wireChartTools(wrap, zoomCtl){
    if(!zoomCtl) return;
    wrap.querySelectorAll('[data-ae-zoom]').forEach(b=>b.addEventListener('click',()=>{
      const v=b.dataset.aeZoom;
      v==='reset' ? zoomCtl.reset() : zoomCtl.zoom(parseFloat(v));
    }));
  }
  function legend(){
    return `<div class="ae-legend">
      <span><i style="background:var(--alarm)"></i>Client</span>
      <span><i style="border:1.5px solid var(--violet)"></i>Natural person</span>
      <span><i style="border:1.5px dashed var(--amber)"></i>Trust / nominee</span>
      <span><i style="border-top:2px dashed var(--amber);width:16px;height:0"></i>Loop</span>
    </div>`;
  }

  /* ── case session state: hours budget, documents seen, requests spent ── */
  function openCase(caseObj){
    const gated=new Set((caseObj.requests||[]).map(r=>r.reveals).filter(Boolean));
    const seen=[];
    (caseObj.documents||[]).forEach(d=>{ if(!gated.has(d.id)) seen.push(d.id); });
    return {hours: caseObj.budget||0, seen, spent:[], picked:new Set(), nd:false};
  }

  /* mutates state; returns {ok, revealed, empty} */
  function request(caseObj, state, rid){
    const r=(caseObj.requests||[]).find(x=>x.id===rid);
    if(!r || state.spent.includes(rid) || state.hours<r.cost) return {ok:false};
    state.hours-=r.cost; state.spent.push(rid);
    if(r.reveals){ state.seen.push(r.reveals); return {ok:true, revealed:r.reveals}; }
    return {ok:true, revealed:null, empty:r.empty||'The search returns nothing.'};
  }

  function toggleOwner(state, id){ if(state.nd) return; state.picked.has(id)?state.picked.delete(id):state.picked.add(id); }
  function toggleND(state){ state.nd=!state.nd; if(state.nd) state.picked.clear(); }

  /* ── documents / requests markup — the panels workstation.html
        never had (see the roadmap's Chantier A audit) ── */
  function renderDocs(caseObj, state){
    const shown=(caseObj.documents||[]).filter(d=>state.seen.includes(d.id));
    const list = shown.map(d=>
      `<div class="ae-doc" id="ae-doc_${esc(d.id)}"><div class="ae-dn">${esc(d.name)}</div>
        <div class="ae-db">${esc(d.body)}</div></div>`).join('')
      || '<div class="ae-hint">No documents available yet.</div>';
    return `<div class="ae-blk"><div class="ae-bl"><span>DOCUMENTS ON FILE</span>
      <b>${shown.length} / ${(caseObj.documents||[]).length}</b></div>
      <div>${list}</div></div>`;
  }
  function renderRequests(caseObj, state){
    if(!(caseObj.requests||[]).length) return '';
    const list=caseObj.requests.map(r=>{
      const done=state.spent.includes(r.id);
      return `<button type="button" class="ae-req" ${done||state.hours<r.cost?'disabled':''} data-ae-req="${esc(r.id)}">
        <span class="ae-rc">${done?'✓':r.cost+' h'}</span>
        <span class="ae-rn">${esc(r.name)}</span></button>`;
    }).join('');
    return `<div class="ae-blk"><div class="ae-bl"><span>AVAILABLE REQUESTS</span>
      <b>${state.hours} h remaining</b></div><div>${list}</div></div>`;
  }
  function renderPicker(caseObj, state){
    const persons=caseObj.entities.filter(e=>e.type==='person');
    return `<div class="ae-pick">${persons.map(p=>
      `<button type="button" class="ae-pk ${state.picked.has(p.id)?'ae-on':''}" data-ae-pick="${esc(p.id)}">
        <span class="ae-box">${state.picked.has(p.id)?'✓':''}</span>
        <span class="ae-who">${esc(p.name)}</span>
        <span class="ae-juris">${esc(p.juris)}</span></button>`).join('')}</div>
      <button type="button" class="ae-nd ${state.nd?'ae-on':''}" data-ae-nd="1">
        <span class="ae-box">${state.nd?'✓':''}</span>
        <span>Cannot be determined</span></button>
      <button type="button" class="ae-submit" data-ae-submit="1" ${(!state.picked.size&&!state.nd)?'disabled':''}>
        SUBMIT FILE</button>
      <div class="ae-hint">Select the natural persons who cross the threshold, or who exercise control
        by other means. If the documents don't allow a conclusion, say so — that's a valid answer,
        and sometimes the only correct one.</div>`;
  }

  /* ── scoring: pure, no side effects ── */
  function computeVerdict(caseObj, state){
    const root=caseObj.entities.find(e=>e.customer).id;
    const threshold=caseObj.threshold||25;
    const res=solve(caseObj.entities, caseObj.edges, root);
    const expected=new Set(caseObj.answer.ubos);
    const picked=state.picked, nd=state.nd;
    const correct = caseObj.answer.cannot_determine
      ? (nd && !picked.size)
      : (!nd && picked.size===expected.size && [...picked].every(x=>expected.has(x)));
    const missed=[...expected].filter(x=>!picked.has(x));
    const extra=[...picked].filter(x=>!expected.has(x));
    const names={}; caseObj.entities.forEach(e=>names[e.id]=e.name);
    const lines=caseObj.entities.filter(e=>e.type==='person').map(e=>{
      const pct=(res[e.id]||{}).pct||0;
      const should=expected.has(e.id), did=picked.has(e.id);
      /* 'kind' is a neutral semantic key, not a CSS class name — the
         verdict view stays host-specific (see the ownership divergence
         notes), so each host maps this onto its own class names. */
      const kind = should&&did?'ok':should&&!did?'miss':!should&&did?'extra':'neutral';
      const verdict = should&&did?'CORRECT':should&&!did?'MISSED':!should&&did?'WRONGLY':'—';
      const ctrl = should && pct<threshold ? ' (control)' : '';
      return {id:e.id, name:names[e.id], pct, kind, verdict, ctrl};
    });
    const stamp = correct?'CORRECT':missed.length?'BENEFICIAL OWNER MISSED':'OVER-DESIGNATION';
    const title = caseObj.answer.cannot_determine && correct ? 'You recognised the gap'
      : correct ? 'Structure read correctly'
      : nd ? 'The file could be concluded'
      : missed.length ? `${missed.length} beneficial owner(s) not designated`
      : 'People designated incorrectly';
    return {caseId:caseObj.id, correct, missed, extra, lines, threshold, stamp, title,
      why:caseObj.why, trap:caseObj.trap, law:caseObj.law, lesson:caseObj.lesson};
  }

  /* ── the one place that touches AcademyShell for this module.
        Uses a host page's own awardSkillXP/markLawSeen/checkBadges
        globals when present (so its existing UI feedback — a toast,
        a popup — still fires exactly as it already does), and falls
        back to the raw Shell API otherwise. Called once per submit,
        by whichever host code runs the workbench. ── */
  function applyReward(caseObj, result){
    const KEY='regradar-ownership';
    let S={done:{}};
    try{ const p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p) S={...S,...p}; }catch(e){}
    S.done[caseObj.id]=result.correct?'right':'wrong';
    try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
    const ok=Object.values(S.done).filter(x=>x==='right').length;

    const out={ok, tierUps:[], badges:[]};
    if(typeof AcademyShell==='undefined') return out;

    AcademyShell.complete('ownership', ok);
    AcademyShell.award('ownership', result.correct?200:40);

    if(typeof window.awardSkillXP==='function'){
      window.awardSkillXP('ubo', result.correct?90:15);
      window.awardSkillXP('judgement', result.correct?25:8);
    } else {
      const t1=AcademyShell.awardSkill('ubo', result.correct?90:15);
      const t2=AcademyShell.awardSkill('judgement', result.correct?25:8);
      if(t1) out.tierUps.push({id:'ubo', ...t1});
      if(t2) out.tierUps.push({id:'judgement', ...t2});
    }
    if(caseObj.law){
      if(typeof window.markLawSeen==='function') window.markLawSeen(caseObj.law);
      else AcademyShell.markLawSeenFromText(caseObj.law);
    }
    if(typeof window.checkBadges==='function') window.checkBadges();
    else out.badges = AcademyShell.checkBadges()||[];

    return out;
  }

  /* ── sound effects (Web Audio); silent no-op if the host disables
        sound or the browser blocks autoplay contexts ── */
  let AC=null, SND=true;
  try{ SND=localStorage.getItem('regradar-snd')!=='off'; }catch(e){}
  function tone(f,d,t,g,dl){
    if(!SND) return;
    try{
      AC=AC||new (window.AudioContext||window.webkitAudioContext)();
      const s=AC.currentTime+(dl||0), o=AC.createOscillator(), v=AC.createGain();
      o.type=t||'sine'; o.frequency.setValueAtTime(f,s); v.gain.setValueAtTime(0,s);
      v.gain.linearRampToValueAtTime(g||.05,s+.012); v.gain.exponentialRampToValueAtTime(.0001,s+d);
      o.connect(v); v.connect(AC.destination); o.start(s); o.stop(s+d+.02);
    }catch(e){}
  }
  const sfx={
    good:()=>{tone(587,.13,'sine',.06);tone(880,.22,'sine',.05,.08)},
    bad:()=>{tone(150,.3,'square',.05);tone(100,.35,'square',.04,.06)},
    find:()=>{tone(660,.1,'sine',.05);tone(990,.15,'sine',.03,.07)},
    tick:()=>tone(880,.05,'square',.02),
  };

  return {
    solve, layout, drawChart, wireChart, chartTools, wireChartTools, legend,
    openCase, request, toggleOwner, toggleND,
    renderDocs, renderRequests, renderPicker,
    computeVerdict, applyReward, sfx,
  };
})();

return {esc, Ownership};
})();
