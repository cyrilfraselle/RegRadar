/* ═══════════════════════════════════════════════════════════════════
   ACADEMY HUB — the learning path, in one page
   ───────────────────────────────────────────────────────────────────
   #/            the path: next step, training status, time budget, modules
   #/m/<id>      one module (about 5 to 10 minutes):
                 Watch (animated explainer) -> Risks -> Check (questions)
                 -> Practise (simulation, optional) -> The law (verbatim)

   Data: data/academy/curriculum.json, explainers.json, module-map.json
   (Related obligations come from data/obligations.json). Law text is
   fetched from data/laws/ and every quote is re-checked against it in
   the browser. Progress: window.AcademyProgress (academy-engine.js) for
   completions, AcademyShell for XP, rank and skills. Device-local only.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var AP=window.AcademyProgress, SH=window.AcademyShell, EX=window.AcademyExplainer;
var APP=document.getElementById('app'), LIVE=document.getElementById('acLive');
var CUR=null, EXP={}, MAP={}, OBL={}, TR=[], BYID={}, LAWS={};
var STEPS=[{id:'watch',n:'Watch',req:true},{id:'risks',n:'Risks',req:true},{id:'check',n:'Check',req:true},
           {id:'practice',n:'Practise',req:false},{id:'law',n:'The law',req:true}];
var REQ_ORDER=['watch','risks','check','law'];
var QZ=null, curExplainer=null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function norm(s){ return String(s).replace(/ /g,' ').replace(/\s+/g,' ').trim(); }
function say(msg){ if(!LIVE) return; LIVE.textContent=''; setTimeout(function(){ LIVE.textContent=msg; },40); }
function lawUrl(c){ return 'law.html?celex='+encodeURIComponent(c.celex)+'&art='+encodeURIComponent(c.art); }
function citeText(c){ var n=(CUR_META.law_names||{})[c.celex]||c.celex; var short=n.split(' (')[0]; return short+' Art. '+c.art+(c.para?', para. '+c.para:''); }
var CUR_META={};
function steps(t){ return STEPS.filter(function(s){ return s.id!=='practice' || t.practice; }); }
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function mins(t,k){ return (t.minutes&&t.minutes[k])||0; }
function totalMin(t){ return REQ_ORDER.reduce(function(s,k){ return s+mins(t,k); },0); }

/* ── progress helpers ───────────────────────────────────────────── */
function practiceAuto(t){
  var p=t.practice; if(!p||!p.auto||!p.module||!SH) return false;
  return ((SH.progress.modules[p.module]||{}).done||0)>0;
}
function isDone(t,k){ return k==='practice'? (AP.stepDone(t.id,'practice')||practiceAuto(t)) : AP.stepDone(t.id,k); }
function isComplete(t){ return AP.isComplete(t.id); }
function reqDone(t){ return REQ_ORDER.filter(function(k){ return isDone(t,k); }).length; }
function unlocked(i){ return i===0 || isComplete(TR[i-1]); }
function nextStep(){
  for(var i=0;i<TR.length;i++){
    var t=TR[i]; if(isComplete(t)) continue;
    for(var j=0;j<REQ_ORDER.length;j++){ if(!isDone(t,REQ_ORDER[j])) return {t:t,i:i,step:REQ_ORDER[j]}; }
  }
  return null;
}
var STEP_VERB={watch:'Watch the explainer',risks:'Read the risks',check:'Answer the questions',practice:'Practise',law:'Read what the law says'};
function hrefFor(t,step){ return '#/m/'+t.id+(step?'/'+step:''); }
function plan(budget){
  var out=[], left=budget, stop=false;
  for(var i=0;i<TR.length && !stop;i++){
    var t=TR[i]; if(isComplete(t)) continue;
    for(var j=0;j<REQ_ORDER.length;j++){
      var k=REQ_ORDER[j]; if(isDone(t,k)) continue;
      var m=mins(t,k);
      if(m<=left){ out.push({t:t,step:k,m:m}); left-=m; } else { stop=true; break; }
    }
    if(!stop && t.practice && !isDone(t,'practice')){
      var pm=mins(t,'practice'); if(pm<=left){ out.push({t:t,step:'practice',m:pm}); left-=pm; }
    }
  }
  return out;
}

