/* ═══════════════════════════════════════════════════════════════════
   ACADEMY HUB — one learning path, in one page
   ───────────────────────────────────────────────────────────────────
   #/            the path: one row (lessons + Shifts), one big Next button,
                 time picker, then rank, skills and practice rooms
   #/m/<id>[/b]  one lesson in five beats (about 8 to 10 minutes):
                 Watch (explainer + risks) -> Spot it (micro-game) ->
                 Decide (one scenario) -> Check (questions) -> Read the law
                 Spot it / Decide only appear where rounds.json has them.
   #/shift/<n>   a Shift: a Desk or Workstation session after every third lesson
   #/warmup      two minutes replaying what you missed before

   Data: data/academy/curriculum.json, explainers.json, rounds.json,
   module-map.json (+ data/obligations.json). Law quotes are re-checked
   against data/laws/ in the browser. Progress: window.AcademyProgress
   (academy-engine.js, key 'regradar-academy-training'); missed cards and
   questions: AcademyRounds.misses (key 'regradar-academy-misses'); XP,
   rank and skills: AcademyShell. Device-local only.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var AP=window.AcademyProgress, SH=window.AcademyShell, EX=window.AcademyExplainer, RD=window.AcademyRounds;
var MS=RD? RD.misses : {add:function(){},clear:function(){},list:function(){return [];},count:function(){return 0;}};
var APP=document.getElementById('app'), LIVE=document.getElementById('acLive');
var CUR=null, EXP={}, MAP={}, OBL={}, TR=[], BYID={}, LAWS={};
var GAMES={}, GBYID={}, DEC={}, SHIFTS=[], TUT={}, RMETA={}, LABELS={};
var BEATS=[{id:'watch',n:'Watch'},{id:'spot',n:'Spot it'},{id:'decide',n:'Decide'},{id:'check',n:'Check'},{id:'law',n:'Read the law'}];
var QZ=null, curExplainer=null, curRound=null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function norm(s){ return String(s).replace(/ /g,' ').replace(/\s+/g,' ').trim(); }
function say(msg){ if(!LIVE) return; LIVE.textContent=''; setTimeout(function(){ LIVE.textContent=msg; },40); }
function lawUrl(c){ return 'law.html?celex='+encodeURIComponent(c.celex)+'&art='+encodeURIComponent(c.art); }
function citeText(c){ var n=(CUR_META.law_names||{})[c.celex]||c.celex; var short=n.split(' (')[0]; return short+' Art. '+c.art+(c.para?', para. '+c.para:''); }
var CUR_META={};
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function mins(t,k){ return (t.minutes&&t.minutes[k])||0; }
function label(t){ return LABELS[t.id]||t.title; }
function sget(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function sset(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }

/* ── beats and progress ─────────────────────────────────────────── */
function beats(t){ return BEATS.filter(function(b){ return b.id==='spot'? !!GAMES[t.id] : b.id==='decide'? !!DEC[t.id] : true; }); }
function beatName(id){ return (BEATS.filter(function(b){ return b.id===id; })[0]||{n:id}).n; }
function beatDone(t,b){ return b==='watch'? (AP.stepDone(t.id,'watch') && AP.stepDone(t.id,'risks')) : AP.stepDone(t.id,b); }
function beatMin(t,b){
  if(b==='watch') return mins(t,'watch')+mins(t,'risks');
  if(b==='spot') return (GAMES[t.id]&&GAMES[t.id].minutes)||2;
  if(b==='decide') return 1;
  return mins(t,b);
}
function lessonMin(t){ return beats(t).reduce(function(s,b){ return s+beatMin(t,b.id); },0); }
function beatsDone(t){ return beats(t).filter(function(b){ return beatDone(t,b.id); }).length; }
function isComplete(t){ return AP.isComplete(t.id); }
function unlocked(i){ return i===0 || isComplete(TR[i-1]); }
function practiceAuto(t){
  var p=t.practice; if(!p||!p.auto||!p.module||!SH) return false;
  return ((SH.progress.modules[p.module]||{}).done||0)>0;
}
function nextStep(){
  for(var i=0;i<TR.length;i++){
    var t=TR[i]; if(isComplete(t)) continue;
    var bs=beats(t);
    for(var j=0;j<bs.length;j++){ if(!beatDone(t,bs[j].id)) return {t:t,i:i,step:bs[j].id}; }
    return {t:t,i:i,step:'law'};
  }
  return null;
}
function hrefFor(t,step){ return '#/m/'+t.id+(step?'/'+step:''); }
var STEP_VERB={watch:'Watch',spot:'Spot it',decide:'Decide',check:'Check',law:'Read the law'};

/* Shifts: one after every third lesson, in curriculum order */
function shiftAfter(s){ return TR[s.no*3-1]; }
function deskDays(){ try{ var D=window.AcademyEngine&&window.AcademyEngine.Desk; if(D){ D.load(); return (D.S.done||[]).length; } }catch(e){} return 0; }
function shiftDone(s){ var m=AP.pref('shifts',{})||{}; return !!m[s.no] || deskDays()>=s.desk_days; }
function shiftOpen(s){ var t=shiftAfter(s); return !!t && isComplete(t); }
function dueShift(){ for(var k=0;k<SHIFTS.length;k++){ var s=SHIFTS[k]; if(shiftOpen(s) && !shiftDone(s)) return s; } return null; }
function isPhone(){ try{ return window.matchMedia('(max-width: 899px)').matches; }catch(e){ return false; } }

