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
        if(e.kind==='trustee' || e.kind==='settlor') return;
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
      const col = (e.kind==='trustee'||e.kind==='settlor')?'var(--ink-3)' : back?'var(--amber)':'var(--ink-3)';
      const dash = (e.kind==='trustee'||e.kind==='settlor')?'5 4' : back?'6 4':'';
      const off = back?46:0;
      const my=(a.y+b.y)/2;
      const d=`M${a.x},${a.y-NH/2} C${a.x+off},${my} ${b.x+off},${my} ${b.x},${b.y+NH/2}`;
      svg+=`<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4"
              stroke-dasharray="${dash}" opacity=".65"/>`;
      const mx=(a.x+b.x)/2+off*.72;
      const lbl = e.kind==='trustee' ? 'trustee' : e.kind==='settlor' ? 'settlor' : e.kind==='beneficiary' ? 'benef.' : e.pct+' %';
      svg+=`<g class="ae-edg" data-e="${esc(e.from)}>${esc(e.to)}" style="cursor:${e.doc?'pointer':'default'}">
        <rect x="${mx-31}" y="${my-10}" width="62" height="20" fill="var(--console)"
          stroke="${col}" stroke-width=".8" opacity=".95"/>
        <text x="${mx}" y="${my+4.5}" text-anchor="middle" font-family="var(--mono)"
          font-size="12" font-weight="700" fill="${col}">${lbl}</text></g>`;
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
        <text x="${p.x}" y="${p.y-3}" text-anchor="middle" font-family="var(--mono)"
          font-size="12" font-weight="700" fill="${txt}">${esc(nm)}</text>
        <text x="${p.x}" y="${p.y+12}" text-anchor="middle" font-family="var(--mono)"
          font-size="12" fill="${txt}" opacity=".9">${esc(e.juris)} · ${isP?'PERSON':e.type.toUpperCase()}</text>
      </g>`;
    });
    /* Text alternative: who is in the chart and who holds what in whom,
       so the structure is available without seeing the drawing. */
    const nameOf={}; entities.forEach(e=>nameOf[e.id]=e.name);
    const kindOf=e=>e.type==='person'?'person':e.type;
    const ents=entities.map(e=>`${e.name} (${kindOf(e)}${e.id===root?', the client':''}, ${e.juris})`).join('; ');
    const links=edges.map(e=>{
      const f=nameOf[e.from]||e.from, t=nameOf[e.to]||e.to;
      return e.kind==='trustee'? `${f} is trustee of ${t}`
        : e.kind==='settlor'? `${f} is settlor of ${t}`
        : e.kind==='beneficiary'? `${f} is beneficiary of ${t}`
        : `${f} holds ${e.pct} % of ${t}`;
    }).join('; ');
    const alt=`Ownership chart of ${nameOf[root]||'the client'}. ${entities.length} parties: ${ents}. `
      +`Links: ${links||'none'}.`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="${esc(alt)}" data-w="${W}" data-h="${H}"><g class="ae-oz">${svg}</g></svg>`;
  }

  /* ── zoom/pan + node/edge click wiring for one chart instance.
        wrap: the element containing the <svg> (e.g. .ae-chart).
        opts: {onNodeClick(entityId), onEdgeClick(fromId,toId), state}
        Pan/pinch use pointer events (mouse, touch and pen), the svg is
        touch-action:none so a drag pans instead of scrolling the page,
        and the keyboard works too (arrows pan, + / - zoom, 0 resets).
        On a narrow container the chart starts zoomed to ~1:1 so node text
        is readable, in a taller window, and can be panned. ── */
  function wireChart(wrap, opts){
    opts=opts||{};
    const svg=wrap.querySelector('svg'); if(!svg) return null;
    const oz=svg.querySelector('.ae-oz');
    const W=+svg.dataset.w||760, H=+svg.dataset.h||300;
    const cw=wrap.clientWidth||W;
    const narrow = cw>0 && cw<560;
    let VH=H, Z0=1, X0=0, Y0=0;
    if(narrow){
      Z0=Math.min(2.4, Math.max(1.2, W/cw));            /* ~1:1 pixels */
      const px=Math.min(Math.max(240, H*(cw/W)*Z0), Math.round(window.innerHeight*.6), 520);
      VH=W*px/cw;                                          /* taller window, same x-scale */
      svg.setAttribute('viewBox',`0 0 ${W} ${VH}`);
      svg.style.height=px+'px';
      X0=W/2*(1-Z0); Y0=VH/2-Z0*H/2;
    }
    let ZS=Z0, ZX=X0, ZY=Y0;
    const st=opts.state;                                    /* keep zoom across re-renders */
    if(st){ ZS=st.ZS; ZX=st.ZX; ZY=st.ZY; }
    const az=()=>{ if(oz) oz.setAttribute('transform',`translate(${ZX},${ZY}) scale(${ZS})`); };
    az();
    svg.querySelectorAll('.ae-nod').forEach(el=>el.addEventListener('click',ev=>{
      ev.stopPropagation();
      if(opts.onNodeClick) opts.onNodeClick(el.dataset.n);
    }));
    svg.querySelectorAll('.ae-edg').forEach(el=>el.addEventListener('click',ev=>{
      ev.stopPropagation();
      const [f,t]=el.dataset.e.split('>');
      if(opts.onEdgeClick) opts.onEdgeClick(f,t);
    }));

    /* pointer pan + pinch. 'k' converts screen px to svg user units. */
    const k=()=>{ const r=svg.getBoundingClientRect(); return (r.width? W/r.width : 1); };
    const ptrs=new Map(); let last=null, moved=false, pinch0=null;
    svg.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse' && e.button!==0) return;
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.size===1){ last={x:e.clientX,y:e.clientY}; moved=false; }
      if(ptrs.size===2){
        const [a,b]=[...ptrs.values()];
        pinch0={d:Math.hypot(a.x-b.x,a.y-b.y), z:ZS}; moved=true;
      }
    });
    svg.addEventListener('pointermove',e=>{
      const p=ptrs.get(e.pointerId); if(!p) return;
      p.x=e.clientX; p.y=e.clientY;
      if(ptrs.size===2 && pinch0){
        const [a,b]=[...ptrs.values()];
        const d=Math.hypot(a.x-b.x,a.y-b.y)||1;
        const nz=Math.max(.5,Math.min(4,pinch0.z*d/pinch0.d));
        const r=svg.getBoundingClientRect(), kk=k();
        const cx=((a.x+b.x)/2-r.left)*kk, cy=((a.y+b.y)/2-r.top)*kk;   /* zoom about the midpoint */
        ZX=cx-(cx-ZX)*(nz/ZS); ZY=cy-(cy-ZY)*(nz/ZS); ZS=nz; az();
        return;
      }
      if(ptrs.size===1 && last){
        const dx=e.clientX-last.x, dy=e.clientY-last.y;
        if(!moved && Math.hypot(dx,dy)<5) return;            /* a tap, not a drag */
        if(!moved){ moved=true; svg.classList.add('ae-drag'); try{ svg.setPointerCapture(e.pointerId); }catch(_){} }
        const kk=k(); ZX+=dx*kk; ZY+=dy*kk; last={x:e.clientX,y:e.clientY}; az();
      }
    });
    const end=e=>{
      ptrs.delete(e.pointerId);
      if(ptrs.size<2) pinch0=null;
      if(ptrs.size===0){ svg.classList.remove('ae-drag'); last=null; }
      else if(ptrs.size===1){ const p=[...ptrs.values()][0]; last={x:p.x,y:p.y}; }
    };
    svg.addEventListener('pointerup',end);
    svg.addEventListener('pointercancel',end);
    /* a drag must not also "click" the node it ended on */
    svg.addEventListener('click',ev=>{ if(moved){ ev.stopPropagation(); ev.preventDefault(); moved=false; } },true);

    /* keyboard: the chart is a pannable region */
    svg.setAttribute('tabindex','0');
    svg.addEventListener('keydown',e=>{
      const step=40;
      if(e.key==='ArrowLeft') ZX+=step; else if(e.key==='ArrowRight') ZX-=step;
      else if(e.key==='ArrowUp') ZY+=step; else if(e.key==='ArrowDown') ZY-=step;
      else if(e.key==='+'||e.key==='=') ZS=Math.min(4,ZS*1.2);
      else if(e.key==='-'||e.key==='_') ZS=Math.max(.5,ZS/1.2);
      else if(e.key==='0'){ ZS=Z0; ZX=X0; ZY=Y0; }
      else return;
      e.preventDefault(); az();
    });
    return {
      zoom(f){ ZS=Math.max(.5,Math.min(4,ZS*f)); az(); },
      reset(){ ZS=Z0; ZX=X0; ZY=Y0; az(); },
      state(){ return {ZS,ZX,ZY}; },
    };
  }

  function chartTools(){
    return `<div class="ae-ctools" role="group" aria-label="Chart zoom and pan">
      <span class="ae-ch">Drag to pan · pinch or use the buttons to zoom</span>
      <button type="button" class="ae-ct-b" data-ae-zoom="1.2" aria-label="Zoom in" title="Zoom in"><span aria-hidden="true">+</span></button>
      <button type="button" class="ae-ct-b" data-ae-zoom=".85" aria-label="Zoom out" title="Zoom out"><span aria-hidden="true">−</span></button>
      <button type="button" class="ae-ct-b" data-ae-zoom="reset" aria-label="Reset zoom and position" title="Reset view"><span aria-hidden="true">⤾</span></button></div>`;
  }
  function wireChartTools(wrap, zoomCtl){
    if(!zoomCtl) return;
    wrap.querySelectorAll('[data-ae-zoom]').forEach(b=>b.addEventListener('click',()=>{
      const v=b.dataset.aeZoom;
      v==='reset' ? zoomCtl.reset() : zoomCtl.zoom(parseFloat(v));
    }));
  }
  function legend(){
    return `<div class="ae-legend" aria-label="Chart legend" role="group">
      <span><i aria-hidden="true" style="background:var(--alarm)"></i>Client</span>
      <span><i aria-hidden="true" style="border:1.5px solid var(--violet)"></i>Natural person</span>
      <span><i aria-hidden="true" style="border:1.5px dashed var(--amber)"></i>Trust / nominee</span>
      <span><i aria-hidden="true" style="border-top:2px dashed var(--amber);width:16px;height:0"></i>Loop (ownership that circles back)</span>
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
        <span class="ae-rc">${done?'✓ done':r.cost+' h'}</span>
        <span class="ae-rn">${esc(r.name)}</span></button>`;
    }).join('');
    return `<div class="ae-blk"><div class="ae-bl"><span>AVAILABLE REQUESTS</span>
      <b>${state.hours} h remaining</b></div><div>${list}</div></div>`;
  }
  function renderPicker(caseObj, state){
    const persons=caseObj.entities.filter(e=>e.type==='person');
    return `<div class="ae-pick">${persons.map(p=>
      `<button type="button" class="ae-pk ${state.picked.has(p.id)?'ae-on':''}" data-ae-pick="${esc(p.id)}"
        aria-pressed="${state.picked.has(p.id)?'true':'false'}"${state.nd?' aria-disabled="true"':''}>
        <span class="ae-box" aria-hidden="true">${state.picked.has(p.id)?'✓':''}</span>
        <span class="ae-who">${esc(p.name)}</span>
        <span class="ae-juris">${esc(p.juris)}</span></button>`).join('')}</div>
      <button type="button" class="ae-nd ${state.nd?'ae-on':''}" data-ae-nd="1" aria-pressed="${state.nd?'true':'false'}">
        <span class="ae-box" aria-hidden="true">${state.nd?'✓':''}</span>
        <span>Cannot be determined</span></button>
      <button type="button" class="ae-submit" data-ae-submit="1" ${(!state.picked.size&&!state.nd)?'disabled':''}>
        SUBMIT FILE</button>
      <div class="ae-hint" id="ae-pickhint">Select the natural persons who cross the threshold, or who exercise control
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
      const role = caseObj.roles && caseObj.roles[e.id];
      const ctrl = role ? ` (${role})` : should && pct<threshold ? ' (control)' : '';
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

/* ═══════════════════════════════════════════════════════════════════
   LAUNDROMAT
   ───────────────────────────────────────────────────────────────────
   The play-the-adversary engine (pure — deterministic PRNG, no DOM)
   was already framework-agnostic and identical between laundromat.html
   and workstation.html's embedded LM, just reformatted. One copy here.

   Reward wiring (skill XP, badges, law-seen, the win-rate stats badge
   conditions read) previously existed ONLY in workstation.html's LB —
   laundromat.html called AcademyShell.complete/award and nothing else,
   so playing the standalone page earned XP but no skill points, no
   badges, and never fed the stats two badges depend on. onCatch/
   onFinish fix that for both, using the same host-global-detection
   pattern as Ownership.applyReward.
   ═══════════════════════════════════════════════════════════════════ */
const Laundromat = (function(){
  const TOTAL = 10000000, MAX_WEEKS = 104, MAX_CATCHES = 3, HEAT_FATAL = 100;

  const JURISDICTIONS = [
   {id:'be', n:'Belgium',      risk:0.06, scrutiny:0.90, note:'Home turf. Nothing rings country-risk alarms — but the net here is competent.'},
   {id:'lu', n:'Luxembourg',   risk:0.10, scrutiny:0.85, note:'Dense financial centre, comfortable with holding structures. Watched accordingly.'},
   {id:'ch', n:'Switzerland',  risk:0.14, scrutiny:0.80, note:'Discretion by tradition, cooperation by treaty. Old reputation, modern reporting.'},
   {id:'hk', n:'Hong Kong',    risk:0.22, scrutiny:0.62, note:'Trade hub. Paper moves as fast as money — invoices are hard to verify at volume.'},
   {id:'ee', n:'Estonia',      risk:0.20, scrutiny:0.58, note:'Digital-first banking and a crypto-licensing past it is still living down.'},
   {id:'ae', n:'UAE',          risk:0.34, scrutiny:0.45, note:'Gold, property, free zones. Recently delisted, still on every screening matrix.'},
   {id:'pa', n:'Panama',       risk:0.44, scrutiny:0.35, note:'Corporate services on demand. Any EU counterparty applies enhanced diligence — Art. 34.'},
   {id:'ky', n:'Cayman Is.',   risk:0.38, scrutiny:0.40, note:'Zero-tax vehicles. The structure is legal; the questions about it are mandatory.'},
  ];

  const TYPOLOGIES = [
   {id:'structuring', stage:'placement', n:'Structured deposits', cap:2000000, fee:0.02, base:0.0153, amp:0.9, weeks:2,
    juris:['be','lu','ch','ee'], d:'Teams of runners deposit cash below the identification threshold, many branches, many days.',
    flag:'Structuring below the threshold', art:'Art. 19 & 26', artTitle:'Application of CDD / Ongoing monitoring',
    detects:'Thresholds are not a blind spot — linked transactions are aggregated. A pattern of deposits sitting just under the limit is itself the alarm, and Art. 26 obliges the bank to monitor for exactly that.'},
   {id:'front', stage:'placement', n:'Cash-intensive front', cap:2500000, fee:0.06, base:0.0136, amp:0.7, weeks:2,
    juris:['be','lu','ae','hk'], d:'A launderette, a car wash, a restaurant. Dirty cash rides in on top of real takings.',
    flag:'Turnover inconsistent with business profile', art:'Art. 25 & 26', artTitle:'Purpose and nature of the relationship / Ongoing monitoring',
    detects:'At onboarding the bank recorded what a business of this size and sector should turn over. Art. 26 obliges it to keep comparing. A café banking like a supermarket is a one-line query.'},
   {id:'casino', stage:'placement', n:'Casino chips', cap:1000000, fee:0.08, base:0.0153, amp:1.0, weeks:1,
    juris:['be','ae','hk','ky'], d:'Buy chips in cash, play the minimum, cash out as documented winnings.',
    flag:'Minimal play against high buy-in', art:'Art. 3 & 19', artTitle:'Obliged entities / Application of CDD',
    detects:'Casinos are obliged entities under Art. 3 — the cage applies CDD on collection of winnings. Buy-in with no gambling pattern behind the cash-out is a standing red flag in every casino AML programme.'},
   {id:'smuggle', stage:'placement', n:'Bulk cash movement', cap:4000000, fee:0.09, base:0.0213, amp:1.45, weeks:2,
    juris:['ae','pa','ky','hk'], d:'Vacuum-packed notes in freight or luggage, placed with a bank where questions are softer.',
    flag:'Undeclared cash at the border', art:'Reg. (EU) 2018/1672', artTitle:'Cash entering or leaving the Union',
    detects:'€10,000 or more in cash crossing the EU border must be declared — controls run both directions, and detection dogs do not read declarations. Seizure first, explanation later.'},
   {id:'tbml', stage:'layering', n:'Trade over-invoicing', cap:3500000, fee:0.07, base:0.0170, amp:0.8, weeks:2,
    juris:['hk','ae','pa','ee'], d:'Goods ship at one value, invoices say another. The difference crosses the border as trade.',
    flag:'Invoice value far from market price', art:'Art. 25 & 26', artTitle:'Purpose and nature / Ongoing monitoring',
    detects:'Trade finance desks screen unit prices against market ranges. A container of phone cases invoiced like a container of phones is the oldest pattern in the TBML typology library.'},
   {id:'shells', stage:'layering', n:'Shell company loop', cap:4000000, fee:0.05, base:0.0153, amp:0.85, weeks:2,
    juris:['pa','ky','lu','ch'], d:'Funds tour a ring of companies that exist as filing-cabinet folders, then come home as "intercompany".',
    flag:'No identifiable beneficial owner behind the chain', art:'Art. 51 & 52', artTitle:'Identification of beneficial owners',
    detects:'Every EU counterparty must resolve the chain to a natural person — ownership through layers is computed through the layers, per Art. 52. A loop that resolves to nobody is not private, it is reportable.'},
   {id:'mules', stage:'layering', n:'Money mule network', cap:1800000, fee:0.12, base:0.0195, amp:1.05, weeks:1,
    juris:['be','ee','hk'], d:'Dozens of recruited accounts each pass a small slice along, fast.',
    flag:'Fan-out / fan-in velocity pattern', art:'Art. 26 & 69', artTitle:'Monitoring of transactions / Reporting of suspicions',
    detects:'Mule patterns are the best-trained detection models in retail banking: new accounts, immediate onward transfers, shared devices. One mule flagged unravels the network — and Art. 69 puts the report on the FIU\'s desk the same week.'},
   {id:'crypto', stage:'layering', n:'Crypto chain-hop', cap:2500000, fee:0.06, base:0.0170, amp:0.95, weeks:1,
    juris:['ee','ch','hk','ae'], d:'Fiat in at an exchange, hop across chains and mixers, fiat out at another.',
    flag:'Mixer exposure on chain analytics', art:'Art. 40', artTitle:'Transactions with self-hosted addresses',
    detects:'CASPs are obliged entities; Art. 40 imposes specific measures on self-hosted address flows. Chain analytics tag mixer contact permanently — the blockchain forgets nothing, which is the opposite of what you needed.'},
   {id:'loanback', stage:'layering', n:'Loan-back scheme', cap:3000000, fee:0.05, base:0.0145, amp:0.7, weeks:3,
    juris:['lu','ch','pa','ky'], d:'Your offshore company "lends" you your own money. Repayments even make it look responsible.',
    flag:'Loan with no commercial logic', art:'Art. 25 & 53', artTitle:'Purpose and nature / Beneficial ownership through control',
    detects:'A loan needs a lender with an origin of funds and a reason to lend. When the borrower controls the lender — Art. 53 control test — the "loan" is a mirror, and mirrors get questions.'},
   {id:'invoices', stage:'layering', n:'Phantom services', cap:2200000, fee:0.08, base:0.0153, amp:0.8, weeks:2,
    juris:['be','lu','hk','pa'], d:'Consulting, marketing, "management fees" — invoices for work nobody can point to.',
    flag:'Services with no observable delivery', art:'Art. 26 & 69', artTitle:'Ongoing monitoring / Reporting of suspicions',
    detects:'Service invoices leave no customs trail, which auditors know as well as you do. Round amounts, generic descriptions, counterparties two weeks old — the monitoring rule for this is standard-issue.'},
   {id:'realestate', stage:'integration', n:'Real estate', cap:5000000, fee:0.10, base:0.0153, amp:0.85, weeks:3,
    juris:['be','ae','pa','ky'], d:'Property bought through a company, rented out. Clean rent, appreciating asset.',
    flag:'Opaque buyer behind a property vehicle', art:'Art. 3 & 20', artTitle:'Obliged entities / Customer due diligence',
    detects:'Estate agents and notaries are obliged entities under Art. 3 — the deed does not pass without CDD on the buyer and the buyer behind the buyer. Property is where laundering is looked for first.'},
   {id:'luxury', stage:'integration', n:'Luxury assets', cap:1800000, fee:0.13, base:0.0170, amp:0.9, weeks:1,
    juris:['ae','ch','hk'], d:'Art, watches, cars. Portable value with an auction receipt.',
    flag:'High-value goods bought against no known income', art:'Art. 74 & 80', artTitle:'Threshold-based reports on high-value goods / Cash limits',
    detects:'Dealers in high-value goods file threshold-based reports under Art. 74, and Art. 80 caps what cash can buy at €10,000. The receipt you wanted as cover is itself a report.'},
   {id:'business', stage:'integration', n:'Business acquisition', cap:4500000, fee:0.08, base:0.0136, amp:0.75, weeks:4,
    juris:['be','lu','ee','hk'], d:'Buy a real company, run it, pay yourself dividends. The slowest and the cleanest.',
    flag:'Acquisition funds from an unverifiable origin', art:'Art. 20 & 51', artTitle:'Customer due diligence / Beneficial owners',
    detects:'The seller\'s bank, the notary and the target\'s bank each run CDD on where the purchase price originates. Source-of-funds is the question the whole scheme exists to avoid — asked three times.'},
  ];

  const SIZES = [
   {id:'small',  n:'Discreet', f:0.35},
   {id:'medium', n:'Standard', f:0.65},
   {id:'large',  n:'Aggressive', f:1.00},
  ];

  const SRC = {placement:'dirty', layering:'placed', integration:'layered'};
  const DST = {placement:'placed', layering:'layered', integration:'clean'};

  function newGame(seed){
    return {seed: seed>>>0 || 1, week:1, heat:0, catches:0,
      pools:{dirty:TOTAL, placed:0, layered:0, clean:0, frozen:0},
      fees:0, useCount:{}, jUse:{}, recent:[], log:[], over:false, verdict:null};
  }
  /* deterministic PRNG (mulberry32) */
  function rng(S){ S.seed|=0; S.seed=S.seed+0x6D2B79F5|0;
    let t=Math.imul(S.seed^S.seed>>>15,1|S.seed);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }
  function velocity(S){ const w=S.week; return S.recent.filter(x=>w-x<5).length; }
  function opRisk(S,t,j,sizeF,amount){
    const amt=amount/t.cap;
    let p=t.base + t.amp*0.20*amt*amt*amt + j.risk*0.15*(0.3+amt) + j.scrutiny*0.010
      + Math.pow(S.heat/100,2.2)*0.20 + Math.max(0,velocity(S)-1)*0.10
      + Math.max(0,(S.useCount[t.id]||0)-1)*0.030 + Math.max(0,(S.jUse[j.id]||0)-2)*0.018;
    return Math.min(0.92,p);
  }
  function footprint(t,j,amount){ const a=amount/t.cap; return 0.9+3.0*Math.pow(a,1.6)+j.risk*2.5; }
  function doOp(S,tid,jid,sizeId){
    const t=TYPOLOGIES.find(x=>x.id===tid), j=JURISDICTIONS.find(x=>x.id===jid), size=SIZES.find(x=>x.id===sizeId);
    if(!t||!j||!size||S.over) return null;
    if(!t.juris.includes(j.id)) return null;
    const src=SRC[t.stage];
    const amount=Math.min(S.pools[src], Math.round(t.cap*size.f));
    if(amount<25000) return null;
    const p=opRisk(S,t,j,size.f,amount);
    const roll=rng(S);
    S.week+=t.weeks; S.recent.push(S.week);
    S.useCount[t.id]=(S.useCount[t.id]||0)+1; S.jUse[j.id]=(S.jUse[j.id]||0)+1;
    let ev;
    if(roll<p){
      S.pools[src]-=amount; S.pools.frozen+=amount; S.catches+=1;
      S.heat=Math.min(100,S.heat+15+j.risk*10);
      ev={kind:'caught',week:S.week,t,j,amount,p};
    } else {
      const fee=Math.round(amount*t.fee);
      S.pools[src]-=amount; S.pools[DST[t.stage]]+=amount-fee; S.fees+=fee;
      S.heat=Math.min(100,S.heat+footprint(t,j,amount));
      ev={kind:'ok',week:S.week,t,j,amount,fee,p};
    }
    S.log.push(ev); endCheck(S); return ev;
  }
  function layLow(S,weeks){ if(S.over) return null; S.week+=weeks;
    const ev={kind:'wait',week:S.week,weeks}; S.log.push(ev); endCheck(S); return ev; }
  function walkAway(S){ if(S.over) return; S.over=true; S.verdict='walked'; }
  function endCheck(S){
    if(S.catches>=MAX_CATCHES){ S.over=true; S.verdict='investigation'; return; }
    if(S.heat>=HEAT_FATAL){ S.over=true; S.verdict='heat'; return; }
    if(S.week>MAX_WEEKS){ S.over=true; S.verdict='time'; return; }
    const movable=S.pools.dirty+S.pools.placed+S.pools.layered;
    if(movable<25000){ S.over=true; S.verdict='done'; }
  }
  function score(S){ return S.pools.clean/TOTAL*100; }

  /* ── per-catch reward: law-seen, risk skill XP, the catch counter
        the red-flag badge reads. Deferred to a host page's own
        awardSkillXP/markLawSeen/checkBadges globals when present. ── */
  function onCatch(ev){
    let st={catches:0};
    try{ st=JSON.parse(localStorage.getItem('regradar-lb-stats')||'null')||{catches:0}; }catch(e){}
    st.catches=(st.catches||0)+1;
    try{ localStorage.setItem('regradar-lb-stats', JSON.stringify(st)); }catch(e){}

    const out={badges:[]};
    if(typeof AcademyShell==='undefined') return out;
    if(typeof window.markLawSeen==='function') window.markLawSeen('Art. '+ev.t.art);
    else AcademyShell.markLawSeenFromText('Art. '+ev.t.art);
    if(typeof window.awardSkillXP==='function') window.awardSkillXP('risk', 8);
    else AcademyShell.awardSkill('risk', 8);
    if(typeof window.checkBadges==='function') window.checkBadges();
    else out.badges = AcademyShell.checkBadges()||[];
    return out;
  }

  /* ── end-of-run reward: best/runs bookkeeping (regradar-academy),
        the clean-run counter, XP, skill XP and badges. ── */
  function onFinish(S){
    const sc=score(S);
    const KEY='regradar-academy';
    let st={};
    try{ st=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){}
    const prev=(st.laundromat&&st.laundromat.best)||0;
    st.laundromat={best:Math.max(prev,sc), last:sc, runs:((st.laundromat&&st.laundromat.runs)||0)+1,
      verdict:S.verdict, at:Date.now()};
    try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){}

    const caught=S.log.filter(e=>e.kind==='caught');
    if(!caught.length){
      let lst={catches:0,cleanRuns:0};
      try{ lst=JSON.parse(localStorage.getItem('regradar-lb-stats')||'null')||lst; }catch(e){}
      lst.cleanRuns=(lst.cleanRuns||0)+1;
      try{ localStorage.setItem('regradar-lb-stats', JSON.stringify(lst)); }catch(e){}
    }

    const out={score:sc, best:st.laundromat.best, badges:[]};
    if(typeof AcademyShell==='undefined') return out;
    AcademyShell.complete('laundromat', 1);
    AcademyShell.award('laundromat', 100+Math.round(sc*2));
    if(typeof window.awardSkillXP==='function'){
      window.awardSkillXP('judgement', 20+Math.round(sc/4));
      window.awardSkillXP('risk', 15+Math.round(sc/6));
    } else {
      AcademyShell.awardSkill('judgement', 20+Math.round(sc/4));
      AcademyShell.awardSkill('risk', 15+Math.round(sc/6));
    }
    if(typeof window.checkBadges==='function') window.checkBadges();
    else out.badges = AcademyShell.checkBadges()||[];
    return out;
  }

  return {TOTAL, MAX_WEEKS, MAX_CATCHES, HEAT_FATAL, JURISDICTIONS, TYPOLOGIES, SIZES, SRC, DST,
    newGame, rng, velocity, opRisk, doOp, layLow, walkAway, score, onCatch, onFinish};
})();


/* ═══════════════════════════════════════════════════════════════════
   THE DESK — the model, once
   ───────────────────────────────────────────────────────────────────
   desk.html and the Desk window inside workstation.html used to carry two
   copies of the same rules: the days, how alerts are drawn, what an
   investigation costs, the verdicts and XP, the end-of-day summary. They
   had drifted (only one awarded skill XP, only one wrote the event log).
   This is the single copy. The pages keep their own screens and call:

     const D = AcademyEngine.Desk;  D.load();  D.S            state (same object always)
     D.startAlerts(BOOK, day, tutorial)  -> RUN        D.startOnboard(ONB, day) -> RUN
     D.spend(RUN, actionId)  -> {ok, action, ev}       D.askNadia(RUN)  -> {ok, line, count}
     D.decideAlert(RUN, choice, hooks)   -> result     D.decideOnboard(RUN, choice, hooks) -> result
     D.closeDay(RUN, hooks)              -> summary    D.briefing(day) -> copy for the day's start screen

   hooks (all optional; default = the AcademyShell API):
     {award(xp), skill(id, xp), lawSeen(text), badges() -> [newly earned]}
   A host passes its own hooks when it wants a toast or a refreshed panel.
   Storage keys are unchanged: 'regradar-desk', 'regradar-events', 'regradar-desk-stats'.
   ═══════════════════════════════════════════════════════════════════ */
const Desk = (function(){
  const KEY='regradar-desk', EVKEY='regradar-events', STATKEY='regradar-desk-stats';
  const DAYS=[
    {d:1, type:'tutorial', label:'Day 1', name:'Induction', blurb:'Nadia walks you through the desk. Two alerts, nothing at stake.'},
    {d:2, type:'onboard', label:'Day 2', name:'The onboarding queue', n:2, blurb:'Four applications. Decide how much diligence each one deserves.'},
    {d:3, type:'desk', label:'Day 3', name:'First real shift', n:4, hours:6, blurb:'Four alerts. Six hours. Close what you can, investigate what you must.'},
    {d:5, type:'onboard', label:'Day 5', name:'Harder applications', n:2, hard:true, blurb:'Files where nothing is wrong and nothing is proven.'},
    {d:8, type:'desk', label:'Day 8', name:'A busier queue', n:5, hours:7, blurb:'Five alerts, seven hours. The maths gets tighter.'},
    {d:14,type:'desk', label:'Day 14', name:'Second week', n:5, hours:6, blurb:'Five alerts, six hours. Something you saw before comes back.'},
    {d:21,type:'desk', label:'Day 21', name:'Month end', n:6, hours:7, blurb:'Six alerts. The queue does not care that it is month end.'},
  ];
  const S={day:0, done:[], harm:[], seen:{}, tutorialDone:false};   /* one object, never reassigned */

  function load(){ try{ const p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p) Object.assign(S,p); }catch(e){} return S; }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
  function logEvent(e){
    try{ const a=JSON.parse(localStorage.getItem(EVKEY)||'[]'); a.push(e); localStorage.setItem(EVKEY, JSON.stringify(a.slice(-2000))); }catch(x){}
  }
  const dayOf=n=>DAYS.find(x=>x.d===n);
  const nextDay=()=>DAYS.find(d=>!S.done.includes(d.d));

  const shell=()=>window.AcademyShell;
  const defaultHooks={
    award(xp){ const sh=shell(); if(sh && xp) sh.award('desk', xp); },
    skill(id,xp){ const sh=shell(); if(sh && xp) sh.awardSkill(id, xp); },
    lawSeen(t){ const sh=shell(); if(sh && t) sh.markLawSeenFromText(t); },
    badges(){ const sh=shell(); return sh? (sh.checkBadges()||[]) : []; },
  };
  const H=h=>({...defaultHooks, ...(h||{})});

  /* ── alerts ── */
  function pickAlerts(BOOK, n, tutorial){
    const seen=new Set(Object.keys(S.seen));
    const pool=BOOK.slice();
    if(tutorial){
      /* induction: one obviously benign, one obviously not */
      const benign=pool.find(c=>!c.is_real_case&&c.depth==='shallow');
      const real=pool.find(c=>c.is_real_case&&c.depth==='shallow');
      return [benign,real].filter(Boolean);
    }
    /* about a third review, rest fresh — and never the same case twice in a day */
    const fresh=pool.filter(c=>!seen.has(c.id)).sort(()=>Math.random()-0.5);
    const old=pool.filter(c=>seen.has(c.id)).sort(()=>Math.random()-0.5);
    const wantOld=Math.min(old.length, Math.round(n*0.34));
    const out=[...old.slice(0,wantOld), ...fresh.slice(0,n-wantOld)];
    while(out.length<n && pool.length){ const extra=pool.find(c=>!out.includes(c)); if(!extra) break; out.push(extra); }
    return out.slice(0,n).sort(()=>Math.random()-0.5);
  }
  function startAlerts(BOOK, d, tutorial){
    const alerts=pickAlerts(BOOK, tutorial?2:d.n, tutorial);
    return {type:'desk', d, tutorial, alerts, i:0, hours:tutorial?4:d.hours, budget:tutorial?4:d.hours,
            results:[], opened:false, spent:[], gathered:[], nadia:0};
  }
  function startOnboard(ONB, d){
    const pool=ONB.slice().sort((a,b)=>a.difficulty-b.difficulty);
    const set=d.hard? pool.slice(2) : pool.slice(0,2);
    return {type:'onboard', d, cases:set, i:0, hours:null, results:[]};
  }
  /* buy one line of enquiry: costs hours, may reveal evidence */
  function spend(RUN, aid){
    const c=RUN.alerts[RUN.i], a=(c.actions||[]).find(x=>x.id===aid);
    if(!a || RUN.spent.includes(aid) || RUN.hours<a.cost) return {ok:false};
    RUN.hours-=a.cost; RUN.spent.push(aid);
    const ev=c.evidence[a.reveals]||null;
    if(ev) RUN.gathered.push(a.reveals);
    return {ok:true, action:a, ev};
  }
  /* Nadia asks the question you have not asked yourself. One hour each, twice at most. */
  function askNadia(RUN){
    const c=RUN.alerts[RUN.i];
    if(RUN.hours<1 || RUN.nadia>=2) return {ok:false};
    RUN.hours-=1; RUN.nadia++;
    const found=new Set(RUN.gathered);
    const missing=(c.decisive||[]).filter(k=>!found.has(k));
    let line;
    if(RUN.nadia===1){
      line='"What would have to be true for this to be completely innocent? Work that out, then go and look for it. If it is not there, you have your answer."';
    }else if(missing.length){
      const act=c.actions.find(a=>a.reveals===missing[0]);
      const what=act?act.name.replace(/^(Pull|Obtain|Request|Review|Check|Look for|Examine|Map|Establish|Compare|Re-run|Screen|Cross-reference|Open|Call|Ask|Interview|Aggregate)\s+/i,''):'the part that matters';
      line=`"Everything you have shown me is consistent with itself. That is not the same as being true. Have you looked at ${what.toLowerCase()}?"`;
    }else{
      line='"You have what you need. Say it in two sentences: what is the suspicion, and which fact supports it. If you cannot, you are not done thinking."';
    }
    return {ok:true, line, count:RUN.nadia};
  }
  function bumpSarStat(){
    let st={sar:0}; try{ st=JSON.parse(localStorage.getItem(STATKEY)||'null')||st; }catch(e){}
    st.sar=(st.sar||0)+1;
    try{ localStorage.setItem(STATKEY, JSON.stringify(st)); }catch(e){}
  }
  function decideAlert(RUN, choice, hooks){
    const h=H(hooks), c=RUN.alerts[RUN.i];
    const deep=(c.actions||[]).length>0, found=new Set(RUN.gathered), decisive=c.decisive||[];
    const foundAll=decisive.length? decisive.every(k=>found.has(k)) : true;
    const foundN=decisive.filter(k=>found.has(k)).length;
    let verdict;
    if(choice===c.best_action) verdict=foundAll?'right':'thin';
    else if((choice==='escalate'||choice==='sar') && c.is_real_case) verdict='part';
    else if(choice==='rfi' && c.best_action!=='close') verdict='part';
    else verdict=c.is_real_case?'harm':'wrong';
    let xp=verdict==='right'?260 : verdict==='thin'?110 : verdict==='part'?120 : verdict==='wrong'?30 : 0;
    if(verdict==='right' && deep && RUN.hours>=2) xp+=60;
    if(RUN.tutorial) xp=0;
    S.seen[c.id]=verdict; save();
    if(xp) h.award(xp);
    logEvent({module:'desk', case:c.id, family:c.family, decision:choice, correct:verdict,
              evidence:RUN.gathered.length, hours:RUN.budget-RUN.hours, at:new Date().toISOString()});
    let badges=[];
    if(xp>0){
      h.skill('tm', Math.round(xp/6));
      h.skill('judgement', Math.round(xp/8));
      if(choice==='escalate'||choice==='sar') h.skill('str', Math.round(xp/3));
      if(choice==='sar') bumpSarStat();
      h.lawSeen(c.law);
      badges=h.badges()||[];
    }
    RUN.results.push({c, choice, verdict, xp, foundN, decisiveTotal:decisive.length});
    /* a harmful call is scheduled to resurface on a later day */
    if(verdict==='harm' && !RUN.tutorial){
      const later=DAYS.find(d=>d.d>S.day && !S.done.includes(d.d));
      if(later) S.harm.push({surfaceOn:later.d, caseId:c.id, headline:`Follow-up: ${c.title}`,
        body:c.epilogue_wrong || `The file you closed on day ${S.day} has come back. Compliance has asked why the alert was dismissed without the question being put.`});
      save();
    }
    return {c, choice, verdict, xp, foundN, decisive, deep, badges};
  }
  function decideOnboard(RUN, choice, hooks){
    const h=H(hooks), c=RUN.cases[RUN.i];
    const right=choice===c.decision;
    const verdict=right?'right':(choice==='edd'&&c.decision==='standard')?'part':'wrong';
    const xp=right?220:verdict==='part'?70:20;
    S.seen[c.id]=verdict; save();
    if(xp) h.award(xp);
    h.skill('kyc', Math.round(xp/3));
    h.lawSeen(c.law);
    logEvent({module:'onboard', case:c.id, family:c.family, decision:choice, correct:verdict, at:new Date().toISOString()});
    const badges=h.badges()||[];
    RUN.results.push({c, choice, verdict, xp});
    return {c, choice, verdict, xp, right, badges};
  }
  /* End of day: records it, completes the module for the shell, returns what to show. */
  function closeDay(RUN, hooks){
    const h=H(hooks), d=RUN.d, res=RUN.results;
    const good=res.filter(r=>r.verdict==='right').length;
    const harm=res.filter(r=>r.verdict==='harm').length;
    const xp=res.reduce((s,r)=>s+r.xp,0);
    const hoursUsed=RUN.budget!=null?(RUN.budget-RUN.hours):null;
    if(!S.done.includes(d.d)) S.done.push(d.d);
    const sh=shell(); if(sh) sh.complete('desk', S.done.length);
    S.seen['day'+d.d]=harm?'HARM':good===res.length?'CLEAN':'MIXED';
    if(RUN.tutorial) S.tutorialDone=true;
    save();
    const badges=h.badges()||[];
    const title=RUN.tutorial?'Induction over.' : harm?`${harm} of them will come back.` : good===res.length?'A clean day.' : 'Worked, with gaps.';
    const body=RUN.tutorial
      ? 'Nothing you did today counted. From tomorrow it does — and Nadia will get steadily less forthcoming as you rank up, which is the intention.'
      : harm
      ? 'A file closed wrongly does not disappear. It sits there until something forces it back into view, and by then the question is not what you decided but why nobody asked.'
      : hoursUsed!=null
      ? `You spent ${hoursUsed} of ${RUN.budget} hours. The ones you closed on the file are what paid for the ones you could open.`
      : 'Profiles set. Every alert these customers generate from now on is measured against what you decided today.';
    return {d, good, harm, xp, hoursUsed, budget:RUN.budget, tutorial:!!RUN.tutorial, title, body, nextD:nextDay(), badges};
  }
  /* Copy for the screen that opens a day. Hosts decide the markup. */
  function briefing(d){
    if(d.type==='tutorial') return {title:'First morning.', go:'Sit down',
      paras:['Nadia has the desk next to yours and eleven years on you. She is going to sit with you through two alerts, and she will interrupt.','Nothing counts today. That is the only day of which that will be true.'], rules:null};
    if(d.type==='onboard') return {title:'The onboarding queue.', go:'Open the queue',
      paras:['Applications waiting for a decision. For each one you decide how much diligence is proportionate — and set the profile of activity you would expect to see.','That profile is not paperwork. It is the baseline every future alert on this customer gets measured against. Set it carelessly and you generate noise for a decade.'],
      rules:{head:'What you are deciding', items:[['1','Standard','proportionate measures, ordinary risk.'],['2','Enhanced','where the law or the risk requires more.'],['3','Ask first','a fact is missing that decides the answer.'],['4','Decline','the relationship cannot be established.']]}};
    return {title:`${d.n} alerts. ${d.hours} hours.`, go:'Clock in',
      paras:[`Most of these you will resolve on the file in front of you, and that costs nothing. Some you cannot resolve without looking further — and looking further costs hours out of the same ${d.hours}.`,'There is not enough time to investigate everything. That is not a flaw in the day. It is the day.'],
      rules:{head:'How the hours work', items:[['·','Closing on the file','costs nothing. Do it confidently where the file supports it.'],['·','Opening an investigation','spends hours on each line of enquiry you buy.'],['·','Run out','and you decide the remaining alerts blind.']]}};
  }
  return {KEY, DAYS, S, load, save, logEvent, dayOf, nextDay, pickAlerts, startAlerts, startOnboard, spend, askNadia,
          decideAlert, decideOnboard, closeDay, briefing};
})();

return {esc, Ownership, Laundromat, Desk};
})();


/* ═══════════════════════════════════════════════════════════════════
   ACADEMY PROGRESS — training completion, in one clean shape
   ───────────────────────────────────────────────────────────────────
   One localStorage key holds what a learner has done in the learning
   path (docs/academy.html), as plain records that other RegRadar pages
   can read as TRAINING EVIDENCE (AMLR Art. 12 asks for ongoing training
   programmes). The Compliance workspace can call:

     AcademyProgress.get()
       -> { version, updated,
            completions:[{module, completedAt, score, max, steps}],  // modules fully done
            modules:{ <id>:{steps:{watch,risks,check,law,practice}, completed} } }

   Stored under 'regradar-academy-training':
     { v:1, updated:ISO, prefs:{budget:30}, modules:{
         'cdd-kyc':{ steps:{ watch:{at}, risks:{at}, check:{at,score,max,best,tries,passed},
                             law:{at}, practice:{at,auto} },
                     completed:{ at:ISO, score:3, max:4 } } } }

   A module is complete when watch, risks, a passed check and law are
   done. Practice (the simulations) is optional. The game XP/rank lives
   separately in AcademyShell ('regradar-academy-progress'); nothing in
   that key changes. Everything stays on this device.
   ═══════════════════════════════════════════════════════════════════ */
window.AcademyProgress = (function(){
'use strict';
const KEY='regradar-academy-training';
const REQUIRED=['watch','risks','check','law'];
let S=null;

function blank(){ return {v:1, updated:null, prefs:{}, modules:{}}; }
function load(){
  if(S) return S;
  S=blank();
  try{
    const p=JSON.parse(localStorage.getItem(KEY)||'null');
    if(p && p.v===1 && p.modules && typeof p.modules==='object'){ S={...S,...p, prefs:p.prefs||{}}; }
  }catch(e){}
  return S;
}
function save(){
  S.updated=new Date().toISOString();
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
}
function mod(id){ load(); return S.modules[id]||(S.modules[id]={steps:{}}); }
function isComplete(id){ load(); return !!(S.modules[id] && S.modules[id].completed); }
function maybeComplete(id){
  const m=mod(id);
  if(m.completed) return false;
  if(!REQUIRED.every(k=>m.steps[k] && (k!=='check' || m.steps.check.passed))) return false;
  const c=m.steps.check;
  m.completed={at:new Date().toISOString(), score:c.best, max:c.max};
  return true;
}
/* Mark a step done. Returns {first:boolean, completed:boolean}: first =
   this step was not recorded before; completed = this call finished the module. */
function step(id, name, data){
  const m=mod(id), first=!m.steps[name];
  if(first || name==='check') m.steps[name]={...(m.steps[name]||{}), ...(data||{}), at:new Date().toISOString()};
  const completed=maybeComplete(id);
  save();
  return {first, completed};
}
/* Record one quiz attempt. Keeps the best score and the number of tries. */
function quiz(id, score, max, passed){
  const m=mod(id), prev=m.steps.check||{};
  const best=Math.max(prev.best||0, score);
  const wasPassed=!!prev.passed;
  m.steps.check={at:new Date().toISOString(), score, max, best, tries:(prev.tries||0)+1, passed:wasPassed||!!passed};
  const completed=maybeComplete(id);
  if(m.completed && best>(m.completed.score||0)) m.completed.score=best;
  save();
  return {firstPass:!wasPassed && !!passed, completed};
}
function get(){
  load();
  const completions=Object.keys(S.modules).filter(id=>S.modules[id].completed).map(id=>{
    const m=S.modules[id];
    return {module:id, completedAt:m.completed.at, score:m.completed.score, max:m.completed.max,
            steps:Object.keys(m.steps)};
  }).sort((a,b)=>a.completedAt<b.completedAt?-1:1);
  return JSON.parse(JSON.stringify({version:1, updated:S.updated, completions, modules:S.modules}));
}
function stepDone(id, name){ load(); const m=S.modules[id]; return !!(m && m.steps[name] && (name!=='check' || m.steps.check.passed)); }
function pref(k,def){ load(); return k in S.prefs? S.prefs[k] : def; }
function setPref(k,v){ load(); S.prefs[k]=v; save(); }
function csvCell(v){ v=v==null?'':String(v); return /[",\n]/.test(v)? '"'+v.replace(/"/g,'""')+'"' : v; }
/* titles: {moduleId: title}. One row per module in `order` (or per recorded module). */
function toCSV(titles, order){
  load(); titles=titles||{};
  const ids=order&&order.length? order : Object.keys(S.modules);
  const head=['module_id','module_title','status','completed_on','quiz_best_score','quiz_max_score','quiz_attempts','steps_done','programme'];
  const rows=ids.map(id=>{
    const m=S.modules[id]||{steps:{}}, c=m.steps.check||{};
    const done=Object.keys(m.steps).filter(k=>k!=='check'||c.passed);
    return [id, titles[id]||id, m.completed?'complete':done.length?'in progress':'not started',
      m.completed? m.completed.at.slice(0,10):'', c.best==null?'':c.best, c.max==null?'':c.max, c.tries||'',
      done.join('|'), 'RegRadar Academy (fictional cases; not an official certificate)'];
  });
  return [head].concat(rows).map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
function reset(){ S=blank(); save(); }
return {KEY, REQUIRED, get, step, quiz, isComplete, stepDone, pref, setPref, toCSV, reset};
})();
