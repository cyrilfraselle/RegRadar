/* ═══════════════════════════════════════════════════════════════════
   ACADEMY ROUNDS — short games inside a lesson ("Spot it", "Decide",
   the warm-up). Renders round types from plain JSON
   (docs/data/academy/rounds.json). No libraries, no network.

     AcademyRounds.mount(host, game, opts) -> {destroy()}
     AcademyRounds.misses                  -> the warm-up store (below)

   Round types (game.type, or card.type for mixed rounds):
     flag    one card, two answers (looks fine / escalate)       choices
     sort    one card, two to four buckets                         choices
     match   our customer next to a list entry, two answers        choices
     decide  one situation, options with a consequence each        card.options
     q       a check question replayed in the warm-up              card.choices
     doc     tap the one field on a document that does not match   card.doc.fields
     pick    tap every answer that fits, then Check                card.opts

   Every type (except decide and q) gets, from rounds.json "tutorials":
   a first-run coach (max three steps, highlighted target, Next/Skip/Esc),
   an unscored practice card first, and an always-visible How to play.
   Feedback is instant: the reason and the article of the law, then one
   button onwards. Wrong answers cost nothing; they come back in the
   warm-up. Keyboard: number keys pick, arrow keys move between options,
   Enter/Space press. Results are announced through an aria-live region.

   opts: { tutorials, coachSeen(type)->bool, markCoach(type),
           onAnswer(card, ok, isPractice), onDone(result), onNext(),
           nextLabel, mode:'game'|'decide'|'warmup', lawUrl(c), citeText(c) }
   result = { score, max, results:[{card, ok, choice}] }

   Misses store, key 'regradar-academy-misses':
     { v:1, items:[ {id, module, kind, at, n} ] }   id = 'card:<game>:<card>',
     'q:<module>:<index>' or 'dec:<module>'. Capped at 40, device-local.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function reduced(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
var uid=0;

/* ── misses: what to replay in the warm-up ───────────────────────── */
var MKEY='regradar-academy-misses';
var misses=(function(){
  function load(){
    try{ var p=JSON.parse(localStorage.getItem(MKEY)||'null'); if(p && p.v===1 && Array.isArray(p.items)) return p; }catch(e){}
    return {v:1, items:[]};
  }
  function save(s){ try{ localStorage.setItem(MKEY, JSON.stringify(s)); }catch(e){} }
  function add(id, module, kind){
    var s=load(), f=null;
    s.items.forEach(function(x){ if(x.id===id) f=x; });
    if(f){ f.n=(f.n||1)+1; f.at=new Date().toISOString(); }
    else s.items.push({id:id, module:module||'', kind:kind||'card', at:new Date().toISOString(), n:1});
    s.items=s.items.slice(-40); save(s);
  }
  function clear(id){ var s=load(), n=s.items.length; s.items=s.items.filter(function(x){ return x.id!==id; }); if(s.items.length!==n) save(s); }
  function list(){ return load().items.slice(); }
  function count(){ return load().items.length; }
  return {KEY:MKEY, add:add, clear:clear, list:list, count:count};
})();

var CHOICE_TYPES={flag:1, sort:1, match:1, decide:1, q:1};
var VERDICT={best:'Best call', ok:'Also acceptable', poor:'Risky call'};

