/* ═══════════════════════════════════════════════════════════════════
   ACADEMY: the AMLR programme, one page, one path
   ───────────────────────────────────────────────────────────────────
   #/              the programme: who it is for, what you get, the path in
                   three levels (Intro, Foundations, Practitioner), one Next
                   button, optional practice rooms at the end of each level,
                   and Evidence as the last step
   #/m/<id>[/b]    one topic as one flow: Watch (film or explainer, risks) ->
                   Questions -> Spot it -> Decide -> Read the law -> Related in Max
   #/soon/<id>     a topic that is not built yet: what it will cover, what is
                   missing, and the verbatim law excerpt
   #/shift/<n>     a practice room session (the Desk or the workstation)
   #/warmup        replay what you missed before
   #/evidence      end of path: your record, the certificate and the team register
   #/programme     one-page programme summary, generated from the data

   Data: data/academy/programme.json (levels, order, rooms, coming soon),
   curriculum.json, explainers.json, rounds.json, films.json, module-map.json
   (+ data/obligations.json). Law quotes are re-checked against data/laws/ in
   the browser. Progress keys are unchanged: AcademyProgress
   ('regradar-academy-training'), AcademyRounds.misses ('regradar-academy-misses'),
   AcademyShell ('regradar-academy-progress'). Device-local only.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var AP=window.AcademyProgress, SH=window.AcademyShell, EX=window.AcademyExplainer, RD=window.AcademyRounds;
var MS=RD? RD.misses : {add:function(){},clear:function(){},list:function(){return [];},count:function(){return 0;}};
var APP=document.getElementById('app'), LIVE=document.getElementById('acLive');
var CUR=null, CUR_META={}, EXP={}, MAP={}, OBL={}, TR=[], BYID={}, LAWS={};
var GAMES={}, GBYID={}, DEC={}, SHIFTS=[], TUT={}, RMETA={}, LABELS={};
var PG={}, LEVELS=[], SOON={}, ROOMS={}, NOTES={}, FILMS=[], LV_OF={}, PATH=[], HAS_TOPICS=false;
var BEATS=[{id:'watch',n:'Watch'},{id:'check',n:'Questions'},{id:'spot',n:'Spot it'},{id:'decide',n:'Decide'},{id:'law',n:'Read the law'},{id:'max',n:'Related in Max'}];
var QZ=null, curExplainer=null, curRound=null, TIMERS=[];

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function norm(s){ return String(s).replace(/ /g,' ').replace(/\s+/g,' ').trim(); }
function say(msg){ if(!LIVE) return; LIVE.textContent=''; setTimeout(function(){ LIVE.textContent=msg; },40); }
function lawUrl(c){ return 'law.html?celex='+encodeURIComponent(c.celex)+'&art='+encodeURIComponent(c.art); }
function lawName(c){ return (CUR_META.law_names||{})[c.celex]||c.celex; }
function citeText(c){ return lawName(c).split(' (')[0]+' Art. '+c.art+(c.para?', para. '+c.para:''); }
function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function mins(t,k){ return (t.minutes&&t.minutes[k])||0; }
function label(t){ return LABELS[t.id]||t.title; }
function sget(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function sset(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }
function plural(n,w){ return n+' '+w+(n===1?'':'s'); }

/* ── beats and progress ─────────────────────────────────────────── */
function beats(t){ return BEATS.filter(function(b){ return b.id==='spot'? !!GAMES[t.id] : b.id==='decide'? !!DEC[t.id] : true; }); }
function counted(t){ return beats(t).filter(function(b){ return b.id!=='max'; }); }   /* Related in Max is a pointer, not a beat to tick */
function beatDone(t,b){ return b==='watch'? (AP.stepDone(t.id,'watch') && AP.stepDone(t.id,'risks')) : b==='max'? false : AP.stepDone(t.id,b); }
function beatMin(t,b){
  if(b==='watch') return mins(t,'watch')+mins(t,'risks');
  if(b==='spot') return (GAMES[t.id]&&GAMES[t.id].minutes)||2;
  if(b==='decide') return 1;
  if(b==='max') return 0;
  return mins(t,b);
}
function lessonMin(t){ return counted(t).reduce(function(s,b){ return s+beatMin(t,b.id); },0); }
function beatsDone(t){ return counted(t).filter(function(b){ return beatDone(t,b.id); }).length; }
function isComplete(t){ return AP.isComplete(t.id); }
function practiceAuto(t){
  var p=t.practice; if(!p||!p.auto||!p.module||!SH) return false;
  return ((SH.progress.modules[p.module]||{}).done||0)>0;
}
function hrefFor(t,step){ return '#/m/'+t.id+(step?'/'+step:''); }
function topicHref(id){ return BYID[id]? hrefFor(BYID[id]) : '#/soon/'+id; }

/* the path: every built, non-optional topic in level order */
function nextStep(){
  for(var i=0;i<PATH.length;i++){
    var t=PATH[i]; if(isComplete(t)) continue;
    var bs=counted(t);
    for(var j=0;j<bs.length;j++){ if(!beatDone(t,bs[j].id)) return {t:t,step:bs[j].id}; }
    return {t:t,step:'law'};
  }
  return null;
}
function levelTopics(lv){ return (lv.topics||[]).concat(lv.optional||[]); }
function levelBuilt(lv){ return (lv.topics||[]).filter(function(id){ return BYID[id]; }).map(function(id){ return BYID[id]; }); }
function levelMin(lv){ return levelBuilt(lv).reduce(function(s,t){ return s+lessonMin(t); },0); }
function levelSoonMin(lv){ return (lv.topics||[]).filter(function(id){ return !BYID[id] && SOON[id]; }).reduce(function(s,id){ return s+(SOON[id].minutes||0); },0); }
function levelDone(lv){ return levelBuilt(lv).filter(isComplete).length; }
function posIn(t){ var lv=LV_OF[t.id]; if(!lv) return null; var all=levelTopics(lv); return {lv:lv, k:all.indexOf(t.id)+1, n:(lv.topics||[]).length, optional:(lv.optional||[]).indexOf(t.id)>=0}; }
function topicKicker(t){ var p=posIn(t); if(!p) return 'Topic'; return 'Level '+p.lv.no+' · '+p.lv.title+' · '+(p.optional? 'optional topic' : 'topic '+p.k+' of '+p.n); }

/* films: live films for a topic; Level 0 lists its intro films explicitly */
function filmFor(topic){ var xs=FILMS.filter(function(f){ return f.topic===topic; }); return xs.filter(function(f){ return f.status==='live'; })[0]||xs[0]||null; }
function filmsFor(t){
  var lv=LV_OF[t.id], specs=(lv && lv.films && lv.topics[0]===t.id)? lv.films : [{topic:t.id, title:(PG.films_planned||{})[t.id]||null}];
  var out=[];
  specs.forEach(function(s){
    var f=filmFor(s.topic);
    if(f && f.status==='live') out.push({live:true, f:f});
    else if(f || s.title) out.push({live:false, title:(f&&f.title)||s.title});
  });
  return out;
}
function liveFilm(t){ return filmsFor(t).filter(function(x){ return x.live; }).length>0; }
function fmtSec(s){ s=Math.round(s||0); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }

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
    return {id:m.id, type:'q', kicker:'From the questions · '+label(t), title:q.q, text:q.scenario||'', choices:opts, answer:String(q.answer), why:q.why, cite:q.law||null, _miss:m.id};
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