/* ── XP, skills ─────────────────────────────────────────────────── */
var XP_DEF={watch:20,risks:10,question_first_try:15,law:10};
function award(xp, what){
  if(!SH||!xp) return;
  var promoted=SH.award('learn', xp);
  if(promoted){ var r=SH.rank; say('Promoted to '+r.n); var b=document.getElementById('promo'); if(b){ b.hidden=false; b.textContent='Promotion: you are now '+r.n+'. '+r.blurb; } }
  else say('+'+xp+' XP'+(what?' for '+what:''));
}
function moduleCompleted(t){
  if(SH){ SH.complete('learn', TR.filter(isComplete).length); SH.awardSkill(t.skill, 40); }
}

/* ── routing ────────────────────────────────────────────────────── */
function route(){
  var h=location.hash.replace(/^#\/?/,''), p=h.split('/');
  if(p[0]==='m' && BYID[p[1]]) return {view:'module', t:BYID[p[1]], step:p[2]||null};
  return {view:'hub'};
}
function render(focusMain){
  if(curExplainer){ try{ curExplainer.destroy(); }catch(e){} curExplainer=null; }
  var r=route();
  if(r.view==='module') moduleView(r.t, r.step); else hubView();
  if(focusMain!==false){
    var h=APP.querySelector('h1'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:false}); }
    window.scrollTo(0,0);
  }
}