/* warm-up: missed cards and questions, about two minutes */
var WARM_MAX=6;
function missCard(m){
  var p=m.id.split(':');
  if(p[0]==='card'){
    var g=GBYID[p[1]]; if(!g) return null;
    var c=(g.cards||[]).filter(function(x){ return x.id===p[2]; })[0]; if(!c) return null;
    var o={}; Object.keys(c).forEach(function(k){ o[k]=c[k]; });
    o.type=g.type; if(g.choices) o.choices=g.choices; o._miss=m.id;
    o.kicker=(LABELS[g.module]||g.module)+' · '+g.title;
    return o;
  }
  if(p[0]==='q'){
    var t=BYID[p[1]], q=t&&t.questions[+p[2]]; if(!q) return null;
    var opts=q.options.map(function(x,k){ return {id:String(k), label:x}; });
    if(q.type==='multi') return {id:m.id, type:'pick', title:q.q, text:(q.scenario||'')+' Select all that apply.', opts:opts, answer:q.answer.map(String), why:q.why, cite:q.law||null, _miss:m.id};
    return {id:m.id, type:'q', kicker:'From the check · '+label(t), title:q.q, text:q.scenario||'', choices:opts, answer:String(q.answer), why:q.why, cite:q.law||null, _miss:m.id};
  }
  if(p[0]==='dec'){
    var d=DEC[p[1]]; if(!d) return null;
    var o2={}; Object.keys(d).forEach(function(k){ o2[k]=d[k]; }); o2.type='decide'; o2._miss=m.id; return o2;
  }
  return null;
}
function warmCards(){
  var xs=MS.list().slice().sort(function(a,b){ return (b.n||1)-(a.n||1) || (a.at<b.at?-1:1); });
  var out=[]; for(var i=0;i<xs.length && out.length<WARM_MAX;i++){ var c=missCard(xs[i]); if(c) out.push(c); }
  return out;
}
function warmDue(){ return warmCards().length>0 && !sget('regradar-academy-warmup'); }