/* session planner: warm-up, then the next beats */
function plan(budget){
  var out=[], left=budget;
  if(warmDue() && left>=2){ out.push({kind:'warmup', m:2, href:'#/warmup', label:'Warm-up', sub:'replay what you missed'}); left-=2; }
  for(var i=0;i<PATH.length;i++){
    var t=PATH[i]; if(isComplete(t)) continue;
    var bs=counted(t);
    for(var j=0;j<bs.length;j++){
      var b=bs[j].id; if(beatDone(t,b)) continue;
      var m=beatMin(t,b);
      if(m>left) return out;
      out.push({kind:'beat', m:m, href:hrefFor(t,b), label:bs[j].n, sub:t.title}); left-=m;
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
  if((p[0]==='m'||p[0]==='soon') && SOON[p[1]]) return {view:'soon', id:p[1]};
  if(p[0]==='shift'){ var s=SHIFTS.filter(function(x){ return String(x.no)===p[1]; })[0]; if(s) return {view:'shift', s:s}; }
  if(p[0]==='warmup') return {view:'warmup'};
  if(p[0]==='evidence') return {view:'evidence'};
  if(p[0]==='programme') return {view:'programme'};
  return {view:'hub'};
}
function stopTimers(){ TIMERS.forEach(function(x){ clearInterval(x); clearTimeout(x); }); TIMERS=[]; }
function render(focusMain){
  if(curExplainer){ try{ curExplainer.destroy(); }catch(e){} curExplainer=null; }
  if(curRound){ try{ curRound.destroy(); }catch(e){} curRound=null; }
  stopTimers();
  var r=route();
  ({module:function(){ moduleView(r.t, r.step); }, soon:function(){ soonView(r.id); }, shift:function(){ shiftView(r.s); },
    warmup:warmView, evidence:evidenceView, programme:programmeView, hub:hubView})[r.view]();
  if(focusMain!==false){
    var h=APP.querySelector('h1'); if(h){ h.setAttribute('tabindex','-1'); h.focus({preventScroll:false}); }
    window.scrollTo(0,0);
    /* a first-run coach is a modal step: it takes focus (and scrolls into view) */
    var ch=APP.querySelector('.rr-coach h4'); if(ch) ch.focus();
  }
}

/* ═══ PROGRAMME PAGE (the path) ═════════════════════════════════════ */
function totalMin(){ return LEVELS.reduce(function(s,lv){ return s+levelMin(lv); },0); }
function overviewHTML(open){
  var P=PG.programme||{};
  var lvl=LEVELS.map(function(lv){ return '<li><b>Level '+lv.no+' · '+esc(lv.title)+'</b> <span>about '+levelMin(lv)+' min'+(levelSoonMin(lv)? ' now, more coming' : '')+'. '+esc(lv.audience)+'</span></li>'; }).join('');
  var body='<div class="ov">'
    +'<div class="ov-c"><h3>Who it is for</h3><p>'+esc(P['for'])+'</p></div>'
    +'<div class="ov-c"><h3>What you will be able to do</h3><ul>'+(P.outcomes||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>'
    +'<div class="ov-c"><h3>Three levels</h3><ul class="ov-lv">'+lvl+'</ul></div>'
    +'<div class="ov-c"><h3>What you get</h3><ul>'+(P.get||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>'
    +'</div><p class="fine" style="margin-top:10px">'+esc(P.note)+' <a href="#/programme">The programme on one page</a>.</p>';
  if(open) return '<section class="sec" aria-labelledby="ovH"><h2 id="ovH">About the programme</h2>'+body+'</section>';
  return '<section class="sec"><details class="more ovd"><summary>About the programme: who it is for, what you get</summary><div>'+body+'</div></details></section>';
}
function hubView(){
  document.title='RegRadar Academy: AMLR programme';
  var started=TR.some(function(t){ return beatsDone(t)>0; }), nt=nextStep(), warm=warmDue(), wc=warm? warmCards().length : 0;
  var doneN=PATH.filter(isComplete).length;
  var html='<header class="head ph rr-band"><div><div class="kicker">REGRADAR ACADEMY</div><h1>'+esc((PG.programme||{}).title||'AMLR programme')+'</h1>'
    +'<p>One path through the EU Anti-Money Laundering Regulation, in three levels. Short films, questions, games and the law text, topic by topic. '
    +'About '+totalMin()+' minutes in all so far. Fictional examples only.</p></div></header>';
  html+='<div id="promo" class="banner" hidden></div>';

  /* where you are, and the one Next */
  if(nt){
    var lv=LV_OF[nt.t.id], bs=counted(nt.t), k=bs.map(function(b){ return b.id; }).indexOf(nt.step), bn=bs[k]? bs[k].n : 'Read the law';
    var kick=started? 'You are here · '+topicKicker(nt.t) : 'Start here · Level '+lv.no+' · about '+levelMin(lv)+' min, no prior knowledge';
    var head=started? bn+': '+nt.t.title : nt.t.title;
    var sub=started? 'Beat '+(k+1)+' of '+bs.length+', about '+beatMin(nt.t,nt.step)+' min. '+doneN+' of '+PATH.length+' topics complete.' : (liveFilm(nt.t)? 'Watch a short film' : 'Watch a short explainer')+', answer four questions, play one round, make one decision and read the law. No sign-up: progress is saved on this device.';
    html+='<section class="card next" aria-labelledby="nxH"><div class="next-t"><div class="k">'+esc(kick)+'</div><h2 id="nxH">'+esc(head)+'</h2><p>'+esc(sub)+'</p>'+rankLine()+'</div>'
      +'<div class="next-a"><a class="btn pri big" href="'+hrefFor(nt.t,nt.step)+'">'+(started?'Next':'Start')+' <span aria-hidden="true">→</span></a>'
      +(warm? '<a class="btn sm" href="#/warmup">Warm up first · 2 min</a>' : '')+'</div></section>';
    if(warm) html+='<p class="fine warmnote">Warm-up: '+plural(wc,'card')+' you missed before, replayed once per session.</p>';
  }else{
    html+='<section class="card next" aria-labelledby="nxH"><div class="next-t"><div class="k">Path complete</div><h2 id="nxH">All '+PATH.length+' available topics done</h2>'
      +'<p>Your record is ready. Topics marked coming soon will be added to the path when they are built.</p>'+rankLine()+'</div><div class="next-a"><a class="btn pri big" href="#/evidence">Your evidence <span aria-hidden="true">→</span></a>'
      +(warm? '<a class="btn sm" href="#/warmup">Warm up · 2 min</a>' : '')+'</div></section>';
  }

  html+=overviewHTML(!started);

  /* the path: three levels */
  html+='<section class="sec" aria-labelledby="pathH"><h2 id="pathH">The path</h2><ol class="levels">'+LEVELS.map(function(lv){ return levelHTML(lv,nt); }).join('')
    +'<li class="lvl lvl-end"><div class="lvl-h"><span class="lvl-no" aria-hidden="true">✓</span><div><h3><a href="#/evidence">Evidence</a></h3><p>Your completion record, a printable certificate and the team register. Self-attested.</p></div>'
    +'<span class="chip'+(nt?'':' acc')+'">'+(nt? 'after the last topic' : 'ready')+'</span></div></li></ol></section>';

  /* below: planner, rank, glossary */
  var budget=AP.pref('budget',30);
  html+='<section class="sec"><details class="more"><summary>Plan a session (15, 30 or 60 minutes)</summary><div>'
    +'<p style="margin-top:4px">Pick a slot: the session is built from a warm-up and your next beats. Minute estimates are defaults.</p>'
    +'<div class="seg" role="group" aria-label="Time budget">'+[15,30,60].map(function(m){ return '<button type="button" data-act="budget" data-m="'+m+'" aria-pressed="'+(budget===m)+'">'+m+' min</button>'; }).join('')+'</div>'
    +budgetPlan(budget)+'</div></details>'
    +rankDetails()
    +'<p class="fine" style="margin-top:12px">Look up a term any time in the <a href="glossary.html">glossary</a>.</p></section>';
  APP.innerHTML=html;
  var ob=APP.querySelector('details.ovd'); if(ob && sget('regradar-academy-ov')==='open') ob.open=true;
}
function rankLine(){
  if(!SH) return '';
  return '<p class="fine rk">'+SH.xp.toLocaleString('en-US')+' XP · practice rank '+esc(SH.rank.n.charAt(0)+SH.rank.n.slice(1).toLowerCase())+'</p>';
}
function rankDetails(){
  if(!SH) return '';
  var r=SH.rank, nx=SH.ranks.find(function(x){ return x.xp>SH.xp; });
  return '<details class="more"><summary>XP, rank and skills</summary><div>'
    +'<p style="margin-top:4px">'+SH.xp.toLocaleString('en-US')+' XP'+(nx? ' · '+(nx.xp-SH.xp).toLocaleString('en-US')+' XP to '+esc(nx.n) : ' · top rank')+'. Ranks are named after roles in the fictional CF Bank simulation; XP amounts are defaults.</p>'
    +'<ol class="ladder">'+SH.ranks.map(function(x){ return '<li'+(x.n===r.n?' class="here" aria-current="true"':'')+'><b>'+esc(x.n)+'</b> <span>from '+x.xp.toLocaleString('en-US')+' XP'+(x.n===r.n?' (you are here)':'')+'</span></li>'; }).join('')+'</ol>'
    +'<ul class="skills">'+SH.skills.map(function(s){ return '<li><b>'+esc(s.n)+'</b><span>'+esc(s.name)+'</span></li>'; }).join('')+'</ul></div></details>';
}
function levelHTML(lv,nt){
  var built=levelBuilt(lv), done=levelDone(lv), soonN=(lv.topics||[]).filter(function(id){ return !BYID[id]; }).length;
  var complete=built.length && done===built.length, here=nt && LV_OF[nt.t.id]===lv;
  var meta='about '+levelMin(lv)+' min'+(soonN? ' · '+soonN+' coming soon' : '');
  var h='<li class="lvl'+(here?' here':'')+(complete?' done':'')+'" id="level-'+lv.no+'"><div class="lvl-h"><span class="lvl-no" aria-hidden="true">'+(complete?'✓':lv.no)+'</span>'
    +'<div><h3>Level '+lv.no+' · '+esc(lv.title)+'</h3><p>'+esc(lv.summary)+'</p><p class="aud">'+esc(lv.audience)+'</p></div>'
    +'<span class="chip'+(complete?' ok':here?' acc':'')+'">'+done+' of '+built.length+' done · '+esc(meta)+'</span></div>'
    +'<ol class="path">'+levelTopics(lv).map(function(id,k){ return topicRow(id,k,lv,nt); }).join('')+'</ol>';
  if((lv.rooms||[]).length) h+='<div class="rooms-h"'+(lv.no===0?' id="practice-rooms"':'')+'><h4>Practice rooms <span class="chip">optional</span></h4><p class="fine">Longer simulations at a fictional bank, CF Bank. They deepen the level; the path does not need them.</p></div>'
    +'<div class="rooms">'+lv.rooms.map(roomHTML).join('')+'</div>';
  return h+'</li>';
}
function topicRow(id,k,lv,nt){
  var opt=(lv.optional||[]).indexOf(id)>=0;
  if(!BYID[id]){
    var s=SOON[id]||{title:id,short:''};
    return '<li class="trk st-soon"><div class="trk-no" aria-hidden="true">'+(k+1)+'</div><div><h3><a href="#/soon/'+id+'">'+esc(s.title)+'</a></h3><p>'+esc(s.short)+'</p>'
      +'<div class="trk-meta"><span class="chip warn">Coming soon</span><span class="chip">planned, about '+(s.minutes||10)+' min</span></div></div></li>';
  }
  var t=BYID[id], done=isComplete(t), isNext=nt&&nt.t===t, bs=counted(t);
  var cls=done?'st-done':isNext?'st-next':'st-open';
  var dots='<span class="dots" aria-hidden="true">'+bs.map(function(b){ return '<i class="'+(beatDone(t,b.id)?'on':'')+'" title="'+esc(b.n)+'"></i>'; }).join('')+'</span>';
  var status=done?'<span class="chip ok">Complete</span>':isNext?'<span class="chip acc">Next up</span>':beatsDone(t)?'<span class="chip">'+beatsDone(t)+' of '+bs.length+' beats</span>':'';
  var film=filmsFor(t), fl=film.filter(function(x){ return x.live; });
  var fchip=fl.length? '<span class="chip vio">'+(fl.length>1? fl.length+' films' : 'Film '+fmtSec(fl[0].f.seconds))+'</span>' : film.length? '<span class="chip">Film in production</span>' : '';
  return '<li class="trk '+cls+'"><div class="trk-no" aria-hidden="true">'+(done?'✓':k+1)+'</div><div><h3><a href="'+hrefFor(t)+'"'+(isNext?' aria-current="step"':'')+'>'+esc(t.title)+'</a>'
    +(isNext?'<span class="sr"> (next up)</span>':'')+'</h3><p>'+esc(t.short)+'</p>'
    +'<div class="trk-meta"><span class="chip">about '+lessonMin(t)+' min</span>'+(opt?'<span class="chip">Optional</span>':'')+fchip+dots+status+'</div></div></li>';
}
function roomHTML(id){
  var r=ROOMS[id]; if(!r) return '';
  if(r.shift){ var s=SHIFTS.filter(function(x){ return x.no===r.shift; })[0]; if(!s) return '';
    var sd=shiftDone(s);
    return '<a class="room" href="#/shift/'+s.no+'"><b>'+esc(roomTitle(s))+(sd?' <span class="tick">✓</span><span class="sr"> (worked)</span>':'')+'</b><span>'+esc(s.room)+', about '+s.minutes+' min. '+esc(s.blurb.split('. ')[0])+'.</span></a>'; }
  var d=SH && r.module && ((SH.progress.modules[r.module]||{}).done||0)>0;
  return '<a class="room" href="'+esc(r.href)+'"><b>'+esc(r.title)+(d?' <span class="tick">✓</span><span class="sr"> (played)</span>':'')+'</b><span>About '+r.minutes+' min. '+esc(r.blurb)+'</span></a>';
}
function budgetPlan(b){
  var p=plan(b);
  if(!p.length) return '<p class="fine" style="margin-top:12px">'+(nextStep()? 'The next step takes longer than '+b+' minutes: pick a longer slot, or just press Next.' : 'Nothing left to plan: every available topic is done.')+'</p>';
  var tot=p.reduce(function(s,x){ return s+x.m; },0);
  return '<p class="fine" style="margin-top:12px">Your '+b+'-minute session: '+plural(p.length,'step')+', about '+tot+' min.</p><ol class="plan">'
    +p.map(function(x){ return '<li class="k-'+x.kind+'"><a href="'+x.href+'"><span><b>'+esc(x.label)+'</b> <span class="w">'+esc(x.sub)+'</span></span><span class="m">'+x.m+' min</span></a></li>'; }).join('')+'</ol>';
}
function quizAvg(){
  var g=AP.get().modules, xs=[];
  Object.keys(g).forEach(function(id){ var c=g[id].steps&&g[id].steps.check; if(c&&c.passed&&c.max) xs.push(c.best/c.max); });
  if(!xs.length) return null;
  return Math.round(100*xs.reduce(function(a,b){return a+b;},0)/xs.length);
}

/* ═══ PROGRAMME SUMMARY (one page, from the data) ═══════════════════ */
function programmeView(){
  document.title='AMLR programme at a glance | RegRadar Academy';
  var P=PG.programme||{}, soonTot=0;
  var html='<a class="crumb noprint" href="#/">← The path</a><header class="mhead"><div class="kicker">REGRADAR ACADEMY · PROGRAMME</div><h1>'+esc(P.title||'AMLR programme')+' at a glance</h1>'
    +'<p class="lede">'+esc(P['for'])+'</p>'
    +'<div class="meta"><span class="chip">'+esc(P.law)+'</span><span class="chip">Content version '+esc(CUR_META.content_version)+' · '+esc(fmtDate(CUR_META.content_date))+'</span><span class="chip">about '+totalMin()+' min available</span></div></header>';
  html+='<section class="panel sum" aria-labelledby="sumH"><h2 id="sumH" class="sr">Levels and topics</h2>';
  LEVELS.forEach(function(lv){
    soonTot+=levelSoonMin(lv);
    html+='<h3 class="sum-l">Level '+lv.no+' · '+esc(lv.title)+' <span>about '+levelMin(lv)+' min'+(levelSoonMin(lv)? ' (+ about '+levelSoonMin(lv)+' min planned)' : '')+'</span></h3><p class="fine">'+esc(lv.audience)+'</p>'
      +'<div class="tw"><table class="sumt"><thead><tr><th scope="col">Topic</th><th scope="col">In the flow</th><th scope="col">Minutes</th><th scope="col">Status</th></tr></thead><tbody>'
      +levelTopics(lv).map(function(id){
        var opt=(lv.optional||[]).indexOf(id)>=0;
        if(!BYID[id]){ var s=SOON[id]; return '<tr><th scope="row">'+esc(s.title)+'<span>'+esc(s.short)+'</span></th><td>Law excerpt now; film, questions, Spot it, Decide planned</td><td>about '+(s.minutes||10)+'</td><td>Coming soon</td></tr>'; }
        var t=BYID[id], fl=filmsFor(t).filter(function(x){ return x.live; });
        var parts=counted(t).map(function(b){ return b.id==='watch'? (fl.length? 'Film and explainer' : 'Explainer') : b.n; });
        return '<tr><th scope="row">'+esc(t.title)+(opt?' (optional)':'')+'<span>'+esc(t.short)+'</span></th><td>'+esc(parts.join(', '))+'</td><td>about '+lessonMin(t)+'</td><td>Available</td></tr>';
      }).join('')+'</tbody></table></div>';
    var rs=(lv.rooms||[]).map(function(id){ var r=ROOMS[id]; if(!r) return ''; if(r.shift){ var s=SHIFTS.filter(function(x){ return x.no===r.shift; })[0]; return s? s.room+' ('+roomTitle(s).toLowerCase()+')' : ''; } return r.title; }).filter(Boolean);
    if(rs.length) html+='<p class="fine" style="margin-top:6px">Optional practice rooms: '+esc(rs.join('; '))+'.</p>';
  });
  html+='<h3 class="sum-l">Evidence</h3><ul class="learn">'+(P.get||[]).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
    +'<p class="fine" style="margin-top:12px">Every topic: four questions with a pass mark of 3 of 4 (default), one Spot it round, one Decide scenario and verbatim law excerpts, checked against the official text. '
    +'Minutes are default estimates from the content files'+(soonTot? '; about '+soonTot+' more minutes are planned in topics marked coming soon' : '')+'. '+esc(P.note)+'</p>'
    +'<div class="tools noprint"><button type="button" class="btn sm" data-act="print">Print or save as PDF</button><a class="btn sm" href="#/">Back to the path</a></div></section>';
  APP.innerHTML=html;
}

/* ═══ EVIDENCE (end of the path) ════════════════════════════════════ */
function evidenceView(){
  document.title='Evidence | RegRadar Academy';
  var g=AP.get(), q=quizAvg(), a12=(CUR_META.evidence||{}).art12, done=PATH.filter(isComplete).length;
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">The last step · Evidence</div><h1>Your training record</h1>'
    +'<div class="meta"><span class="chip'+(done===PATH.length?' ok':'')+'">'+done+' of '+PATH.length+' topics complete</span><span class="chip">Last activity: '+(g.updated? esc(fmtDate(g.updated)) : 'not started')+'</span></div></header>';
  html+='<section class="panel" aria-labelledby="evH"><h2 id="evH">What is recorded</h2>'
    +'<p class="lede">Each completed topic is saved in this browser with its date, best score and the content version. Average best score: '+(q==null?'none yet':q+'% (pass mark 75%, default)')+'.</p>'
    +'<ul class="evl">'+LEVELS.map(function(lv){ var b=levelBuilt(lv); return '<li><b>Level '+lv.no+' · '+esc(lv.title)+'</b><span>'+levelDone(lv)+' of '+b.length+' topics</span></li>'; }).join('')+'</ul>'
    +(a12? '<div class="q"><div class="q-h"><b>'+esc(lawName(a12))+', Article 12, '+esc(a12.para)+'</b><span>Why records matter</span></div><blockquote>'+esc(a12.quote)+'</blockquote><div class="q-f"><span>Verbatim, checked by script</span><a href="'+lawUrl(a12)+'">Read the full article</a></div></div>' : '')
    +'<div class="rooms" style="margin-top:16px">'
    +'<a class="room" href="academy-certificate.html"><b>Your certificate</b><span>Print or save a record of the topics you completed, with dates, scores and an integrity code. Self-attested.</span></a>'
    +'<a class="room" href="academy-register.html"><b>Team register</b><span>For compliance officers: merge several learners\' files, see who is overdue, print an evidence pack.</span></a></div>'
    +'<p class="fine" style="margin-top:10px">Documented training is what AMLR Art. 12 asks for. These records are self-attested, kept on the learner\'s device and are not an accredited or regulator-approved certificate.</p>'
    +'<div class="tools"><button type="button" class="btn sm" data-act="csv">Export completions (CSV)</button>'
    +'<button type="button" class="btn sm" data-act="reset">Clear training records on this device</button></div></section>';
  APP.innerHTML=html;
}

/* ═══ COMING SOON ═══════════════════════════════════════════════════ */
function soonView(id){
  var s=SOON[id], lv=LV_OF[id];
  document.title=s.title+' | RegRadar Academy';
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">Level '+lv.no+' · '+esc(lv.title)+'</div><h1>'+esc(s.title)+'</h1>'
    +'<div class="meta"><span class="chip warn">Coming soon</span><span class="chip">planned, about '+(s.minutes||10)+' min</span></div></header>';
  html+='<section class="panel" aria-labelledby="snH"><h2 id="snH">What this topic will cover</h2><p class="lede">'+esc(s.short)+'</p>'
    +'<p class="fine" style="margin-top:10px">Still to build, through the same script and fact-check gate as every topic: '+esc(s.missing.join(', '))+'.</p>'
    +'<h3 class="h3">Read the law now</h3>'+lawBlocks(s.law)+relatedHTML(id)
    +'<div class="foot-act"><a class="btn" href="#/">Back to the path</a>'+(nextStep()? '<a class="btn pri" href="'+hrefFor(nextStep().t,nextStep().step)+'">Continue the path <span aria-hidden="true">→</span></a>' : '<a class="btn pri" href="#/evidence">Evidence <span aria-hidden="true">→</span></a>')+'</div></section>';
  APP.innerHTML=html;
  lawVerify(s.law);
}

/* ═══ PRACTICE ROOM (Shift) ═════════════════════════════════════════ */
function deskDays(){ try{ var D=window.AcademyEngine&&window.AcademyEngine.Desk; if(D){ D.load(); return (D.S.done||[]).length; } }catch(e){} return 0; }
function shiftDone(s){ var m=AP.pref('shifts',{})||{}; return !!m[s.no] || deskDays()>=s.desk_days; }
function shiftLevel(s){ for(var i=0;i<LEVELS.length;i++){ if((LEVELS[i].rooms||[]).some(function(id){ return ROOMS[id]&&ROOMS[id].shift===s.no; })) return LEVELS[i]; } return null; }
function isPhone(){ try{ return window.matchMedia('(max-width: 899px)').matches; }catch(e){ return false; } }
function roomTitle(s){ var x=s.title.replace(/^Shift \d+: /,''); return x.charAt(0).toUpperCase()+x.slice(1); }
function shiftView(s){
  document.title=s.title+' | RegRadar Academy';
  var lv=shiftLevel(s), done=shiftDone(s), phone=isPhone()&&s.desktop_only;
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">Practice room · optional'+(lv? ' · end of Level '+lv.no+' · '+esc(lv.title) : '')+'</div><h1>'+esc(roomTitle(s))+'</h1>'
    +'<div class="meta"><span class="chip">about '+s.minutes+' min</span>'+(done?'<span class="chip ok">Worked</span>':'<span class="chip">Not worked yet</span>')+'<span class="chip">Fictional cases</span></div></header>';
  html+='<section class="panel" aria-labelledby="shH"><h2 id="shH">'+esc(s.room)+'</h2><p class="lede">'+esc(s.blurb)+'</p>'
    +'<p class="fine" style="margin-top:8px">The simulation is set in a fictional bank, CF Bank. The judgement it trains (how much diligence a case needs, when to escalate) is the same in any obliged entity.</p>';
  if(phone) html+='<div class="callout warn">The workstation needs a bigger screen. On this device, play the next day at the Desk instead.</div>';
  html+='<div class="foot-act"><button type="button" class="btn" data-act="shiftdone" data-n="'+s.no+'" aria-pressed="'+done+'">'+(done?'Marked as worked':'Mark as worked')+'</button>'
    +'<a class="btn pri big" href="'+esc(phone&&s.alt_href? s.alt_href : s.href)+'">Open '+esc(phone&&s.alt_href? 'the Desk' : s.room)+' <span aria-hidden="true">→</span></a></div>'
    +'<p class="fine" style="margin-top:10px">Ticked automatically once you have worked '+s.desk_days+' days at the Desk (the Desk and the workstation share one journal), or mark it yourself. Practice rooms never block the path.</p></section>';
  APP.innerHTML=html;
}

/* ═══ WARM-UP ═══════════════════════════════════════════════════════ */
function warmView(){
  document.title='Warm-up | RegRadar Academy';
  var cards=warmCards();
  var html='<a class="crumb" href="#/">← The path</a><header class="mhead"><div class="kicker">Warm-up · about 2 minutes</div><h1>Replay what you missed</h1>'
    +'<p class="lede">'+(cards.length? plural(cards.length,'card')+' you got wrong before. Get one right and it leaves the list. No score is kept.' : 'Nothing to replay: you have no missed cards or questions.')+'</p></header>';
  html+='<section class="panel" aria-labelledby="wuH"><h2 id="wuH" class="sr">Warm-up round</h2><div id="rrHost"></div>'+(cards.length?'':'<div class="foot-act"><span></span><a class="btn pri" href="#/">Back to the path</a></div>')+'</section>';
  APP.innerHTML=html;
  if(!cards.length||!RD) return;
  var nt=nextStep();
  var g={id:'warmup', type:cards[0].type, title:'Warm-up', cards:cards, remember:[], law:[]};
  curRound=RD.mount(document.getElementById('rrHost'), g, {mode:'warmup', tutorials:TUT, lawUrl:lawUrl, citeText:citeText,
    onAnswer:function(c,ok){ if(!c._miss) return; if(ok) MS.clear(c._miss); else MS.add(c._miss, c.module||'', 'card'); },
    onDone:function(){ sset('regradar-academy-warmup','done'); },
    nextLabel: nt? 'Continue: '+nt.t.title : 'Back to the path',
    onNext:function(){ location.hash= nt? hrefFor(nt.t, nt.step) : '#/'; }});
}

/* ═══ TOPIC FLOW ════════════════════════════════════════════════════ */
function relatedHTML(id){
  var m=(MAP.modules||{})[id]||{}, ids=(m.obligations||(SOON[id]&&SOON[id].related)||[]).filter(function(x){ return OBL[x]; });
  if(SOON[id]) ids=(SOON[id].related||[]).filter(function(x){ return OBL[x]; });
  var h='<h3 class="h3">Related in Max</h3>';
  if(!ids.length) h+='<p class="lede">No obligation in the Max register maps to this topic yet'+(m.note?': '+esc(m.note.replace(/\.$/,'')):'')+'.</p>';
  else h+='<p class="lede">Max is the RegRadar compliance workspace. These obligations in its register are the ones this topic trains on:</p><ul class="mx">'
    +ids.map(function(x){ var o=OBL[x]; return '<li><a href="workspace.html?open='+encodeURIComponent(x)+'"><b>'+esc(o.legal_basis)+'</b><span>'+esc((o.what||'').slice(0,160))+((o.what||'').length>160?'…':'')+'</span></a></li>'; }).join('')+'</ul>'
    +(m.note?'<p class="fine" style="margin-top:6px">'+esc(m.note)+'</p>':'');
  h+='<p class="fine" style="margin-top:8px">'+(HAS_TOPICS? 'All AMLR topics in Max: <a href="topics.html">Topics</a>.' : 'A topic overview in Max is planned; until then, open the register from the links above.')+'</p>';
  return h;
}
function stepperHTML(t,cur){
  return beats(t).map(function(s,k){ var d=beatDone(t,s.id);
    return '<li><a href="'+hrefFor(t,s.id)+'"'+(s.id===cur?' aria-current="step"':'')+'>'+(k+1)+'. '+s.n
      +(d?' <span class="tick" aria-hidden="true">✓</span><span class="sr"> done</span>':'')+'</a></li>'; }).join('');
}
function moduleView(t, stepId){
  var list=beats(t);
  document.title=t.title+' | RegRadar Academy';
  var n=nextStep();
  if(!stepId || !list.some(function(s){ return s.id===stepId; })) stepId=(n&&n.t===t)? n.step : 'watch';
  var html='<a class="crumb" href="#/">← The path</a>';
  html+='<header class="mhead"><div class="kicker">'+esc(topicKicker(t))+'</div><h1>'+esc(t.title)+'</h1>'
    +'<div class="meta"><span class="chip">about '+lessonMin(t)+' min</span>'+(isComplete(t)?'<span class="chip ok">Complete</span>':'<span class="chip acc">'+beatsDone(t)+' of '+counted(t).length+' beats</span>')+'<span class="chip">Fictional examples</span></div>'
    +(NOTES[t.id]? '<p class="fine" style="margin-top:8px">'+esc(NOTES[t.id])+'</p>' : '')+'</header>';
  html+='<div id="promo" class="banner" hidden></div>';
  html+='<ol class="stepper" aria-label="Beats in this topic">'+stepperHTML(t,stepId)+'</ol>';
  html+='<section class="panel" id="panel" aria-labelledby="pnH">'+panel(t,stepId,list)+'</section>';
  APP.innerHTML=html;
  afterPanel(t,stepId);
}
function nextOf(t,stepId,list){ var k=list.map(function(s){ return s.id; }).indexOf(stepId); return list[k+1]||null; }
function numOf(t,stepId){ return beats(t).map(function(s){ return s.id; }).indexOf(stepId)+1; }
function footer(t,stepId,list,opts){
  opts=opts||{}; var nx=nextOf(t,stepId,list);
  var lab=opts.label || (nx? 'Next: '+nx.n : 'Back to the path');
  return '<div class="foot-act"><span class="fine">'+(opts.note||'')+'</span><button type="button" class="btn pri" data-act="next" data-step="'+stepId+'"'+(opts.disabled?' disabled':'')+'>'+esc(lab)+' <span aria-hidden="true">→</span></button></div>';
}
function panel(t,stepId,list){ return ({watch:watchP,spot:spotP,decide:decideP,check:checkP,law:lawP,max:maxP}[stepId])(t,list); }

/* 1. watch: film(s) and/or the explainer, then what goes wrong */
var WATCHED='<div class="callout ok">Watched. Read what goes wrong below, then carry on.</div>';
function watchP(t,list){
  var d=AP.stepDone(t.id,'watch'), r=t.risks, films=filmsFor(t), live=films.filter(function(x){ return x.live; });
  var cons=r.consequences.map(function(c){ return '<li>'+esc(c.text)+(c.cite?' <a class="cite" href="'+lawUrl(c.cite)+'">'+esc(citeText(c.cite))+'</a>':'')+'</li>'; }).join('');
  var exSec=Math.round((EXP[t.explainer]&&EX? EX.duration(EXP[t.explainer]) : 75));
  var h='<h2 id="pnH">'+numOf(t,'watch')+'. Watch: '+esc(t.title)+'</h2>'
    +'<p class="lede">'+(live.length? (live.length>1? 'Two short films, then a step-by-step explainer.' : 'A short film, then a step-by-step explainer.')+' Every film and explainer has captions and a text version.' : 'About '+exSec+' seconds. Every step has a text caption, and the full text is under the player.')+'</p>'
    +'<ul class="learn">'+t.learn.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>';
  if(films.length) h+='<div class="films">'+films.map(function(x,k){
    if(x.live) return '<figure class="film"><figcaption><b>'+esc(x.f.title)+'</b> <span>'+fmtSec(x.f.seconds)+' · film</span></figcaption><div class="film-host" data-film="'+k+'"></div>'
      +'<p class="fine"><a href="'+esc(x.f.page)+'">Open the film on its own page</a> (full transcript, scene by scene).</p></figure>';
    return '<div class="film soon"><b>'+esc(x.title)+'</b><span>Film in production: its script has passed the fact-check gate. The explainer below covers the same ground.</span></div>';
  }).join('')+'</div>';
  h+=(live.length? '<h3 class="h3">Step-through explainer · about '+exSec+' s</h3>' : '')
    +'<div id="exHost" style="margin-top:14px"></div>'
    +'<div id="watchNote">'+(d? WATCHED : '<div class="callout">'+(live.length? 'Watch a film to the end, or step through the explainer, to tick this one off.' : 'Watch to the last step (or step through it) to tick this one off.')
      +(live.length? ' <button type="button" class="btn sm" data-act="watched">I have watched it</button>' : '')+'</div>')+'</div>'
    +'<h3 class="h3">Before you play: the risks</h3>'
    +'<div class="rgrid"><div class="rcol w"><h3>What goes wrong</h3><ul>'+r.wrong.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div>'
    +'<div class="rcol c"><h3>Consequences</h3><ul>'+cons+'</ul></div>'
    +'<div class="rcol f"><h3>Red flags</h3><ul>'+r.redflags.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul></div></div>'
    +'<p class="fine" style="margin-top:10px">Red-flag lists are illustrative, not exhaustive, and are not legal statements. Legal consequences cite the text.</p>'
    +footer(t,'watch',list,{note:'Fictional examples. The law text is in a later beat.'});
  return h;
}
function markWatched(t){
  var r=AP.step(t.id,'watch'); if(r.first) award(XP_DEF.watch,'watching');
  var n=document.getElementById('watchNote'); if(n) n.innerHTML=WATCHED;
  if(r.completed) completedNow(t); refreshStepper(t,'watch');
}
/* Films are embedded by same-origin iframe of the film page; the frame shows only the player.
   If the frame cannot be read, the plain page link under it still works. */
var EMBED_CSS='body>*:not(main){display:none!important}main.wrap{max-width:none!important;padding:0!important;margin:0!important}'
  +'main>.intro,main>.transcript,main>.fine,main>.block.transcript{display:none!important}.player{box-shadow:none!important}main>.note{margin:8px 4px 2px!important}';
function mountFilm(host, f, k, onEnd){
  var fr=document.createElement('iframe');
  fr.className='film-frame'; fr.title='Film: '+f.title; fr.src=f.page; fr.setAttribute('scrolling','no');
  host.appendChild(fr);
  fr.addEventListener('load', function(){
    var d=null; try{ d=fr.contentDocument; }catch(e){}
    if(!d || !d.head || !d.querySelector('.player')){ host.innerHTML='<p class="callout warn">The film could not be embedded here. <a href="'+esc(f.page)+'">Open it on its own page</a>.</p>'; return; }
    var st=d.createElement('style'); st.textContent=EMBED_CSS; d.head.appendChild(st);
    var size=function(){ try{ fr.style.height=Math.ceil(d.documentElement.scrollHeight)+'px'; }catch(e){} };
    size(); TIMERS.push(setTimeout(size,300), setTimeout(size,1200));
    try{ var RO=fr.contentWindow.ResizeObserver; if(RO){ var ro=new RO(size); ro.observe(d.body); } }catch(e){}
    /* only the first film may start on its own */
    if(k>0) TIMERS.push(setTimeout(function(){ var b=d.getElementById('play'); if(b && /pause/i.test(b.getAttribute('aria-label')||'')) b.click(); }, 900));
    var iv=setInterval(function(){
      var s=d.querySelector('input[type="range"]'); if(!s) return;
      if(+s.max>0 && +s.value>=+s.max*0.97){ clearInterval(iv); onEnd(); }
    }, 600);
    TIMERS.push(iv);
  });
}
function appliesNote(){ return RMETA.applies? '<p class="fine" style="margin-top:6px">'+esc(RMETA.applies)+'</p>' : ''; }
/* 3. spot it */
function spotP(t,list){
  var g=GAMES[t.id], s=(AP.get().modules[t.id]||{steps:{}}).steps.spot;
  return '<h2 id="pnH">'+numOf(t,'spot')+'. Spot it: '+esc(g.title)+'</h2><p class="lede">'+esc(g.intro)+' About '+(g.minutes||2)+' min.'+(s?' Your best: '+s.best+' of '+s.max+'.':'')+'</p>'+appliesNote()+'<div id="rrHost"></div>';
}
/* 4. decide */
function decideP(t,list){
  return '<h2 id="pnH">'+numOf(t,'decide')+'. Decide: what would you do?</h2><p class="lede">One situation, a real choice, and what happens next. About a minute. Fictional.</p>'+appliesNote()+'<div id="rrHost"></div>';
}
/* 2. questions */
function checkP(t,list){
  if(!QZ || QZ.id!==t.id) QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false,answers:[]};
  return '<h2 id="pnH">'+numOf(t,'check')+'. Questions: '+t.questions.length+' to answer</h2><p class="lede">Pass mark 3 of '+t.questions.length+' (default). Retry as often as you like. XP is awarded the first time you pass. Questions you miss come back in your warm-up.</p><div id="quiz" style="margin-top:12px"></div>';
}
function drawQuiz(t){
  var host=document.getElementById('quiz'); if(!host) return;
  var q=t.questions[QZ.i], list=beats(t), N=t.questions.length;
  if(QZ.done){
    var passed=QZ.score>=Math.ceil(N*0.75);
    host.innerHTML='<div class="card"><div class="qprog">RESULT</div><div class="score">'+QZ.score+' / '+N+'</div>'
      +'<p class="sub">'+(passed? 'Passed. This beat is ticked off.' : 'Not passed yet: you need '+Math.ceil(N*0.75)+' of '+N+'. Rewatch, then try again.')+'</p>'
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
    if(r.firstPass){ award((CUR_META.defaults.xp.question_first_try||15)*QZ.score,'passing the questions'); }
    if(r.completed) completedNow(t);
    drawQuiz(t); say('Result: '+QZ.score+' of '+N+(passed?', passed.':', not passed yet.'));
    var h=document.querySelector('#quiz .score'); if(h){ h.setAttribute('tabindex','-1'); h.focus(); }
    refreshStepper(t,'check');
    return;
  }
  QZ.i++; QZ.sel=[]; QZ.checked=false; drawQuiz(t);
  var l=document.getElementById('qLeg'); if(l) l.focus();
}
/* 5. read the law (+ optional practice) */
function lawBlocks(law){
  return law.map(function(c,k){
    return '<div class="q" data-q="'+k+'"><div class="q-h"><b>'+esc(lawName(c))+', Article '+esc(c.art)+(c.para?', '+(/^\d/.test(c.para)?'para. ':'')+esc(c.para):'')+'</b><span>'+esc(c.label)+'</span></div>'
      +'<blockquote>'+esc(c.quote)+'</blockquote>'
      +'<div class="q-f"><span><span class="ver" data-ver>Checking against the source…</span>'+(c.note?' · Note: '+esc(c.note):'')+'</span><a href="'+lawUrl(c)+'">Read the full article</a></div></div>';
  }).join('');
}
function lawP(t,list){
  var h='<h2 id="pnH">'+numOf(t,'law')+'. Read the law: what it says</h2><p class="lede">Verbatim excerpts from the official text held in this repository (docs/data/laws/). Each is re-checked against that text when you open this page. Plain-language notes are marked.</p>';
  h+=lawBlocks(t.law);
  if(t.reading&&t.reading.length) h+='<details class="more"><summary>Further reading (not quoted here)</summary><div><ul style="margin-left:18px">'+t.reading.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>Read these at the source: RegRadar does not reproduce them.</div></details>';
  if(t.practice){
    var p=t.practice, pd=AP.stepDone(t.id,'practice')||practiceAuto(t);
    h+='<div class="card deeper"><h3 style="font-size:16px">Practice room (optional): '+esc(p.label)+'</h3><p class="sub">'+esc(p.why)+' About '+p.minutes+' min. Not needed to finish the topic.</p>'
      +'<div class="tools"><a class="btn sm" href="'+esc(p.href)+'">Open the simulation</a>'
      +'<button type="button" class="btn sm" data-act="practised" aria-pressed="'+pd+'">'+(pd?'Marked as practised':'Mark as practised')+'</button></div></div>';
  }
  h+='<div class="callout warn">Prototype for training. Not legal advice. Check the current official text and your national rules and supervisor guidance.</div>';
  var missing=counted(t).filter(function(b){ return b.id!=='law' && !beatDone(t,b.id); });
  h+=footer(t,'law',list,{label: isComplete(t)? 'Next: Related in Max' : 'Finish topic', note: !isComplete(t)&&missing.length? 'Still to do: '+missing.map(function(b){ return b.n.toLowerCase(); }).join(', ')+'.' : ''});
  return h;
}
/* 6. related in Max, and where the path goes next */
function afterTopic(t){
  var n=nextStep(); if(n) return {href:hrefFor(n.t,n.step), label:(n.t===t? 'Next: '+(BEATS.filter(function(b){ return b.id===n.step; })[0]||{n:'continue'}).n : 'Next topic: '+n.t.title)};
  return {href:'#/evidence', label:'Next: Evidence'};
}
function maxP(t,list){
  var complete=isComplete(t), a=afterTopic(t), lv=LV_OF[t.id];
  var h='<h2 id="pnH">'+numOf(t,'max')+'. Related in Max</h2>';
  if(complete){
    var lvDone=lv && levelBuilt(lv).every(isComplete);
    h+='<div class="callout ok"><b>Topic complete.</b> '+(lvDone? 'You have finished every available topic in Level '+lv.no+' · '+esc(lv.title)+'.'+((lv.rooms||[]).length? ' Its practice rooms are optional, on the <a href="#level-'+lv.no+'">path</a>.' : '') : 'Your record has been updated.')+'</div>';
  }
  h+=relatedHTML(t.id);
  h+='<div class="foot-act"><a class="btn" href="#/">Back to the path</a><a class="btn pri" href="'+a.href+'">'+esc(a.label)+' <span aria-hidden="true">→</span></a></div>';
  return h;
}
function lawVerify(law){
  var cel={}; law.forEach(function(c){ cel[c.celex]=1; });
  Object.keys(cel).forEach(function(c){
    if(LAWS[c]) return;
    LAWS[c]=fetch('data/laws/'+c+'_EN.json').then(function(r){ if(!r.ok) throw 0; return r.json(); }).catch(function(){ return null; });
  });
  law.forEach(function(c,k){
    LAWS[c.celex].then(function(L){
      var el=document.querySelector('.q[data-q="'+k+'"] [data-ver]'); if(!el) return;
      var ok=false;
      if(L){ var a=L.articles.filter(function(x){ return String(x.id)===String(c.art); })[0];
        if(a){ var txt=norm(a.text); ok=c.quote.split(' […] ').every(function(p){ return txt.indexOf(norm(p))>=0; }); } }
      el.textContent= L? (ok? 'Verified against the source text' : 'Could not verify this excerpt: use the link') : 'Source file not loaded: use the link';
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
    if(host && spec && EX) curExplainer=EX.mount(host, spec, {onComplete:function(){ markWatched(t); }});
    else if(host) host.innerHTML='<p class="callout warn">The explainer could not be loaded.</p>';
    var live=filmsFor(t);
    Array.prototype.forEach.call(APP.querySelectorAll('.film-host'), function(el){
      var x=live[+el.dataset.film]; if(x&&x.live) mountFilm(el, x.f, +el.dataset.film, function(){ if(!AP.stepDone(t.id,'watch')) markWatched(t); });
    });
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
  if(stepId==='law') lawVerify(t.law);
}
function refreshStepper(t,cur){
  var el=APP.querySelector('.stepper'); if(el) el.innerHTML=stepperHTML(t,cur);
  var c=APP.querySelector('.mhead .meta .chip.acc'); if(c) c.textContent=beatsDone(t)+' of '+counted(t).length+' beats';
}
function completedNow(t){ moduleCompleted(t); say('Topic complete: '+t.title+'.'); }

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
APP.addEventListener('toggle',function(e){ if(e.target.classList && e.target.classList.contains('ovd')) sset('regradar-academy-ov', e.target.open?'open':''); }, true);
APP.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b) return;
  var act=b.dataset.act, r=route(), t=r.t;
  if(act==='csv') return csv();
  if(act==='print') return window.print();
  if(act==='reset'){
    if(window.confirm('Clear all Academy training records (topics, scores, missed cards) on this device? XP and rank are kept.')){
      AP.reset(); MS.list().forEach(function(m){ MS.clear(m.id); }); render(false); say('Training records cleared.'); }
    return;
  }
  if(act==='budget'){ AP.setPref('budget',+b.dataset.m); render(false); var dd=APP.querySelector('[data-act="budget"]'); if(dd){ dd.closest('details').open=true; var nb=APP.querySelector('[data-act="budget"][aria-pressed="true"]'); if(nb) nb.focus(); } return; }
  if(act==='shiftdone'){ var m=AP.pref('shifts',{})||{}; if(!m[b.dataset.n]){ m[b.dataset.n]={at:new Date().toISOString()}; AP.setPref('shifts',m); say('Marked as worked.'); }
    render(false); var sb=APP.querySelector('[data-act="shiftdone"]'); if(sb) sb.focus(); return; }
  if(!t) return;
  var list=beats(t);
  if(act==='watched'){ markWatched(t); return; }
  if(act==='qcheck') return qCheck(t);
  if(act==='qnext') return qNext(t);
  if(act==='retry'){ QZ={id:t.id,i:0,sel:[],checked:false,score:0,done:false}; drawQuiz(t); var l=document.getElementById('qLeg'); if(l) l.focus(); return; }
  if(act==='practised'){ if(b.getAttribute('aria-pressed')!=='true'){ AP.step(t.id,'practice',{manual:true}); } render(false); return; }
  if(act==='next'){
    var st=b.dataset.step;
    if(st==='watch'){ var rr=AP.step(t.id,'risks'); if(rr.first) award(XP_DEF.risks,'reading the risks'); if(rr.completed) completedNow(t); }
    if(st==='law'){ var lr=AP.step(t.id,'law'); if(lr.first) award(XP_DEF.law,'the law step'); if(lr.completed) completedNow(t); }
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
function exists(u){ return fetch(u,{method:'HEAD'}).then(function(r){ return r.ok; }).catch(function(){ return false; }); }
Promise.all([getJSON('data/academy/curriculum.json'), getJSON('data/academy/explainers.json'), getJSON('data/academy/module-map.json',true), getJSON('data/obligations.json',true),
  getJSON('data/academy/rounds.json',true), getJSON('data/academy/programme.json'), getJSON('data/academy/films.json',true), exists('topics.html')])
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
  PG=r[5]||{}; LEVELS=PG.levels||[]; SOON=PG.coming_soon||{}; ROOMS=PG.rooms||{}; NOTES=PG.notes||{};
  FILMS=((r[6]&&r[6].films)||[]).filter(function(f){ return f && f.id && f.topic && f.page; });
  HAS_TOPICS=!!r[7];
  LEVELS.forEach(function(lv){ levelTopics(lv).forEach(function(id){ LV_OF[id]=lv; });
    (lv.topics||[]).forEach(function(id){ if(BYID[id]) PATH.push(BYID[id]); }); });
  /* a lesson the programme does not place still shows, at the end of the last level, so no progress is hidden */
  TR.forEach(function(t){ if(!LV_OF[t.id] && LEVELS.length){ var lv=LEVELS[LEVELS.length-1]; (lv.optional=lv.optional||[]).push(t.id); LV_OF[t.id]=lv; } });
  /* new completions record the content version they were done on (certificates and the team register print it) */
  AP.setContentVersion(CUR_META.content_version);
  /* completion rule per topic: watch, risks, Spot it and Decide where they exist, questions, law.
     Topics already marked complete stay complete (AcademyProgress keeps the flag). */
  TR.forEach(function(t){
    var req=['watch','risks']; if(GAMES[t.id]) req.push('spot'); if(DEC[t.id]) req.push('decide'); req.push('check','law');
    AP.setRequired(t.id, req);
  });
  TR.forEach(function(t){ if(t.practice && (t.practice.module==='laundromat'||t.practice.module==='ownership')) t.practice.auto=true; });
  render(false);
  if(location.hash==='#practice-rooms'){ var pr=document.getElementById('practice-rooms'); if(pr) pr.scrollIntoView(); }
}).catch(function(e){
  APP.innerHTML='<header class="head"><div><div class="kicker">REGRADAR ACADEMY</div><h1>The programme could not load</h1><p>Open this page from the RegRadar site (it reads small data files). The practice rooms still work: <a href="laundromat.html">Laundromat</a>, <a href="ownership.html">Ownership</a>, <a href="desk.html">The Desk</a>, <a href="workstation.html">Workstation</a>.</p></div></header>';
  if(window.console) console.warn('Academy: '+e.message);
});
})();