/* ═══ HUB ═══════════════════════════════════════════════════════════ */
function hubView(){
  document.title='RegRadar: Academy learning path';
  var n=nextStep(), doneN=TR.filter(isComplete).length, g=AP.get(), quizPct=quizAvg();
  var budget=AP.pref('budget',30);
  var html='';
  html+='<header class="head"><div><div class="kicker">REGRADAR ACADEMY</div><h1>Learn the rules, then practise them</h1>'
    +'<p>Nine short modules for new compliance analysts at payment, e-money and crypto firms. Each takes 5 to 10 minutes: an animated explainer, the risks, a few questions and the law text. Practice cases and CF Bank are fictional.</p></div></header>';
  html+='<div id="promo" class="banner" hidden></div>';

  /* next step */
  if(n){
    html+='<section class="card next" aria-labelledby="nxH"><div><div class="k">Your next step</div><h2 id="nxH">'+esc(STEP_VERB[n.step])+': '+esc(n.t.title)+'</h2>'
      +'<p>Module '+n.t.no+' of '+TR.length+', about '+mins(n.t,n.step)+' min'+(doneN? '' : '. Start here: no sign-up, saved on this device.')+'</p></div>'
      +'<a class="btn pri" href="'+hrefFor(n.t,n.step)+'">'+(reqDone(n.t)||doneN?'Continue':'Start')+' <span aria-hidden="true">→</span></a></section>';
  }else{
    html+='<section class="card next" aria-labelledby="nxH"><div><div class="k">Path complete</div><h2 id="nxH">All '+TR.length+' modules done</h2>'
      +'<p>Keep going in the practice rooms below, or export your completions.</p></div><a class="btn pri" href="#practice-rooms">Practice rooms</a></section>';
  }

  /* training status */
  html+='<section class="sec" aria-labelledby="stH"><h2 id="stH">Training status</h2><div class="kpis">'
    +'<div class="kpi"><div class="n">'+doneN+' <small>of '+TR.length+'</small></div><div class="l">Modules complete</div><div class="bar" aria-hidden="true"><i style="--p:'+(doneN/TR.length)+'"></i></div></div>'
    +'<div class="kpi"><div class="n">'+(quizPct==null?'n/a':quizPct+'%')+'</div><div class="l">Average best quiz score</div><div class="s">Pass mark: 75% (default)</div></div>'
    +'<div class="kpi"><div class="n" style="font-size:18px;line-height:1.3">'+(n? esc(n.t.title) : 'Done')+'</div><div class="l">Next module</div></div>'
    +'<div class="kpi"><div class="n" style="font-size:18px;line-height:1.3">'+(g.updated? esc(fmtDate(g.updated)) : 'Not started')+'</div><div class="l">Last activity</div></div>'
    +'</div></section>';

  /* path */
  html+='<section class="sec" aria-labelledby="pathH"><h2 id="pathH">The path</h2><ol class="path">'+TR.map(trackCard).join('')+'</ol>'
    +'<p class="fine" style="margin-top:10px">Modules unlock in order: finish one (watch, risks, a passed check and the law step) to open the next. Locked modules show what is coming.</p></section>';

  /* time budget */
  html+='<section class="sec" aria-labelledby="tbH"><h2 id="tbH">How much time do you have?</h2><div class="card"><p class="sub" style="margin-top:0">Pick a slot and get a session built from your next steps. Minute estimates are defaults.</p>'
    +'<div class="seg" role="group" aria-label="Time budget">'
    +[15,30,60].map(function(m){ return '<button type="button" data-act="budget" data-m="'+m+'" aria-pressed="'+(budget===m)+'">'+m+' min</button>'; }).join('')+'</div>'
    +budgetPlan(budget)+'</div></section>';

  /* training record */
  html+='<section class="sec" aria-labelledby="rcH"><h2 id="rcH">Training record</h2><div class="card"><p class="sub" style="margin-top:0">Your completions (module, date, score) are saved in this browser as training evidence: AMLR Article 12 asks firms to run ongoing training programmes. It is not an official certificate.</p>'
    +'<div class="tools"><button type="button" class="btn sm" data-act="csv">Export completions (CSV)</button>'
    +'<button type="button" class="btn sm" data-act="reset">Clear training records on this device</button></div></div></section>';

  /* rank + skills */
  var r=SH?SH.rank:null, nx=SH? SH.ranks.find(function(x){ return x.xp>SH.xp; }):null;
  html+='<section class="sec" aria-labelledby="rkH"><h2 id="rkH">Rank and skills</h2><div class="two"><div class="card">'
    +(SH? '<h2 style="font-size:20px">'+esc(r.n)+'</h2><p class="sub">'+SH.xp.toLocaleString('en-US')+' XP'+(nx? ' · '+(nx.xp-SH.xp).toLocaleString('en-US')+' XP to '+esc(nx.n) : ' · top rank')+'</p>'
      +'<ol class="ladder">'+SH.ranks.map(function(x){ return '<li'+(x.n===r.n?' class="here" aria-current="true"':'')+'><b>'+esc(x.n)+'</b> <span>from '+x.xp.toLocaleString('en-US')+' XP'+(x.n===r.n?' (you are here)':'')+'</span></li>'; }).join('')+'</ol>'
      +'<p class="fine" style="margin-top:10px">One rank across the learning path and the practice rooms. XP amounts and thresholds are defaults.</p>' : '')
    +'</div><div class="card"><h2 style="font-size:20px">Skills</h2><p class="sub">Earned by passing checks and by the actions you take in the simulations.</p><ul class="skills">'
    +(SH? SH.skills.map(function(s){ return '<li><b>'+esc(s.icon)+' '+esc(s.n)+'</b><span>'+esc(s.name)+'</span></li>'; }).join('') : '')+'</ul></div></div></section>';

  /* practice rooms */
  html+='<section class="sec" id="practice-rooms" aria-labelledby="prH"><h2 id="prH">Practice rooms</h2><div class="rooms">'
    +room('laundromat.html','The Laundromat','Play the launderer for a few rounds and learn the red flags from the other side.')
    +room('ownership.html','Ownership structures','Read charts and designate beneficial owners. Six cases.')
    +room('desk.html','The Desk','A journal of days: onboarding queues and alert triage against the clock.')
    +room('workstation.html','Analyst workstation','The full simulated desktop with inbox, browser and case files. Desktop only.')
    +room('glossary.html','Glossary','AML and KYC terms in plain English.')
    +'</div><p class="fine" style="margin-top:10px">The rooms are open any time. The modules above send you to the right one.</p></section>';

  html+='<section class="sec"><details class="more"><summary>What is not built yet</summary><div>Planned, not available: a hands-on STR drafting simulation, a supervisor-inspection simulation, and per-firm assignments. The modules here teach the concepts and point to the closest simulation that exists today.</div></details></section>';
  APP.innerHTML=html;
}
function room(href,t,d){ return '<a class="room" href="'+href+'"><b>'+esc(t)+'</b><span>'+esc(d)+'</span></a>'; }
function quizAvg(){
  var g=AP.get().modules, xs=[];
  Object.keys(g).forEach(function(id){ var c=g[id].steps&&g[id].steps.check; if(c&&c.passed&&c.max) xs.push(c.best/c.max); });
  if(!xs.length) return null;
  return Math.round(100*xs.reduce(function(a,b){return a+b;},0)/xs.length);
}
function budgetPlan(b){
  var p=plan(b);
  if(!p.length) return '<p class="fine" style="margin-top:12px">Nothing left to plan: every module is complete.</p>';
  var tot=p.reduce(function(s,x){ return s+x.m; },0);
  return '<p class="fine" style="margin-top:12px">Your '+b+'-minute session: '+p.length+' step'+(p.length>1?'s':'')+', about '+tot+' min.</p><ol class="plan">'
    +p.map(function(x){ return '<li><a href="'+hrefFor(x.t,x.step)+'"><span><b>'+esc(STEP_VERB[x.step])+'</b> <span class="w">'+esc(x.t.title)+'</span></span><span class="m">'+x.m+' min</span></a></li>'; }).join('')+'</ol>';
}
function trackCard(t,i){
  var done=isComplete(t), open=unlocked(i), n=nextStep(), isNext=n&&n.t===t;
  var cls=done?'st-done':isNext?'st-next':open?'st-open':'st-locked';
  var rd=reqDone(t);
  var dots='<span class="dots" aria-hidden="true">'+REQ_ORDER.map(function(k){ return '<i class="'+(isDone(t,k)?'on':'')+'"></i>'; }).join('')+(t.practice?'<i class="pr '+(isDone(t,'practice')?'on':'')+'"></i>':'')+'</span>';
  var status=done?'<span class="chip ok">Complete</span>':!open?'<span class="lock">Locked: finish module '+TR[i-1].no+' first</span>':'<span class="chip acc">'+rd+' of 4 steps</span>';
  var title=open? '<a href="'+hrefFor(t)+'">'+esc(t.title)+'</a>' : esc(t.title);
  var cta=open? '<a class="btn'+(isNext?' pri':'')+' sm" href="'+hrefFor(t)+'">'+(done?'Review':rd?'Continue':'Start')+'</a>' : '<a class="btn sm" href="'+hrefFor(t)+'">Preview</a>';
  return '<li class="trk '+cls+'"><div class="trk-no" aria-hidden="true">'+(done?'✓':t.no)+'</div><div><h3>'+title+'</h3><p>'+esc(t.short)+'</p>'
    +'<div class="trk-meta"><span class="chip">about '+totalMin(t)+' min</span>'+dots+status+'</div></div><div class="trk-cta">'+cta+'</div></li>';
}