/* session planner: warm-up, then the next beats, then a Shift if time allows */
function plan(budget){
  var out=[], left=budget, stop=false;
  if(warmDue() && left>=2){ out.push({kind:'warmup', m:2, href:'#/warmup', label:'Warm-up', sub:'replay what you missed'}); left-=2; }
  var planned={};
  for(var i=0;i<TR.length && !stop;i++){
    var t=TR[i];
    if(!isComplete(t)){
      var bs=beats(t);
      for(var j=0;j<bs.length;j++){
        var b=bs[j].id; if(beatDone(t,b)) continue;
        var m=beatMin(t,b);
        if(m<=left){ out.push({kind:'beat', m:m, href:hrefFor(t,b), label:STEP_VERB[b], sub:t.title}); left-=m; } else { stop=true; break; }
      }
      if(stop) break;
      planned[t.id]=true;
    }
    if((i+1)%3===0){
      var s=SHIFTS[(i+1)/3-1];
      if(s && !shiftDone(s) && (isComplete(t)||planned[t.id]) && s.minutes<=left){ out.push({kind:'shift', m:s.minutes, href:'#/shift/'+s.no, label:'Shift '+s.no, sub:s.room}); left-=s.minutes; }
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
function rxp(k,d){ return ((RMETA.defaults||{}).xp||{})[k]||d; }

/* ── routing ────────────────────────────────────────────────────── */
function route(){
  var h=location.hash.replace(/^#\/?/,''), p=h.split('/');
  if(p[0]==='m' && BYID[p[1]]){
    var st=p[2]||null; if(st==='risks') st='watch'; if(st==='practice') st='law';
    return {view:'module', t:BYID[p[1]], step:st};
  }
  if(p[0]==='shift'){ var s=SHIFTS.filter(function(x){ return String(x.no)===p[1]; })[0]; if(s) return {view:'shift', s:s}; }
  if(p[0]==='warmup') return {view:'warmup'};
  return {view:'hub'};
}
function render(focusMain){
  if(curExplainer){ try{ curExplainer.destroy(); }catch(e){} curExplainer=null; }
  if(curRound){ try{ curRound.destroy(); }catch(e){} curRound=null; }
  var r=route();
  if(r.view==='module') moduleView(r.t, r.step); else if(r.view==='shift') shiftView(r.s); else if(r.view==='warmup') warmView(); else hubView();
  if(focusMain!==false){
    var h=APP.querySelector('h1'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:false}); }
    window.scrollTo(0,0);
    /* a first-run coach is a modal step: it takes focus (and scrolls into view) */
    var ch=APP.querySelector('.rr-coach h4'); if(ch) ch.focus();
  }
}

/* ═══ HUB ═══════════════════════════════════════════════════════════ */
function nextTarget(){
  var s=dueShift(), n=nextStep();
  /* a due Shift comes first once its three lessons are done, unless the learner already moved on */
  if(s && (!n || (TR.indexOf(n.t)<=s.no*3 && !beatsDone(n.t)))) return {kind:'shift', s:s};
  if(n) return {kind:'beat', n:n};
  return null;
}
function hubView(){
  document.title='RegRadar: Academy learning path';
  var doneN=TR.filter(isComplete).length, shDone=SHIFTS.filter(shiftDone).length, g=AP.get(), quizPct=quizAvg();
  var budget=AP.pref('budget',30), nt=nextTarget(), warm=warmDue(), wc=warm? warmCards().length : 0;
  var left=TR.reduce(function(s,t){ return isComplete(t)? s : s+beats(t).filter(function(b){ return !beatDone(t,b.id); }).reduce(function(a,b){ return a+beatMin(t,b.id); },0); },0)
    + SHIFTS.filter(function(s){ return !shiftDone(s); }).reduce(function(a,s){ return a+s.minutes; },0);
  var html='';
  html+='<header class="head"><div><div class="kicker">REGRADAR ACADEMY</div><h1>Learn the rules, then practise them</h1>'
    +'<p>Nine short lessons for new compliance analysts at payment, e-money and crypto firms, with a Shift after every third. Each lesson: watch, play, decide, check, read the law. CF Bank and every case are fictional.</p></div></header>';
  html+='<div id="promo" class="banner" hidden></div>';

  /* the path: one row */
  html+='<section class="pathrow" aria-labelledby="pathH"><div class="prog-h"><h2 id="pathH">Your path</h2><span>'+doneN+' of '+TR.length+' lessons · '+shDone+' of '+SHIFTS.length+' Shifts'+(left?' · about '+left+' min to go':'')+'</span></div>'
    +'<div class="bar" aria-hidden="true"><i style="--p:'+((doneN+shDone)/(TR.length+SHIFTS.length))+'"></i></div>'
    +'<ol class="row">'+rowNodes(nt)+'</ol></section>';

  /* the one big Next */
  if(nt){
    var head, sub, href, kick;
    if(nt.kind==='shift'){ var s=nt.s; kick='Next up · Shift '+s.no+' of '+SHIFTS.length; head=s.title; sub=s.room+', about '+s.minutes+' min. Mixes what you just learned with earlier lessons.'; href='#/shift/'+s.no; }
    else { var n=nt.n, bs=beats(n.t), k=bs.findIndex(function(b){ return b.id===n.step; });
      kick='Next up · Lesson '+n.t.no+' of '+TR.length+' · beat '+(k+1)+' of '+bs.length;
      head=STEP_VERB[n.step]+': '+n.t.title; sub='About '+beatMin(n.t,n.step)+' min.'+(doneN||beatsDone(n.t)? '' : ' Start here: no sign-up, saved on this device.'); href=hrefFor(n.t,n.step); }
    html+='<section class="card next" aria-labelledby="nxH"><div class="next-t"><div class="k">'+esc(kick)+'</div><h2 id="nxH">'+esc(head)+'</h2><p>'+esc(sub)+'</p></div>'
      +'<div class="next-a"><a class="btn pri big" href="'+href+'">Next <span aria-hidden="true">→</span></a>'
      +(warm? '<a class="btn sm" href="#/warmup">Warm up first · 2 min</a>' : '')+'</div></section>';
    if(warm) html+='<p class="fine warmnote">Warm-up: '+wc+' card'+(wc>1?'s':'')+' you missed before, replayed once per session.</p>';
  }else{
    html+='<section class="card next" aria-labelledby="nxH"><div class="next-t"><div class="k">Path complete</div><h2 id="nxH">All '+TR.length+' lessons and '+SHIFTS.length+' Shifts done</h2>'
      +'<p>Keep sharp in the practice rooms below, or export your completions.</p></div><div class="next-a">'
      +(warm? '<a class="btn pri big" href="#/warmup">Warm up · 2 min</a>' : '<a class="btn pri big" href="#practice-rooms">Practice rooms</a>')+'</div></section>';
  }

  /* time picker */
  html+='<section class="sec" aria-labelledby="tbH"><h2 id="tbH">How much time do you have?</h2><div class="card"><p class="sub" style="margin-top:0">Pick a slot: the session is built from a warm-up, your next beats and, if time allows, a Shift. Minute estimates are defaults.</p>'
    +'<div class="seg" role="group" aria-label="Time budget">'
    +[15,30,60].map(function(m){ return '<button type="button" data-act="budget" data-m="'+m+'" aria-pressed="'+(budget===m)+'">'+m+' min</button>'; }).join('')+'</div>'
    +budgetPlan(budget)+'</div></section>';

  /* all lessons, for review */
  html+='<section class="sec" aria-labelledby="allH"><h2 id="allH">All lessons</h2><details class="more"><summary>Every lesson and its beats</summary><div><ol class="path">'+TR.map(trackCard).join('')+'</ol>'
    +'<p class="fine" style="margin-top:10px">Lessons unlock in order. Shifts never block you: they are where the lessons meet a working day.</p></div></details></section>';

  /* rank + skills */
  var r=SH?SH.rank:null, nx=SH? SH.ranks.find(function(x){ return x.xp>SH.xp; }):null;
  html+='<section class="sec" aria-labelledby="rkH"><h2 id="rkH">Rank and skills</h2><div class="two"><div class="card">'
    +(SH? '<h2 style="font-size:20px">'+esc(r.n)+'</h2><p class="sub">'+SH.xp.toLocaleString('en-US')+' XP'+(nx? ' · '+(nx.xp-SH.xp).toLocaleString('en-US')+' XP to '+esc(nx.n) : ' · top rank')+'</p>'
      +'<ol class="ladder">'+SH.ranks.map(function(x){ return '<li'+(x.n===r.n?' class="here" aria-current="true"':'')+'><b>'+esc(x.n)+'</b> <span>from '+x.xp.toLocaleString('en-US')+' XP'+(x.n===r.n?' (you are here)':'')+'</span></li>'; }).join('')+'</ol>'
      +'<p class="fine" style="margin-top:10px">One rank across the learning path and the practice rooms. XP amounts and thresholds are defaults.</p>' : '')
    +'</div><div class="card"><h2 style="font-size:20px">Skills</h2><p class="sub">Earned by finishing lessons and by the actions you take in the simulations.</p><ul class="skills">'
    +(SH? SH.skills.map(function(s){ return '<li><b>'+esc(s.icon)+' '+esc(s.n)+'</b><span>'+esc(s.name)+'</span></li>'; }).join('') : '')+'</ul></div></div></section>';

  /* practice rooms */
  html+='<section class="sec" id="practice-rooms" aria-labelledby="prH"><h2 id="prH">Practice rooms</h2><div class="rooms">'
    +room('laundromat.html','The Laundromat','Play the launderer for a few rounds and learn the red flags from the other side.')
    +room('ownership.html','Ownership structures','Read charts and designate beneficial owners. Six cases.')
    +room('desk.html','The Desk','A journal of days: onboarding queues and alert triage against the clock.')
    +room('workstation.html','Analyst workstation','The full simulated desktop with inbox, browser and case files. Desktop only.')
    +room('glossary.html','Glossary','AML and KYC terms in plain English.')
    +'</div><p class="fine" style="margin-top:10px">The rooms are open any time. The Shifts on the path send you to the right one.</p></section>';

  /* training record */
  html+='<section class="sec" aria-labelledby="rcH"><h2 id="rcH">Training record</h2><div class="card"><p class="sub" style="margin-top:0">Your completions (lesson, date, score) are saved in this browser as training evidence: AMLR Article 12 asks firms to run ongoing training programmes. It is not an official certificate.</p>'
    +'<p class="fine" style="margin-top:8px">Average best quiz score: '+(quizPct==null?'none yet':quizPct+'% (pass mark 75%, default)')+' · Last activity: '+(g.updated? esc(fmtDate(g.updated)) : 'not started')+'</p>'
    +'<div class="tools"><button type="button" class="btn sm" data-act="csv">Export completions (CSV)</button>'
    +'<button type="button" class="btn sm" data-act="reset">Clear training records on this device</button></div></div></section>';

  /* evidence: certificate and team register */
  html+='<section class="sec" aria-labelledby="evH"><h2 id="evH">Evidence</h2><div class="rooms">'
    +room('academy-certificate.html','Your certificate','Print or save a record of the lessons you completed, with dates, scores and an integrity code. Self-attested.')
    +room('academy-register.html','Team register','For compliance officers: merge several learners\' files, see who is overdue, print an evidence pack.')
    +'</div><p class="fine" style="margin-top:10px">Documented training is what AMLR Art. 12 asks for. These records are self-attested, kept on the learner\'s device and are not an accredited or regulator-approved certificate.</p></section>';

  html+='<section class="sec"><details class="more"><summary>What is not built yet</summary><div>Planned, not available: a Spot it game and a Decide scenario for the DORA and MiCA primer, a hands-on STR drafting simulation, a supervisor-inspection simulation, and per-firm assignments.</div></details></section>';
  APP.innerHTML=html;
  var cur=APP.querySelector('.row .nd.now'), row=APP.querySelector('.row');
  if(cur && row && row.scrollWidth>row.clientWidth) row.scrollLeft=Math.max(0, cur.offsetLeft-row.clientWidth/2+cur.offsetWidth/2);
}
function rowNodes(nt){
  var out=[], prevDone=true;
  TR.forEach(function(t,i){
    var done=isComplete(t), open=unlocked(i), isNext=nt&&nt.kind==='beat'&&nt.n.t===t;
    var cls='nd'+(done?' done':isNext?' now':open?' open':' locked')+(prevDone&&i>0?' lit':'');
    var state=done?'complete':isNext?'next up':open?beatsDone(t)+' of '+beats(t).length+' beats':'locked';
    out.push('<li class="'+cls+'"><a href="'+hrefFor(t)+'" aria-label="Lesson '+t.no+': '+esc(t.title)+', '+state+'"'+(isNext?' aria-current="step"':'')+'><span class="dot" aria-hidden="true">'+(done?'✓':t.no)+'</span><span class="lbl" aria-hidden="true">'+esc(label(t))+'</span></a></li>');
    prevDone=done;
    if((i+1)%3===0){
      var s=SHIFTS[(i+1)/3-1]; if(!s) return;
      var sd=shiftDone(s), so=shiftOpen(s), sn=nt&&nt.kind==='shift'&&nt.s===s;
      out.push('<li class="nd shift'+(sd?' done':sn?' now':so?' open':' locked')+(prevDone?' lit':'')+'"><a href="#/shift/'+s.no+'" aria-label="Shift '+s.no+': '+esc(s.room)+', '+(sd?'worked':sn?'next up':so?'open':'opens after lesson '+t.no)+'"'+(sn?' aria-current="step"':'')+'><span class="dot" aria-hidden="true">'+(sd?'✓':'S'+s.no)+'</span><span class="lbl" aria-hidden="true">Shift '+s.no+'</span></a></li>');
      prevDone=prevDone&&sd;
    }
  });
  return out.join('');
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
  if(!p.length) return '<p class="fine" style="margin-top:12px">'+(nextTarget()? 'The next step takes longer than '+b+' minutes: pick a longer slot, or just press Next.' : 'Nothing left to plan: every lesson and Shift is done.')+'</p>';
  var tot=p.reduce(function(s,x){ return s+x.m; },0);
  return '<p class="fine" style="margin-top:12px">Your '+b+'-minute session: '+p.length+' step'+(p.length>1?'s':'')+', about '+tot+' min.</p><ol class="plan">'
    +p.map(function(x){ return '<li class="k-'+x.kind+'"><a href="'+x.href+'"><span><b>'+esc(x.label)+'</b> <span class="w">'+esc(x.sub)+'</span></span><span class="m">'+x.m+' min</span></a></li>'; }).join('')+'</ol>';
}
function trackCard(t,i){
  var done=isComplete(t), open=unlocked(i), n=nextStep(), isNext=n&&n.t===t;
  var cls=done?'st-done':isNext?'st-next':open?'st-open':'st-locked';
  var bs=beats(t), rd=beatsDone(t);
  var dots='<span class="dots" aria-hidden="true">'+bs.map(function(b){ return '<i class="'+(beatDone(t,b.id)?'on':'')+'" title="'+esc(b.n)+'"></i>'; }).join('')+'</span>';
  var status=done?'<span class="chip ok">Complete</span>':!open?'<span class="lock">Locked: finish lesson '+TR[i-1].no+' first</span>':'<span class="chip acc">'+rd+' of '+bs.length+' beats</span>';
  var title=open? '<a href="'+hrefFor(t)+'">'+esc(t.title)+'</a>' : esc(t.title);
  return '<li class="trk '+cls+'"><div class="trk-no" aria-hidden="true">'+(done?'✓':t.no)+'</div><div><h3>'+title+'</h3><p>'+esc(t.short)+'</p>'
    +'<div class="trk-meta"><span class="chip">about '+lessonMin(t)+' min</span>'+dots+status+'</div></div></li>';
}

/* ═══ SHIFT ═════════════════════════════════════════════════════════ */
function shiftView(s){
  document.title='Shift '+s.no+' | RegRadar Academy';
  var after=shiftAfter(s), open=shiftOpen(s), done=shiftDone(s), phone=isPhone()&&s.desktop_only;
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">Shift '+s.no+' of '+SHIFTS.length+' · after lesson '+after.no+'</div><h1>'+esc(s.title)+'</h1>'
    +'<div class="meta"><span class="chip">about '+s.minutes+' min</span>'+(done?'<span class="chip ok">Worked</span>':open?'<span class="chip acc">Open</span>':'<span class="chip">Opens after lesson '+after.no+'</span>')+'<span class="chip">Fictional cases</span></div></header>';
  html+='<section class="panel" aria-labelledby="shH"><h2 id="shH">'+esc(s.room)+'</h2><p class="lede">'+esc(s.blurb)+'</p>';
  if(!open) html+='<div class="callout">You can play it now, but it makes most sense after <a href="'+hrefFor(after)+'">lesson '+after.no+': '+esc(after.title)+'</a>.</div>';
  if(phone) html+='<div class="callout warn">The workstation needs a bigger screen. On this device, play the next day at the Desk instead.</div>';
  html+='<div class="foot-act"><button type="button" class="btn" data-act="shiftdone" data-n="'+s.no+'" aria-pressed="'+done+'">'+(done?'Marked as worked':'Mark this Shift as worked')+'</button>'
    +'<a class="btn pri big" href="'+esc(phone&&s.alt_href? s.alt_href : s.href)+'">Open '+esc(phone&&s.alt_href? 'the Desk' : s.room)+' <span aria-hidden="true">→</span></a></div>'
    +'<p class="fine" style="margin-top:10px">Ticked automatically once you have worked '+s.desk_days+' days at the Desk (the Desk and the workstation share one journal), or mark it yourself. Shifts never lock a lesson.</p></section>';
  APP.innerHTML=html;
}

/* ═══ WARM-UP ═══════════════════════════════════════════════════════ */
function warmView(){
  document.title='Warm-up | RegRadar Academy';
  var cards=warmCards();
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">Warm-up · about 2 minutes</div><h1>Replay what you missed</h1>'
    +'<p class="lede">'+(cards.length? cards.length+' card'+(cards.length>1?'s':'')+' you got wrong before. Get one right and it leaves the list. No score is kept.' : 'Nothing to replay: you have no missed cards or questions.')+'</p></header>';
  html+='<section class="panel" aria-labelledby="wuH"><h2 id="wuH" class="sr">Warm-up round</h2><div id="rrHost"></div>'+(cards.length?'':'<div class="foot-act"><span></span><a class="btn pri" href="#/">Back to the path</a></div>')+'</section>';
  APP.innerHTML=html;
  if(!cards.length||!RD) return;
  var nt=nextTarget();
  var g={id:'warmup', type:cards[0].type, title:'Warm-up', cards:cards, remember:[], law:[]};
  curRound=RD.mount(document.getElementById('rrHost'), g, {mode:'warmup', tutorials:TUT, lawUrl:lawUrl, citeText:citeText,
    onAnswer:function(c,ok){ if(!c._miss) return; if(ok) MS.clear(c._miss); else MS.add(c._miss, c.module||'', 'card'); },
    onDone:function(){ sset('regradar-academy-warmup','done'); },
    nextLabel: nt? 'Continue: '+(nt.kind==='shift'? 'Shift '+nt.s.no : STEP_VERB[nt.n.step]+', lesson '+nt.n.t.no) : 'Back to the path',
    onNext:function(){ location.hash= nt? (nt.kind==='shift'? '#/shift/'+nt.s.no : hrefFor(nt.n.t, nt.n.step)) : '#/'; }});
}

/* ═══ LESSON ════════════════════════════════════════════════════════ */
function relatedHTML(t){
  var m=(MAP.modules||{})[t.id]||{}, ids=(m.obligations||[]).filter(function(id){ return OBL[id]; });
  if(!ids.length) return '<div class="rel"><span>No obligation in the Compliance register maps to this lesson yet'+(m.note?': '+esc(m.note.replace(/\.$/,'')):'')+'.</span></div>';
  return '<div class="rel"><span>Related obligations:</span>'+ids.map(function(id){ var o=OBL[id];
    return '<a href="workspace.html?open='+encodeURIComponent(id)+'" title="'+esc(o.what.slice(0,140))+'">'+esc(o.legal_basis)+'</a>'; }).join('')+'</div>'
    +(m.note?'<p class="fine" style="margin-top:6px">'+esc(m.note)+'</p>':'');
}
function stepperHTML(t,cur){
  return beats(t).map(function(s,k){ var d=beatDone(t,s.id);
    return '<li><a href="'+hrefFor(t,s.id)+'"'+(s.id===cur?' aria-current="step"':'')+'>'+(k+1)+'. '+s.n
      +(d?' <span class="tick" aria-hidden="true">✓</span><span class="sr"> done</span>':'')+'</a></li>'; }).join('');
}
function moduleView(t, stepId){
  var i=TR.indexOf(t), open=unlocked(i), list=beats(t);
  document.title=t.title+' | RegRadar Academy';
  var n=nextStep();
  if(!stepId || !list.some(function(s){ return s.id===stepId; })) stepId=(n&&n.t===t)? n.step : 'watch';
  var html='<a class="crumb" href="#/">← The path</a>';
  html+='<header class="mhead"><div class="kicker">Lesson '+t.no+' of '+TR.length+'</div><h1>'+esc(t.title)+'</h1>'
    +'<div class="meta"><span class="chip">about '+lessonMin(t)+' min</span>'+(isComplete(t)?'<span class="chip ok">Complete</span>':'<span class="chip acc">'+beatsDone(t)+' of '+list.length+' beats</span>')+'<span class="chip">Fictional examples</span></div>'
    +relatedHTML(t)+'</header>';
  if(!open){
    html+='<section class="panel" aria-labelledby="lkH"><h2 id="lkH">This lesson unlocks after lesson '+TR[i-1].no+'</h2>'
      +'<p class="lede">Finish <b>'+esc(TR[i-1].title)+'</b> to open it. Here is what it covers.</p>'
      +'<ul class="learn">'+t.learn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
      +'<div class="foot-act"><a class="btn" href="#/">Back to the path</a><a class="btn pri" href="'+hrefFor(TR[i-1])+'">Go to lesson '+TR[i-1].no+'</a></div></section>';
    APP.innerHTML=html; return;
  }
  html+='<div id="promo" class="banner" hidden></div>';
  html+='<ol class="stepper" aria-label="Beats in this lesson">'+stepperHTML(t,stepId)+'</ol>';
  html+='<section class="panel" id="panel" aria-labelledby="pnH">'+panel(t,stepId,list)+'</section>';
  APP.innerHTML=html;
  afterPanel(t,stepId);
}
function nextOf(t,stepId,list){ var k=list.findIndex(function(s){ return s.id===stepId; }); return list[k+1]||null; }
function numOf(t,stepId){ return beats(t).findIndex(function(s){ return s.id===stepId; })+1; }
function footer(t,stepId,list,opts){
  opts=opts||{}; var nx=nextOf(t,stepId,list);
  var lab=opts.label || (nx? 'Next: '+nx.n : 'Back to the path');
  return '<div class="foot-act"><span class="fine">'+(opts.note||'')+'</span><button type="button" class="btn pri" data-act="next" data-step="'+stepId+'"'+(opts.disabled?' disabled':'')+'>'+esc(lab)+' <span aria-hidden="true">→</span></button></div>';
}
function panel(t,stepId,list){
  var f={watch:watchP,spot:spotP,decide:decideP,check:checkP,law:lawP}[stepId];
  return f(t,list);
}

/* 1. watch: the explainer, then what goes wrong */
function watchP(t,list){
  var d=AP.stepDone(t.id,'watch'), r=t.risks;
  var cons=r.consequences.map(function(c){ return '<li>'+esc(c.text)+(c.cite?' <a class="cite" href="'+lawUrl(c.cite)+'">'+esc(citeText(c.cite))+'</a>':'')+'</li>'; }).join('');
  return '<h2 id="pnH">'+numOf(t,'watch')+'. Watch: '+esc(t.title)+'</h2><p class="lede">About '+Math.round((EXP[t.explainer]&&EX? EX.duration(EXP[t.explainer]) : 75))+' seconds. Every step has a text caption, and the full text is under the player.</p>'
    +'<ul class="learn">'+t.learn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
    +'<div id="exHost" style="margin-top:14px"></div>'
    +'<div id="watchNote">'+(d?'<div class="callout ok">Watched. Read what goes wrong below, then carry on.</div>':'<div class="callout">Watch to the last step (or step through it) to tick this one off.</div>')+'</div>'
    +'<h3 class="h3">Before you play: the risks</h3>'
    +'<div class="rgrid"><div class="rcol w"><h3>What goes wrong</h3><ul>'+r.wrong.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>'
    +'<div class="rcol c"><h3>Consequences</h3><ul>'+cons+'</ul></div>'
    +'<div class="rcol f"><h3>Red flags</h3><ul>'+r.redflags.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div></div>'
    +'<p class="fine" style="margin-top:10px">Red-flag lists are illustrative, not exhaustive, and are not legal statements. Legal consequences cite the text.</p>'
    +footer(t,'watch',list,{note:'Fictional examples. The law text is in the last beat.'});
}
function appliesNote(){ return RMETA.applies? '<p class="fine" style="margin-top:6px">'+esc(RMETA.applies)+'</p>' : ''; }
/* 2. spot it */
function spotP(t,list){
  var g=GAMES[t.id], s=(AP.get().modules[t.id]||{steps:{}}).steps.spot;
  return '<h2 id="pnH">'+numOf(t,'spot')+'. Spot it: '+esc(g.title)+'</h2><p class="lede">'+esc(g.intro)+' About '+(g.minutes||2)+' min.'+(s?' Your best: '+s.best+' of '+s.max+'.':'')+'</p>'+appliesNote()+'<div id="rrHost"></div>';
}
/* 3. decide */
function decideP(t,list){
  return '<h2 id="pnH">'+numOf(t,'decide')+'. Decide: what would you do?</h2><p class="lede">One situation, a real choice, and what happens next. About a minute. Fictional.</p>'+appliesNote()+'<div id="rrHost"></div>';
}
/* 4. check */
function checkP(t,list){
  if(!QZ || QZ.id!==t.id) QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false,answers:[]};
  return '<h2 id="pnH">'+numOf(t,'check')+'. Check: '+t.questions.length+' questions</h2><p class="lede">Pass mark 3 of '+t.questions.length+' (default). Retry as often as you like. XP is awarded the first time you pass. Questions you miss come back in your warm-up.</p><div id="quiz" style="margin-top:12px"></div>';
}
function drawQuiz(t){
  var host=document.getElementById('quiz'); if(!host) return;
  var q=t.questions[QZ.i], list=beats(t), N=t.questions.length;
  if(QZ.done){
    var passed=QZ.score>=Math.ceil(N*0.75);
    host.innerHTML='<div class="card"><div class="qprog">RESULT</div><div class="score">'+QZ.score+' / '+N+'</div>'
      +'<p class="sub">'+(passed? 'Passed. This beat is ticked off.' : 'Not passed yet: you need '+Math.ceil(N*0.75)+' of '+N+'. Rewatch the explainer or replay Spot it, then try again.')+'</p>'
      +'<div class="foot-act" style="border:0;padding-top:4px">'+(passed? '<span></span><button type="button" class="btn pri" data-act="next" data-step="check">Next: '+esc((nextOf(t,'check',list)||{n:'Done'}).n)+' <span aria-hidden="true">→</span></button>'
        : '<a class="btn" href="'+hrefFor(t,'watch')+'">Rewatch</a><button type="button" class="btn pri" data-act="retry">Try again</button>')+'</div></div>';
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
  var mid='q:'+t.id+':'+QZ.i; if(ok) MS.clear(mid); else MS.add(mid, t.id, 'q');
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
/* 5. read the law (+ optional practice room) */
function afterLesson(t){
  var i=TR.indexOf(t);
  if((i+1)%3===0){ var s=SHIFTS[(i+1)/3-1]; if(s && !shiftDone(s)) return {href:'#/shift/'+s.no, label:'Next: Shift '+s.no}; }
  var n=nextStep(); if(n) return {href:hrefFor(n.t,n.step), label:'Next: '+(n.t===t? STEP_VERB[n.step] : 'lesson '+n.t.no)};
  return {href:'#/', label:'Back to the path'};
}
function lawP(t,list){
  var complete=isComplete(t);
  var h='<h2 id="pnH">'+numOf(t,'law')+'. Read the law: what it says</h2><p class="lede">Verbatim excerpts from the official text held in this repository (docs/data/laws/). Each is re-checked against that text when you open this page. Plain-language notes are marked.</p>';
  if(complete){ var a=afterLesson(t), i=TR.indexOf(t), s=(i+1)%3===0? SHIFTS[(i+1)/3-1] : null;
    h+='<div class="callout ok"><b>Lesson complete.</b> '+(s&&!shiftDone(s)? 'Shift '+s.no+' is open: a working session that mixes this lesson with the two before it.' : (TR[i+1]? 'Next lesson: <a href="'+hrefFor(TR[i+1])+'">'+esc(TR[i+1].title)+'</a>.' : 'You have finished the path.'))+'</div>'; }
  h+=t.law.map(function(c,k){
    return '<div class="q" data-q="'+k+'"><div class="q-h"><b>'+esc((CUR_META.law_names||{})[c.celex]||c.celex)+', Article '+esc(c.art)+(c.para?', para. '+esc(c.para):'')+'</b><span>'+esc(c.label)+'</span></div>'
      +'<blockquote>'+esc(c.quote)+'</blockquote>'
      +'<div class="q-f"><span><span class="ver" data-ver>Checking against the source…</span>'+(c.note?' · Note: '+esc(c.note):'')+'</span><a href="'+lawUrl(c)+'">Read the full article</a></div></div>';
  }).join('');
  if(t.reading&&t.reading.length) h+='<details class="more"><summary>Further reading (not quoted here)</summary><div><ul style="margin-left:18px">'+t.reading.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>Read these at the source: RegRadar does not reproduce them.</div></details>';
  if(t.practice){
    var p=t.practice, pd=AP.stepDone(t.id,'practice')||practiceAuto(t);
    h+='<div class="card deeper"><h3 style="font-size:16px">Go deeper (optional): '+esc(p.label)+'</h3><p class="sub">'+esc(p.why)+' About '+p.minutes+' min. Not needed to finish the lesson.</p>'
      +'<div class="tools"><a class="btn sm" href="'+esc(p.href)+'">Open the simulation</a>'
      +'<button type="button" class="btn sm" data-act="practised" aria-pressed="'+pd+'">'+(pd?'Marked as practised':'Mark as practised')+'</button></div></div>';
  }
  h+='<div class="callout warn">Prototype for training. Not legal advice. Check the current official text and your national transposition and supervisor guidance.</div>';
  var missing=list.filter(function(b){ return b.id!=='law' && !beatDone(t,b.id); });
  if(complete){ var a2=afterLesson(t); h+='<div class="foot-act"><a class="btn" href="#/">Back to the path</a><a class="btn pri" href="'+a2.href+'">'+esc(a2.label)+' <span aria-hidden="true">→</span></a></div>'; }
  else h+=footer(t,'law',list,{label:'Finish lesson', note: missing.length? 'Still to do: '+missing.map(function(b){ return b.n.toLowerCase(); }).join(', ')+'.' : ''});
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
function goNextBeat(t,stepId){ var nx=nextOf(t,stepId,beats(t)); location.hash= nx? hrefFor(t,nx.id) : '#/'; }
function roundOpts(t,stepId,extra){
  var nx=nextOf(t,stepId,beats(t)), o={tutorials:TUT, lawUrl:lawUrl, citeText:citeText,
    coachSeen:function(type){ return !!AP.pref('coach_'+type,false); },
    markCoach:function(type){ AP.setPref('coach_'+type,true); },
    nextLabel: nx? 'Next: '+nx.n : 'Back to the path',
    onNext:function(){ goNextBeat(t,stepId); }};
  Object.keys(extra).forEach(function(k){ o[k]=extra[k]; });
  return o;
}
function afterPanel(t,stepId){
  if(stepId==='watch'){
    var host=document.getElementById('exHost'), spec=EXP[t.explainer];
    if(host && spec && EX){
      curExplainer=EX.mount(host, spec, {onComplete:function(){
        var r=AP.step(t.id,'watch'); if(r.first) award(XP_DEF.watch,'watching');
        var n=document.getElementById('watchNote'); if(n) n.innerHTML='<div class="callout ok">Watched. Read what goes wrong below, then carry on.</div>';
        if(r.completed) completedNow(t); refreshStepper(t,'watch');
      }});
    } else if(host) host.innerHTML='<p class="callout warn">The explainer could not be loaded.</p>';
  }
  if(stepId==='spot' && RD){
    var g=GAMES[t.id];
    curRound=RD.mount(document.getElementById('rrHost'), g, roundOpts(t,'spot',{mode:'game',
      onAnswer:function(c,ok,prac){ if(prac) return; var mid='card:'+g.id+':'+c.id; if(ok) MS.clear(mid); else MS.add(mid, t.id, 'card'); },
      onDone:function(r){
        var res=AP.game(t.id,'spot',r.score,r.max);
        if(res.first){ award(Math.max(rxp('spot_card',5)*r.score, rxp('spot_card',5)),'the Spot it round'); if(SH) SH.awardSkill(t.skill, 10); }
        if(res.completed) completedNow(t);
        refreshStepper(t,'spot');
      }}));
  }
  if(stepId==='decide' && RD){
    var d=DEC[t.id];
    curRound=RD.mount(document.getElementById('rrHost'), {id:d.id, type:'decide', title:d.title, cards:[d]}, roundOpts(t,'decide',{mode:'decide',
      onDone:function(r){
        var x=r.results[r.results.length-1]||{}, o=(d.options.filter(function(y){ return String(y.id)===String(x.choice); })[0])||{};
        var res=AP.step(t.id,'decide',{choice:x.choice, verdict:o.verdict});
        if(o.verdict==='poor') MS.add('dec:'+t.id, t.id, 'decide'); else MS.clear('dec:'+t.id);
        if(res.first) award(rxp('decide',15),'deciding');
        if(res.completed) completedNow(t);
        refreshStepper(t,'decide');
      }}));
  }
  if(stepId==='check') drawQuiz(t);
  if(stepId==='law') lawVerify(t);
}
function refreshStepper(t,cur){
  var el=APP.querySelector('.stepper'); if(el) el.innerHTML=stepperHTML(t,cur);
  var c=APP.querySelector('.mhead .meta .chip.acc'); if(c) c.textContent=beatsDone(t)+' of '+beats(t).length+' beats';
}
function completedNow(t){
  moduleCompleted(t); say('Lesson complete: '+t.title+'.');
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
    if(window.confirm('Clear all Academy training records (lessons, scores, missed cards) on this device? XP and rank are kept.')){
      AP.reset(); MS.list().forEach(function(m){ MS.clear(m.id); }); render(false); say('Training records cleared.'); }
    return;
  }
  if(act==='budget'){ AP.setPref('budget',+b.dataset.m); render(false); var nb=APP.querySelector('[data-act="budget"][aria-pressed="true"]'); if(nb) nb.focus(); return; }
  if(act==='shiftdone'){ var m=AP.pref('shifts',{})||{}; if(!m[b.dataset.n]){ m[b.dataset.n]={at:new Date().toISOString()}; AP.setPref('shifts',m); say('Shift '+b.dataset.n+' marked as worked.'); }
    render(false); var sb=APP.querySelector('[data-act="shiftdone"]'); if(sb) sb.focus(); return; }
  if(!t) return;
  var list=beats(t);
  if(act==='qcheck') return qCheck(t);
  if(act==='qnext') return qNext(t);
  if(act==='retry'){ QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false}; drawQuiz(t); var l=document.getElementById('qLeg'); if(l) l.focus(); return; }
  if(act==='practised'){ if(b.getAttribute('aria-pressed')!=='true'){ AP.step(t.id,'practice',{manual:true}); } render(false); return; }
  if(act==='next'){
    var st=b.dataset.step;
    if(st==='watch'){ var rr=AP.step(t.id,'risks'); if(rr.first) award(XP_DEF.risks,'reading the risks'); if(rr.completed) completedNow(t); }
    if(st==='law'){
      var lr=AP.step(t.id,'law'); if(lr.first) award(XP_DEF.law,'the law step'); if(lr.completed) completedNow(t);
      render(false); var hh=APP.querySelector('h1'); if(hh){ hh.setAttribute('tabindex','-1'); hh.focus(); } window.scrollTo(0,0); return;
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
Promise.all([getJSON('data/academy/curriculum.json'), getJSON('data/academy/explainers.json'), getJSON('data/academy/module-map.json',true), getJSON('data/obligations.json',true), getJSON('data/academy/rounds.json',true)])
.then(function(r){
  CUR=r[0]; CUR_META=CUR._meta; TR=CUR.tracks; TR.forEach(function(t){ BYID[t.id]=t; });
  (r[1].explainers||[]).forEach(function(e){ EXP[e.id]=e; });
  MAP=r[2]||{modules:{}}; ((r[3]&&r[3].obligations)||[]).forEach(function(o){ OBL[o.id]=o; });
  var R=r[4]||{};
  RMETA=R._meta||{}; LABELS=RMETA.labels||{}; TUT=R.tutorials||{}; SHIFTS=R.shifts||[];
  if(RD){
    (R.games||[]).forEach(function(g){ if(BYID[g.module]){ GAMES[g.module]=g; GBYID[g.id]=g; } });
    (R.decide||[]).forEach(function(d){ if(BYID[d.module]) DEC[d.module]=d; });
  }
  /* new completions record the content version they were done on (certificates and the team register print it) */
  AP.setContentVersion(CUR_META.content_version);
  /* completion rule per lesson: the old four steps, plus Spot it and Decide where they exist.
     Lessons already marked complete stay complete (AcademyProgress keeps the flag). */
  TR.forEach(function(t){
    var req=['watch','risks']; if(GAMES[t.id]) req.push('spot'); if(DEC[t.id]) req.push('decide'); req.push('check','law');
    AP.setRequired(t.id, req);
  });
  TR.forEach(function(t){ if(t.practice && (t.practice.module==='laundromat'||t.practice.module==='ownership')) t.practice.auto=true; });
  render(false);
}).catch(function(e){
  APP.innerHTML='<header class="head"><div><div class="kicker">REGRADAR ACADEMY</div><h1>The learning path could not load</h1><p>Open this page from the RegRadar site (it reads small data files). The simulations still work: <a href="laundromat.html">Laundromat</a>, <a href="ownership.html">Ownership</a>, <a href="desk.html">The Desk</a>, <a href="workstation.html">Workstation</a>.</p></div></header>';
  if(window.console) console.warn('Academy hub: '+e.message);
});
})();