function mount(host, game, opts){
  opts=opts||{};
  var mode=opts.mode||'game';
  var tuts=opts.tutorials||{};
  var gtype=game.type;
  var T=tuts[gtype]||null;
  var practice=(mode==='game' && game.practice)? game.practice : null;
  var cards=game.cards||[];
  var st={phase: practice?'practice':'play', i:0, ans:null, sel:[], score:0, results:[], coach:-1, help:false, dead:false};
  var id='rr'+(++uid);
  var root=document.createElement('div');
  root.className='rr'; root.id=id; root.setAttribute('data-type', gtype);
  host.innerHTML=''; host.appendChild(root);

  function card(){ return st.phase==='practice'? practice : cards[st.i]; }
  function ctype(c){ return (c && c.type) || gtype; }
  function choicesOf(c){ var t=ctype(c); return t==='decide'? (c.options||[]) : (c.choices || game.choices || []); }
  function tutOf(c){ return tuts[ctype(c)] || T; }
  function cite(c){ if(!c) return ''; var u=opts.lawUrl? opts.lawUrl(c) : '#', t=opts.citeText? opts.citeText(c) : (c.celex+' Art. '+c.art);
    return '<a href="'+esc(u)+'">'+esc(t)+'</a>'; }
  function live(msg){ var l=root.querySelector('.rr-live'); if(!l) return; l.textContent=''; setTimeout(function(){ if(l) l.textContent=msg; },40); }

  /* ── drawing ── */
  function draw(){
    if(st.dead) return;
    if(st.phase==='done'){ drawSummary(); return; }
    var c=card(), t=ctype(c), N=cards.length, tut=tutOf(c);
    var kick= st.phase==='practice'? 'Practice card: this one does not count'
      : mode==='decide'? 'Your call' : (mode==='warmup'? 'Warm-up ' : 'Card ')+(st.i+1)+' of '+N;
    var h='<div class="rr-top"><div class="rr-meta"><span class="rr-kick">'+esc(kick)+'</span>'
      +(st.phase==='play' && mode!=='decide'? '<span class="rr-tally" aria-label="'+st.score+' right so far">✓ '+st.score+'</span>' : '')+'</div>'
      +(tut&&tut.howto? '<button type="button" class="rr-help-btn" data-rr="help" aria-expanded="'+st.help+'" aria-controls="'+id+'-help">How to play</button>' : '')+'</div>';
    if(tut&&tut.howto) h+='<div class="rr-help" id="'+id+'-help"'+(st.help?'':' hidden')+'><ul>'+tut.howto.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'
      +(tut.coach? '<button type="button" class="btn sm" data-rr="tour">Show me the tour</button>' : '')+'</div>';
    if(st.phase==='play' && N>1) h+='<div class="rr-bar" aria-hidden="true"><i style="--p:'+(st.i/N)+'"></i></div>';
    if(st.phase==='practice' && c.hint && !st.ans) h+='<p class="rr-hint">'+esc(c.hint)+'</p>';
    h+='<div class="rr-stage">'+body(c,t)+'</div>';
    h+='<div class="rr-fbwrap">'+(st.ans? feedback(c,t) : '')+'</div>';
    h+='<div class="rr-live sr" role="status" aria-live="polite" aria-atomic="true"></div>';
    root.innerHTML=h;
    wireSwipe();
  }
  function facts(rows){ return rows&&rows.length? '<dl class="rr-facts">'+rows.map(function(r){ return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'; }).join('')+'</dl>' : ''; }
  function body(c,t){
    var a=st.ans, h='';
    if(t==='doc') return docBody(c);
    if(t==='pick') return pickBody(c);
    /* choice types */
    if(t==='match'){
      h+='<div class="rr-card rr-compare"><h3 class="rr-ct">'+esc(c.title||'Screening hit')+'</h3><div class="rr-tw"><table><caption class="sr">Our customer compared with the list entry (fictional)</caption>'
        +'<thead><tr><th scope="col">Field</th><th scope="col">Our customer</th><th scope="col">List entry (fictional)</th></tr></thead><tbody>'
        +(c.rows||[]).map(function(r){ return '<tr><th scope="row">'+esc(r[0])+'</th><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>'; }).join('')+'</tbody></table></div></div>';
    }else if(t==='decide'){
      h+='<div class="rr-card rr-scen"><div class="rr-ck">Situation</div><h3 class="rr-ct">'+esc(c.title)+'</h3><p>'+esc(c.text)+'</p>'+facts(c.facts)+'</div>';
    }else if(t==='q'){
      h+='<div class="rr-card"><div class="rr-ck">'+esc(c.kicker||'From a check')+'</div><h3 class="rr-ct">'+esc(c.title)+'</h3>'+(c.text?'<p>'+esc(c.text)+'</p>':'')+'</div>';
    }else{
      h+='<div class="rr-card'+(t==='sort'?' rr-sortcard':'')+'">'+(c.kicker?'<div class="rr-ck">'+esc(c.kicker)+'</div>':'')
        +(c.title?'<h3 class="rr-ct">'+esc(c.title)+'</h3>':'')+(c.text?'<p class="rr-big">'+esc(c.text)+'</p>':'')+facts(c.facts)+'</div>';
    }
    var ch=choicesOf(c), right=answerOf(c);
    h+='<div class="rr-choices n'+ch.length+(t==='decide'||t==='q'?' rr-stack':'')+'" role="group" aria-label="Your answer">'+ch.map(function(o,k){
      var cls='rr-ch', tag='';
      if(a){
        var isRight= t==='decide'? o.verdict!=='poor' : String(o.id)===String(right);
        if(String(o.id)===String(a.choice)) cls+= isRight? ' is-right' : ' is-wrong';
        else if(isRight && t!=='decide') cls+=' is-answer';
        if(t==='decide' && String(o.id)===String(a.choice)) tag='<span class="rr-tag">'+esc(VERDICT[o.verdict]||'')+'</span>';
        else if(isRight && t!=='decide') tag='<span class="rr-tag">Answer</span>';
      }
      return '<button type="button" class="'+cls+'" data-ch="'+esc(o.id)+'"'+(a?' aria-disabled="true"':'')+'><span class="rr-num" aria-hidden="true">'+(k+1)+'</span>'
        +'<span class="rr-cl">'+esc(o.label)+(o.hint?'<small>'+esc(o.hint)+'</small>':'')+'</span>'+tag+'</button>';
    }).join('')+'</div>';
    return h;
  }
  function docBody(c){
    var a=st.ans;
    var ref='<section class="rr-ref" aria-label="'+esc(c.ref.title)+'"><h4>'+esc(c.ref.title)+'</h4>'+facts(c.ref.rows)+'</section>';
    var doc='<section class="rr-doc k-'+esc(c.doc.kind||'id')+'" aria-label="'+esc(c.doc.title)+'"><h4>'+esc(c.doc.title)+'</h4><div class="rr-fields" role="group" aria-label="Tap the field that does not match">'
      +c.doc.fields.map(function(f){
        var cls='rr-f', tag='';
        if(a){ if(f.id===c.answer){ cls+= a.choice===f.id? ' is-right':' is-answer'; tag='<span class="rr-tag">'+(a.choice===f.id?'Found it':'This one')+'</span>'; }
               else if(a.choice===f.id){ cls+=' is-wrong'; tag='<span class="rr-tag">Matches</span>'; } }
        return '<button type="button" class="'+cls+'" data-f="'+esc(f.id)+'"'+(a?' aria-disabled="true"':'')+'><span class="k">'+esc(f.k)+'</span><span class="v">'+esc(f.v)+'</span>'+tag+'</button>';
      }).join('')+'</div></section>';
    return '<div class="rr-card rr-docq"><h3 class="rr-ct">'+esc(c.title||'Document')+'</h3><p>'+esc(c.prompt||'Tap the one field on the document that does not match the application.')+'</p></div><div class="rr-docwrap">'+ref+doc+'</div>';
  }
  function tree(n){
    if(!n) return '';
    return '<li><span class="rr-node">'+(n.pct?'<b class="rr-pct">'+esc(n.pct)+'</b>':'')+'<span>'+esc(n.name)+'</span>'+(n.note?' <em>'+esc(n.note)+'</em>':'')+'</span>'
      +(n.kids&&n.kids.length? '<ul>'+n.kids.map(tree).join('')+'</ul>' : '')+'</li>';
  }
  function pickBody(c){
    var a=st.ans, ans=answerOf(c);
    var h='<div class="rr-card"><h3 class="rr-ct">'+esc(c.title)+'</h3>'+(c.text?'<p>'+esc(c.text)+'</p>':'')
      +(c.tree? '<div class="rr-tree" aria-label="Ownership structure, from the customer down to its owners"><ul>'+tree(c.tree)+'</ul></div>' : '')+'</div>';
    h+='<div class="rr-opts" role="group" aria-label="Pick every answer that fits">'+c.opts.map(function(o){
      var on=st.sel.indexOf(o.id)>=0, cls='rr-o'+(on?' on':''), tag='';
      if(a){ var isA=ans.indexOf(o.id)>=0;
        if(on&&isA){ cls+=' is-right'; tag='Right'; } else if(on&&!isA){ cls+=' is-wrong'; tag='Not this one'; } else if(!on&&isA){ cls+=' is-answer'; tag='Missed'; } }
      return '<button type="button" class="'+cls+'" data-o="'+esc(o.id)+'" aria-pressed="'+on+'"'+(a?' aria-disabled="true"':'')+'><span class="rr-box" aria-hidden="true"></span><span class="rr-cl">'+esc(o.label)+'</span>'+(tag?'<span class="rr-tag">'+tag+'</span>':'')+'</button>';
    }).join('')+'</div>';
    if(!a) h+='<div class="rr-act"><button type="button" class="btn pri rr-check" data-rr="check"'+(st.sel.length?'':' aria-disabled="true"')+'>Check</button></div>';
    return h;
  }
  function answerOf(c){ return c.answer; }
  function nextLabel(){
    if(st.phase==='practice') return 'Start the real round';
    if(mode==='decide') return opts.nextLabel||'Continue';
    return st.i>=cards.length-1? 'See your result' : 'Next card';
  }
  function feedback(c,t){
    var a=st.ans, h;
    if(t==='decide'){
      var o=(c.options||[]).filter(function(x){ return String(x.id)===String(a.choice); })[0]||{};
      var others=(c.options||[]).filter(function(x){ return x!==o; });
      h='<div class="rr-fb '+(o.verdict==='poor'?'no':'ok')+'"><div class="rr-stamp">'+esc(VERDICT[o.verdict]||'')+'</div><p>'+esc(o.consequence)+'</p>'
        +(o.cite?'<p class="rr-src">Source: '+cite(o.cite)+'</p>':'')
        +(others.length?'<details class="rr-others"><summary>What the other choices lead to</summary><ul>'+others.map(function(x){ return '<li><b>'+esc(x.label)+'.</b> <span class="rr-v v-'+esc(x.verdict)+'">'+esc(VERDICT[x.verdict]||'')+'.</span> '+esc(x.consequence)+(x.cite?' <span class="rr-src">'+cite(x.cite)+'</span>':'')+'</li>'; }).join('')+'</ul></details>':'');
    }else{
      var ok=a.ok, prac=st.phase==='practice';
      h='<div class="rr-fb '+(ok?'ok':'no')+'"><div class="rr-stamp">'+(ok? (prac?'Right (practice)':'Right') : (prac?'Not quite (practice)':'Not quite'))+'</div><p>'+esc(c.why)+'</p>'
        +(c.cite?'<p class="rr-src">Source: '+cite(c.cite)+' in the law reader.</p>':'<p class="rr-src">A teaching example, not a legal rule.</p>');
    }
    h+='<div class="rr-act"><button type="button" class="btn pri rr-next" data-rr="next">'+esc(nextLabel())+' <span aria-hidden="true">→</span></button></div></div>';
    return h;
  }
  function drawSummary(){
    var N=cards.length, s=st.score, pct=N? s/N : 0;
    var msg= mode==='warmup'
      ? (s===N? 'All of them this time. They are cleared from your warm-up.' : 'The ones you got right are cleared. The others stay for next time: no penalty.')
      : pct>=0.8? 'Sharp. That is the eye the job needs.' : pct>=0.5? 'Good start. The ones you missed come back in your next warm-up.' : 'These are tricky at first. The ones you missed come back in your next warm-up, so they will stick.';
    var miss=st.results.filter(function(r){ return !r.ok; });
    var h='<div class="rr-sum"><div class="rr-kick">'+(mode==='warmup'?'Warm-up done':'Round complete')+'</div>'
      +'<div class="rr-scorebig" tabindex="-1">'+s+' <small>of '+N+' right</small></div><p class="rr-msg">'+esc(msg)+'</p>';
    if(game.remember&&game.remember.length) h+='<h4>What to remember</h4><ul class="rr-rem">'+game.remember.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>';
    if(game.law&&game.law.length) h+='<h4>From the law</h4>'+game.law.map(function(q){
      return '<figure class="rr-law"><blockquote>'+esc(q.quote)+'</blockquote><figcaption>'+cite(q)+(q.label?' · '+esc(q.label):'')+'</figcaption></figure>'; }).join('');
    if(miss.length && mode!=='warmup') h+='<details class="rr-others"><summary>Worth another look ('+miss.length+')</summary><ul>'+miss.map(function(r){
      return '<li><b>'+esc(r.card.title||r.card.kicker||r.card.text||'Card')+'.</b> '+esc(r.card.why)+'</li>'; }).join('')+'</ul></details>';
    if(game.reading&&game.reading.length) h+='<p class="rr-read">Further reading (not quoted here): '+game.reading.map(esc).join('; ')+'.</p>';
    h+='<div class="rr-act">'+(mode==='game'?'<button type="button" class="btn" data-rr="again">Play again</button>':'')
      +'<button type="button" class="btn pri" data-rr="done">'+esc(opts.nextLabel||'Continue')+' <span aria-hidden="true">→</span></button></div></div>'
      +'<div class="rr-live sr" role="status" aria-live="polite" aria-atomic="true"></div>';
    root.innerHTML=h;
    var b=root.querySelector('.rr-scorebig'); if(b) b.focus();
    live((mode==='warmup'?'Warm-up done: ':'Round complete: ')+s+' of '+N+' right.');
  }

  /* ── answering ── */
  function answer(choice){
    if(st.ans || st.coach>=0) return;
    var c=card(), t=ctype(c), ok;
    if(t==='decide'){ var o=(c.options||[]).filter(function(x){ return String(x.id)===String(choice); })[0]; if(!o) return; ok=o.verdict!=='poor'; }
    else if(t==='pick'){ var A=answerOf(c).slice().sort().join('|'), S=st.sel.slice().sort().join('|'); ok=A===S; choice=st.sel.slice(); }
    else ok=String(choice)===String(answerOf(c));
    st.ans={choice:choice, ok:ok};
    var prac=st.phase==='practice';
    if(!prac){ if(ok) st.score++; st.results.push({card:c, ok:ok, choice:choice}); }
    if(opts.onAnswer) opts.onAnswer(c, ok, prac);
    draw();
    var fbText = t==='decide'? (VERDICT[(c.options.filter(function(x){ return String(x.id)===String(choice); })[0]||{}).verdict]||'')+'. '+((c.options.filter(function(x){ return String(x.id)===String(choice); })[0]||{}).consequence||'')
      : (ok?'Right. ':'Not quite. ')+c.why;
    live(fbText);
    if(mode==='decide' && opts.onDone) opts.onDone({score:ok?1:0, max:1, results:st.results});
    var n=root.querySelector('.rr-next'); if(n){ n.focus({preventScroll:true}); scrollIn(root.querySelector('.rr-fb')); }
  }
  function scrollIn(el){ if(el && el.scrollIntoView) try{ el.scrollIntoView({block:'nearest', behavior: reduced()?'auto':'smooth'}); }catch(e){} }
  function next(){
    if(mode==='decide'){ if(opts.onNext) opts.onNext(); return; }
    st.ans=null; st.sel=[];
    if(st.phase==='practice'){ st.phase='play'; st.i=0; }
    else if(st.i>=cards.length-1){ st.phase='done'; if(opts.onDone) opts.onDone({score:st.score, max:cards.length, results:st.results}); }
    else st.i++;
    draw(); focusFirst();
  }
  function focusFirst(){
    if(st.phase==='done') return;
    var f=root.querySelector('.rr-ch,.rr-f,.rr-o'); if(f) f.focus({preventScroll:true});
    scrollIn(root.querySelector('.rr-top'));
  }

  /* ── coach overlay ── */
  function startCoach(){
    var tut=tutOf(card()); if(!tut||!tut.coach||!tut.coach.length) return;
    st.help=false; draw(); st.coach=0; drawCoach();
  }
  function endCoach(){
    var tut=tutOf(card()), t=ctype(card());
    st.coach=-1; clearCoach();
    if(opts.markCoach) opts.markCoach(t);
    focusFirst();
  }
  function clearCoach(){
    var b=root.querySelector('.rr-coach'); if(b) b.remove();
    root.classList.remove('rr-coaching');
    Array.prototype.forEach.call(root.querySelectorAll('.rr-hl'), function(x){ x.classList.remove('rr-hl'); x.removeAttribute('inert'); });
  }
  function drawCoach(){
    clearCoach();
    var tut=tutOf(card()), steps=tut.coach, s=steps[st.coach];
    var tgt=root.querySelector(s.target)||root.querySelector('.rr-stage');
    root.classList.add('rr-coaching'); tgt.classList.add('rr-hl');
    var last=st.coach>=steps.length-1, hid=id+'-ch';
    var b=document.createElement('div');
    b.className='rr-coach'; b.setAttribute('role','dialog'); b.setAttribute('aria-modal','true'); b.setAttribute('aria-labelledby',hid);
    b.innerHTML='<div class="rr-coach-k">How to play · '+(st.coach+1)+' of '+steps.length+'</div><h4 id="'+hid+'" tabindex="-1">'+esc(s.title)+'</h4><p>'+esc(s.text)+'</p>'
      +'<div class="rr-coach-act"><button type="button" class="btn sm" data-rr="cskip">Skip</button><button type="button" class="btn pri sm" data-rr="cnext">'+(last?'Got it, play':'Next')+'</button></div>';
    (tgt.closest('.rr-top,.rr-act')||tgt).insertAdjacentElement('afterend', b);   /* never inside a flex row */
    var hh=b.querySelector('h4'); hh.focus({preventScroll:true}); scrollIn(tgt);
  }

  /* ── events ── */
  function onClick(e){
    var r=e.target.closest('[data-rr],[data-ch],[data-f],[data-o]'); if(!r || !root.contains(r)) return;
    if(r.getAttribute('aria-disabled')==='true' && !r.hasAttribute('data-rr')) return;
    var act=r.getAttribute('data-rr');
    if(act==='cnext'){ var tut=tutOf(card()); if(st.coach>=tut.coach.length-1) endCoach(); else { st.coach++; drawCoach(); } return; }
    if(act==='cskip'){ endCoach(); return; }
    if(st.coach>=0) return;
    if(act==='help'){ st.help=!st.help; var hp=root.querySelector('.rr-help'); if(hp) hp.hidden=!st.help; r.setAttribute('aria-expanded', String(st.help)); return; }
    if(act==='tour'){ startCoach(); return; }
    if(act==='next'){ next(); return; }
    if(act==='check'){ if(!st.sel.length){ live('Pick at least one answer first.'); return; } answer(null); return; }
    if(act==='again'){ st={phase: practice?'practice':'play', i:0, ans:null, sel:[], score:0, results:[], coach:-1, help:false, dead:false}; draw(); focusFirst(); return; }
    if(act==='done'){ if(opts.onNext) opts.onNext(); return; }
    if(r.hasAttribute('data-ch')){ answer(r.getAttribute('data-ch')); return; }
    if(r.hasAttribute('data-f')){ answer(r.getAttribute('data-f')); return; }
    if(r.hasAttribute('data-o')){
      if(st.ans) return;
      var o=r.getAttribute('data-o'), k=st.sel.indexOf(o);
      if(k>=0) st.sel.splice(k,1); else st.sel.push(o);
      r.classList.toggle('on', k<0); r.setAttribute('aria-pressed', String(k<0));
      var cb=root.querySelector('.rr-check'); if(cb){ if(st.sel.length) cb.removeAttribute('aria-disabled'); else cb.setAttribute('aria-disabled','true'); }
      return;
    }
  }
  function onKey(e){
    if(e.altKey||e.ctrlKey||e.metaKey) return;
    if(st.coach>=0){
      if(e.key==='Escape'){ e.preventDefault(); endCoach(); return; }
      if(e.key==='Tab'){ var bs=root.querySelectorAll('.rr-coach button'); if(!bs.length) return;
        var first=bs[0], lastB=bs[bs.length-1];
        if(e.shiftKey && (document.activeElement===first || !root.querySelector('.rr-coach').contains(document.activeElement))){ e.preventDefault(); lastB.focus(); }
        else if(!e.shiftKey && document.activeElement===lastB){ e.preventDefault(); first.focus(); } }
      return;
    }
    var tag=(e.target.tagName||'').toLowerCase(); if(tag==='input'||tag==='textarea'||tag==='select') return;
    if(/^[1-9]$/.test(e.key) && !st.ans && st.phase!=='done'){
      var c=card(); if(!c) return; var t=ctype(c);
      var list= CHOICE_TYPES[t]? root.querySelectorAll('.rr-ch') : t==='doc'? root.querySelectorAll('.rr-f') : root.querySelectorAll('.rr-o');
      var b=list[+e.key-1]; if(b){ e.preventDefault(); b.focus(); b.click(); }
      return;
    }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0){
      var grp=e.target.closest && e.target.closest('.rr-choices,.rr-fields,.rr-opts'); if(!grp) return;
      var bs2=Array.prototype.slice.call(grp.querySelectorAll('button')), i=bs2.indexOf(e.target); if(i<0) return;
      e.preventDefault();
      var d=(e.key==='ArrowLeft'||e.key==='ArrowUp')? -1 : 1;
      bs2[(i+d+bs2.length)%bs2.length].focus();
    }
  }
  /* swipe a two-answer card on touch screens: left = first answer, right = second */
  function wireSwipe(){
    var c=card(); if(!c) return; var t=ctype(c);
    if(st.ans || (t!=='flag'&&t!=='match') || choicesOf(c).length!==2) return;
    var el=root.querySelector('.rr-card'); if(!el) return;
    var x0=null, dx=0, pid=null;
    el.addEventListener('pointerdown', function(e){ if(e.pointerType==='mouse'||st.coach>=0) return; x0=e.clientX; dx=0; pid=e.pointerId; });
    el.addEventListener('pointermove', function(e){ if(x0===null||e.pointerId!==pid) return; dx=e.clientX-x0; if(!reduced()) el.style.transform='translateX('+(dx*0.5)+'px) rotate('+(dx/40)+'deg)'; });
    function end(){ if(x0===null) return; el.style.transform=''; var ch=choicesOf(c); if(Math.abs(dx)>90) answer(ch[dx<0?0:1].id); x0=null; dx=0; }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', function(){ x0=null; dx=0; el.style.transform=''; });
  }
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  draw();
  var firstTut=tutOf(card());
  if(mode==='game' && firstTut && firstTut.coach && !(opts.coachSeen && opts.coachSeen(gtype))) startCoach();
  return {destroy:function(){ st.dead=true; root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); }, focus:focusFirst};
}

window.AcademyRounds={mount:mount, misses:misses, esc:esc};
})();