/* ═══ MODULE ════════════════════════════════════════════════════════ */
function relatedHTML(t){
  var m=(MAP.modules||{})[t.id]||{}, ids=(m.obligations||[]).filter(function(id){ return OBL[id]; });
  if(!ids.length) return '<div class="rel"><span>No obligation in the Compliance register maps to this module yet'+(m.note?': '+esc(m.note.replace(/\.$/,'')):'')+'.</span></div>';
  return '<div class="rel"><span>Related obligations:</span>'+ids.map(function(id){ var o=OBL[id];
    return '<a href="workspace.html?open='+encodeURIComponent(id)+'" title="'+esc(o.what.slice(0,140))+'">'+esc(o.legal_basis)+'</a>'; }).join('')+'</div>'
    +(m.note?'<p class="fine" style="margin-top:6px">'+esc(m.note)+'</p>':'');
}
function moduleView(t, stepId){
  var i=TR.indexOf(t), open=unlocked(i), list=steps(t);
  document.title=t.title+' | RegRadar Academy';
  var n=nextStep();
  if(!stepId || !list.some(function(s){ return s.id===stepId; })){
    stepId = (n&&n.t===t)? n.step : 'watch';
  }
  var html='<a class="crumb" href="#/">← All modules</a>';
  html+='<header class="mhead"><div class="kicker">Module '+t.no+' of '+TR.length+'</div><h1>'+esc(t.title)+'</h1>'
    +'<div class="meta"><span class="chip">about '+totalMin(t)+' min</span>'+(isComplete(t)?'<span class="chip ok">Complete</span>':'<span class="chip acc">'+reqDone(t)+' of 4 steps</span>')+'<span class="chip">Fictional examples</span></div>'
    +relatedHTML(t)+'</header>';
  if(!open){
    html+='<section class="panel" aria-labelledby="lkH"><h2 id="lkH">This module unlocks after module '+TR[i-1].no+'</h2>'
      +'<p class="lede">Finish <b>'+esc(TR[i-1].title)+'</b> (watch, risks, a passed check and the law step) to open it. Here is what it covers.</p>'
      +'<ul class="learn">'+t.learn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
      +'<div class="foot-act"><a class="btn pri" href="'+hrefFor(TR[i-1])+'">Go to module '+TR[i-1].no+'</a><a class="btn" href="#/">Back to the path</a></div></section>';
    APP.innerHTML=html; return;
  }
  html+='<div id="promo" class="banner" hidden></div>';
  html+='<ol class="stepper" aria-label="Steps in this module">'+list.map(function(s,k){
    var d=isDone(t,s.id);
    return '<li><a href="'+hrefFor(t,s.id)+'"'+(s.id===stepId?' aria-current="step"':'')+'>'+(k+1)+'. '+s.n+(s.req?'':' (optional)')
      +(d?' <span class="tick" aria-hidden="true">✓</span><span class="sr"> done</span>':'')+'</a></li>'; }).join('')+'</ol>';
  html+='<section class="panel" id="panel" aria-labelledby="pnH">'+panel(t,stepId,list)+'</section>';
  APP.innerHTML=html;
  afterPanel(t,stepId);
}
function nextOf(t,stepId,list){ var k=list.findIndex(function(s){ return s.id===stepId; }); return list[k+1]||null; }
function footer(t,stepId,list,opts){
  opts=opts||{}; var nx=nextOf(t,stepId,list);
  var label=opts.label || (nx? 'Next: '+nx.n : 'Back to the path');
  return '<div class="foot-act"><span class="fine">'+(opts.note||'')+'</span><button type="button" class="btn pri" data-act="next" data-step="'+stepId+'"'+(opts.disabled?' disabled':'')+'>'+esc(label)+' <span aria-hidden="true">→</span></button></div>';
}
function panel(t,stepId,list){
  var f={watch:watchP,risks:risksP,check:checkP,practice:practiceP,law:lawP}[stepId];
  return f(t,list);
}

/* watch */
function watchP(t,list){
  var d=isDone(t,'watch');
  return '<h2 id="pnH">1. Watch: '+esc(t.title)+'</h2><p class="lede">About '+Math.round((EXP[t.explainer]&&EX? EX.duration(EXP[t.explainer]) : 75))+' seconds. Every step has a text caption, and the full text is under the player.</p>'
    +'<ul class="learn">'+t.learn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
    +'<div id="exHost" style="margin-top:14px"></div>'
    +'<div id="watchNote">'+(d?'<div class="callout ok">Watched. Next: the risks.</div>':'<div class="callout">Watch to the last step (or step through it) to tick this one off.</div>')+'</div>'
    +footer(t,'watch',list,{note:'Fictional examples. Law text is on the last step.'});
}
/* risks */
function risksP(t,list){
  var r=t.risks;
  var cons=r.consequences.map(function(c){ return '<li>'+esc(c.text)+(c.cite?' <a class="cite" href="'+lawUrl(c.cite)+'">'+esc(citeText(c.cite))+'</a>':'')+'</li>'; }).join('');
  return '<h2 id="pnH">2. Risks: what goes wrong</h2><p class="lede">Every control exists because something goes wrong without it. Read these before the questions.</p>'
    +'<div class="rgrid"><div class="rcol w"><h3>What goes wrong</h3><ul>'+r.wrong.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>'
    +'<div class="rcol c"><h3>Consequences</h3><ul>'+cons+'</ul></div>'
    +'<div class="rcol f"><h3>Red flags</h3><ul>'+r.redflags.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div></div>'
    +'<p class="fine" style="margin-top:10px">Red-flag lists are illustrative, not exhaustive. Items marked judgement are not legal statements. Legal consequences cite the text.</p>'
    +footer(t,'risks',list,{label:'Got it. Next: '+(nextOf(t,'risks',list)||{n:''}).n});
}
/* check */
function checkP(t,list){
  if(!QZ || QZ.id!==t.id) QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false,answers:[]};
  return '<h2 id="pnH">3. Check: '+t.questions.length+' questions</h2><p class="lede">Pass mark 3 of '+t.questions.length+' (default). Retry as often as you like. XP is awarded the first time you pass.</p><div id="quiz" style="margin-top:12px"></div>';
}
function drawQuiz(t){
  var host=document.getElementById('quiz'); if(!host) return;
  var q=t.questions[QZ.i], list=steps(t), N=t.questions.length;
  if(QZ.done){
    var passed=QZ.score>=Math.ceil(N*0.75), already=AP.stepDone(t.id,'check');
    host.innerHTML='<div class="card"><div class="qprog">RESULT</div><div class="score">'+QZ.score+' / '+N+'</div>'
      +'<p class="sub">'+(passed? 'Passed. This step is ticked off.' : 'Not passed yet: you need '+Math.ceil(N*0.75)+' of '+N+'. Re-read the risks or rewatch the explainer, then try again.')+'</p>'
      +'<div class="foot-act" style="border:0;padding-top:4px">'+(passed? '<span></span><button type="button" class="btn pri" data-act="next" data-step="check">Next: '+esc((nextOf(t,'check',list)||{n:'Done'}).n)+' <span aria-hidden="true">→</span></button>'
        : '<button type="button" class="btn" data-act="retry">Try again</button><a class="btn" href="'+hrefFor(t,'watch')+'">Rewatch</a>')+'</div></div>';
    return;
  }
  var multi=q.type==='multi';
  var opts=q.options.map(function(o,k){
    var chk=QZ.sel.indexOf(k)>=0, cls='opt', tag='';
    if(QZ.checked){ var isAns=multi? q.answer.indexOf(k)>=0 : q.answer===k; if(isAns) {cls+=' right'; tag='<span class="tag" style="color:var(--ok)">Correct</span>';} else if(chk){ cls+=' wrong'; tag='<span class="tag" style="color:var(--crit)">Not this one</span>'; } }
    return '<label class="'+cls+'"><input type="'+(multi?'checkbox':'radio')+'" name="qo" value="'+k+'"'+(chk?' checked':'')+(QZ.checked?' disabled':'')+'><span class="t">'+esc(o)+'</span>'+tag+'</label>';
  }).join('');
  var fb='';
  if(QZ.checked){
    var ok=QZ.lastOk;
    fb='<div class="fb '+(ok?'ok':'no')+'" role="status"><b class="h">'+(ok?'Correct.':'Not quite.')+'</b>'+esc(q.why)
      +(q.law?'<div class="src">Source: <a href="'+lawUrl(q.law)+'">'+esc(citeText(q.law))+'</a> in the law reader.</div>':'')+'</div>';
  }
  host.innerHTML='<div class="qprog">QUESTION '+(QZ.i+1)+' OF '+N+'</div><fieldset><legend id="qLeg" tabindex="-1">'+esc(q.q)+'</legend>'
    +(q.scenario?'<div class="scen">'+esc(q.scenario)+'</div>':'')
    +(multi?'<p class="fine">Select all that apply.</p>':'')+opts+'</fieldset>'+fb
    +'<div class="foot-act" style="border:0;padding-top:0"><span></span>'
    +(QZ.checked? '<button type="button" class="btn pri" data-act="qnext">'+(QZ.i>=N-1?'See result':'Next question')+' <span aria-hidden="true">→</span></button>'
      : '<button type="button" class="btn pri" data-act="qcheck"'+(QZ.sel.length?'':' disabled')+'>Check answer</button>')+'</div>';
}
function qCheck(t){
  var q=t.questions[QZ.i], ok;
  if(q.type==='multi'){ var a=q.answer.slice().sort().join(','), s=QZ.sel.slice().sort().join(','); ok=(a===s); }
  else ok=(QZ.sel.length===1 && QZ.sel[0]===q.answer);
  QZ.checked=true; QZ.lastOk=ok; if(ok) QZ.score++;
  drawQuiz(t); say(ok?'Correct.':'Not quite.');
  var fb=document.querySelector('#quiz .fb'); if(fb && fb.scrollIntoView) fb.scrollIntoView({block:'nearest'});
}
function qNext(t){
  if(QZ.i>=t.questions.length-1){
    QZ.done=true; var N=t.questions.length, passed=QZ.score>=Math.ceil(N*0.75);
    var r=AP.quiz(t.id, QZ.score, N, passed);
    if(r.firstPass){ award((CUR_META.defaults.xp.question_first_try||15)*QZ.score,'passing the check'); }
    if(r.completed) completedNow(t);
    drawQuiz(t); say('Result: '+QZ.score+' of '+N+(passed?', passed.':', not passed yet.'));
    var h=document.querySelector('#quiz .score'); if(h){ h.setAttribute('tabindex','-1'); h.focus(); }
    refreshStepper(t,'check');
    return;
  }
  QZ.i++; QZ.sel=[]; QZ.checked=false; drawQuiz(t);
  var l=document.getElementById('qLeg'); if(l) l.focus();
}
/* practise */
function practiceP(t,list){
  var p=t.practice, done=isDone(t,'practice');
  return '<h2 id="pnH">4. Practise (optional)</h2><p class="lede">Put it to work in a simulation. Not required to finish the module. All cases are fictional.</p>'
    +'<div class="card" style="margin-top:12px;background:var(--surface-2)"><h2 style="font-size:17px">'+esc(p.label)+'</h2><p class="sub">'+esc(p.why)+' About '+p.minutes+' min.</p>'
    +'<div class="tools"><a class="btn pri" href="'+esc(p.href)+'">Open the simulation</a>'
    +'<button type="button" class="btn" data-act="practised" aria-pressed="'+(done?'true':'false')+'">'+(done?'Marked as practised':'Mark as practised')+'</button></div>'
    +(p.auto&&done?'<p class="fine" style="margin-top:8px">Detected from your progress in the simulation.</p>':'')+'</div>'
    +footer(t,'practice',list);
}
/* law */
function lawP(t,list){
  var done=isDone(t,'law'), complete=isComplete(t), nxt=TR[TR.indexOf(t)+1];
  var h='<h2 id="pnH">'+(list.length)+'. The law: what it says</h2><p class="lede">Verbatim excerpts from the official text held in this repository (docs/data/laws/). Each is re-checked against that text when you open this page. Plain-language notes are marked.</p>';
  if(complete){ h+='<div class="callout ok"><b>Module complete.</b> '+(nxt?'Next module: <a href="'+hrefFor(nxt)+'">'+esc(nxt.title)+'</a>.':'You have finished the path.')+'</div>'; }
  h+=t.law.map(function(c,k){
    return '<div class="q" data-q="'+k+'"><div class="q-h"><b>'+esc((CUR_META.law_names||{})[c.celex]||c.celex)+', Article '+esc(c.art)+(c.para?', para. '+esc(c.para):'')+'</b><span>'+esc(c.label)+'</span></div>'
      +'<blockquote>'+esc(c.quote)+'</blockquote>'
      +'<div class="q-f"><span><span class="ver" data-ver>Checking against the source…</span>'+(c.note?' · Note: '+esc(c.note):'')+'</span><a href="'+lawUrl(c)+'">Read the full article</a></div></div>';
  }).join('');
  if(t.reading&&t.reading.length) h+='<details class="more"><summary>Further reading (not quoted here)</summary><div><ul style="margin-left:18px">'+t.reading.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>Read these at the source: RegRadar does not reproduce them.</div></details>';
  h+='<div class="callout warn">Prototype for training. Not legal advice. Check the current official text and your national transposition and supervisor guidance.</div>';
  var missing=REQ_ORDER.filter(function(k){ return k!=='law' && !isDone(t,k); });
  h+=footer(t,'law',list,{label: complete? 'Back to the path' : 'Finish module', note: (!complete&&missing.length)? 'Still to do: '+missing.map(function(k){return STEP_VERB[k].toLowerCase();}).join(', ')+'.' : ''});
  return h;
}
function lawVerify(t){
  var cel={}; t.law.forEach(function(c){ cel[c.celex]=1; });
  Object.keys(cel).forEach(function(c){
    if(LAWS[c]) return;
    LAWS[c]=fetch('data/laws/'+c+'_EN.json').then(function(r){ if(!r.ok) throw 0; return r.json(); }).catch(function(){ return null; });
  });
  t.law.forEach(function(c,k){
    LAWS[c.celex].then(function(law){
      var el=document.querySelector('.q[data-q="'+k+'"] [data-ver]'); if(!el) return;
      var ok=false;
      if(law){ var a=law.articles.filter(function(x){ return String(x.id)===String(c.art); })[0];
        if(a){ var txt=norm(a.text); ok=c.quote.split(' […] ').every(function(p){ return txt.indexOf(norm(p))>=0; }); } }
      el.textContent= law? (ok? 'Verified against the source text' : 'Could not verify this excerpt: use the link') : 'Source file not loaded: use the link';
      el.className='ver '+(ok?'ok':'no');
    });
  });
}
function afterPanel(t,stepId){
  if(stepId==='watch'){
    var host=document.getElementById('exHost'), spec=EXP[t.explainer];
    if(host && spec && EX){
      curExplainer=EX.mount(host, spec, {onComplete:function(){
        var r=AP.step(t.id,'watch'); if(r.first) award(XP_DEF.watch,'watching');
        var n=document.getElementById('watchNote'); if(n) n.innerHTML='<div class="callout ok">Watched. Next: the risks.</div>';
        if(r.completed) completedNow(t); refreshStepper(t,'watch');
      }});
    } else if(host) host.innerHTML='<p class="callout warn">The explainer could not be loaded.</p>';
  }
  if(stepId==='check') drawQuiz(t);
  if(stepId==='law') lawVerify(t);
}
function refreshStepper(t,cur){
  var list=steps(t), el=APP.querySelector('.stepper'); if(!el) return;
  el.innerHTML=list.map(function(s,k){ var d=isDone(t,s.id);
    return '<li><a href="'+hrefFor(t,s.id)+'"'+(s.id===cur?' aria-current="step"':'')+'>'+(k+1)+'. '+s.n+(s.req?'':' (optional)')+(d?' <span class="tick" aria-hidden="true">✓</span><span class="sr"> done</span>':'')+'</a></li>'; }).join('');
}
function completedNow(t){
  moduleCompleted(t); say('Module complete: '+t.title+'.');
}

/* ── clicks ─────────────────────────────────────────────────────── */
function csv(){
  var titles={}, order=TR.map(function(t){ titles[t.id]=t.title; return t.id; });
  var text=AP.toCSV(titles, order);
  var blob=new Blob([text],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a'), d=new Date().toISOString().slice(0,10);
  a.href=URL.createObjectURL(blob); a.download='regradar-academy-completions-'+d+'.csv';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
  say('Completions exported as CSV.');
}
APP.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b) return;
  var act=b.dataset.act, r=route(), t=r.t;
  if(act==='csv') return csv();
  if(act==='reset'){
    if(window.confirm('Clear all Academy training records (modules, scores) on this device? XP and rank are kept.')){ AP.reset(); render(false); say('Training records cleared.'); }
    return;
  }
  if(act==='budget'){ AP.setPref('budget',+b.dataset.m); render(false); var nb=APP.querySelector('[data-act="budget"][aria-pressed="true"]'); if(nb) nb.focus(); return; }
  if(!t) return;
  var list=steps(t);
  if(act==='qcheck') return qCheck(t);
  if(act==='qnext') return qNext(t);
  if(act==='retry'){ QZ=null; QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false}; drawQuiz(t); var l=document.getElementById('qLeg'); if(l) l.focus(); return; }
  if(act==='practised'){ var on=b.getAttribute('aria-pressed')!=='true'; if(on) AP.step(t.id,'practice',{manual:true}); else { /* un-marking is not supported: records are append-only */ } render(false); return; }
  if(act==='next'){
    var st=b.dataset.step;
    if(st==='risks'){ var rr=AP.step(t.id,'risks'); if(rr.first) award(XP_DEF.risks,'the risks step'); if(rr.completed) completedNow(t); }
    if(st==='law'){
      if(isComplete(t)){ location.hash='#/'; return; }
      var lr=AP.step(t.id,'law'); if(lr.first) award(XP_DEF.law,'the law step'); if(lr.completed) completedNow(t);
      render(false); var pn=document.getElementById('panel'); if(pn) { var hh=APP.querySelector('h1'); if(hh){ hh.setAttribute('tabindex','-1'); hh.focus(); } window.scrollTo(0,0);} return;
    }
    var nx=nextOf(t,st,list);
    location.hash= nx? hrefFor(t,nx.id) : '#/';
  }
});
APP.addEventListener('change',function(e){
  var inp=e.target.closest('input[name="qo"]'); if(!inp||!QZ) return;
  var t=route().t; if(!t) return;
  var v=+inp.value, q=t.questions[QZ.i];
  if(q.type==='multi'){ var k=QZ.sel.indexOf(v); if(inp.checked && k<0) QZ.sel.push(v); else if(!inp.checked && k>=0) QZ.sel.splice(k,1); }
  else QZ.sel=[v];
  var btn=document.querySelector('[data-act="qcheck"]'); if(btn) btn.disabled=!QZ.sel.length;
});
window.addEventListener('hashchange',function(){ render(true); });

/* ── boot ───────────────────────────────────────────────────────── */
function getJSON(u,opt){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(u+' '+r.status); return r.json(); }).catch(function(e){ if(opt) return null; throw e; }); }
Promise.all([getJSON('data/academy/curriculum.json'), getJSON('data/academy/explainers.json'), getJSON('data/academy/module-map.json',true), getJSON('data/obligations.json',true)])
.then(function(r){
  CUR=r[0]; CUR_META=CUR._meta; TR=CUR.tracks; TR.forEach(function(t){ BYID[t.id]=t; });
  (r[1].explainers||[]).forEach(function(e){ EXP[e.id]=e; });
  MAP=r[2]||{modules:{}}; ((r[3]&&r[3].obligations)||[]).forEach(function(o){ OBL[o.id]=o; });
  /* practice detection: only single-purpose simulations are detected automatically */
  TR.forEach(function(t){ if(t.practice && (t.practice.module==='laundromat'||t.practice.module==='ownership')) t.practice.auto=true; });
  render(false);
}).catch(function(e){
  APP.innerHTML='<header class="head"><div><div class="kicker">REGRADAR ACADEMY</div><h1>The learning path could not load</h1><p>Open this page from the RegRadar site (it reads small data files). The simulations still work: <a href="laundromat.html">Laundromat</a>, <a href="ownership.html">Ownership</a>, <a href="desk.html">The Desk</a>, <a href="workstation.html">Workstation</a>.</p></div></header>';
  if(window.console) console.warn('Academy hub: '+e.message);
});
})();
