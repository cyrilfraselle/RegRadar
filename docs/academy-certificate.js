/* ═══════════════════════════════════════════════════════════════════
   ACADEMY CERTIFICATE — a print-ready, self-attested completion record
   ───────────────────────────────────────────────────────────────────
   Reads the learner's completions from AcademyProgress (key
   'regradar-academy-training', written by the learning path), lets the
   learner add an optional name, role and firm (key
   'regradar-academy-learner'), and builds:
     - a certificate sheet (screen and A4 print)
     - a JSON completion file (also the input of the team register)
     - a training register CSV
   Logic (record, integrity code, CSV) lives in academy-evidence.js and is
   tested by academy/evidence.test.mjs. Nothing leaves the device.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var AE=window.AcademyEvidence, AP=window.AcademyProgress;
var APP=document.getElementById('app'), LIVE=document.getElementById('evLive');
var CUR=null, MAP={}, TR=[], META={}, S={learner:{name:'',role:'',firm:''}, scopeId:'all'}, REC=null;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function say(msg){ if(!LIVE) return; LIVE.textContent=''; setTimeout(function(){ LIVE.textContent=msg; },40); }
function today(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function fmtDate(d){
  var s=AE.dateOnly(d); if(!s) return '';
  var p=s.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2])).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function oblText(ids){
  var nums=[], other=[];
  (ids||[]).forEach(function(id){ var m=/^AMLR-art(\d+)$/.exec(id); if(m) nums.push(m[1]); else other.push(AE.oblLabel(id)); });
  var out=[]; if(nums.length) out.push('AMLR Art. '+nums.join(', ')); return out.concat(other).join('; ');
}

/* ── state ── */
function completions(){ return AP? AP.get().completions : []; }
function scopeList(){
  var done={}; completions().forEach(function(c){ done[c.module]=true; });
  return AE.scopes(TR).filter(function(s){ return s.id==='all' || s.modules.some(function(m){ return done[m]; }); });
}
function currentScope(){
  var list=scopeList(), s=list.filter(function(x){ return x.id===S.scopeId; })[0];
  if(!s){ s=list[0]; S.scopeId=s.id; }
  return s;
}
function build(){
  var sc=currentScope();
  REC=AE.buildRecord({learner:S.learner, tracks:TR, completions:completions(), scope:sc, issued:today(),
    content:{version:META.content_version, date:META.content_date}, map:MAP});
  return REC;
}

/* ── the sheet ── */
function sheetHTML(r){
  var L=r.learner, n=r.completions.length, total=r.scope.lessonsInScope;
  var done={}; r.completions.forEach(function(c){ done[c.module]=true; });
  var sc=currentScope(), notDone=TR.filter(function(t){ return sc.modules.indexOf(t.id)>=0 && !done[t.id]; });
  var vers={}; r.completions.forEach(function(c){ var v=c.contentVersion||'not recorded'; vers[v]=(vers[v]||0)+1; });
  var verText=Object.keys(vers).sort().map(function(v){ return v+' ('+vers[v]+' lesson'+(vers[v]>1?'s':'')+')'; }).join(', ');
  var a12=(META.evidence||{}).art12||{};
  var who=(L.name? '<div class="sh-name">'+esc(L.name)+'</div>' : '<div class="sh-name none">Name not provided</div>')
    +((L.role||L.firm)? '<div class="sh-role">'+esc([L.role,L.firm].filter(Boolean).join(' · '))+'</div>' : '');
  var h='<article class="sheet" id="sheet" aria-label="Certificate of completion, preview">'
    +'<div class="sh-top"><div class="sh-brand"><small>RegRadar Academy</small>Learning path</div><div class="sh-badge">Self-attested · prototype</div></div>'
    +'<h2 class="sh-title">Certificate of completion</h2>'
    +'<p class="sh-scope">'+esc(r.scope.label)+' · '+n+' of '+total+' lesson'+(total>1?'s':'')+' completed'+(n===total? '' : ' (partial)')+'</p>'
    +'<div class="sh-who"><div class="sh-lab">Learner</div>'+who+'</div>'
    +'<h3>Lessons completed</h3><ol class="clist"><li class="hd" aria-hidden="true"><span>No.</span><span>Lesson</span><span>Completed</span><span>Score</span><span>Version</span></li>'
    +r.completions.map(function(c){
      var t=TR.filter(function(x){ return x.id===c.module; })[0]||{no:''};
      var pct=c.max? Math.round(100*c.score/c.max) : null, ob=oblText(c.obligations);
      return '<li><span class="no">'+esc(t.no)+'</span><span class="tt">'+esc(c.title)+(ob? '<small>Trains on '+esc(ob)+'</small>' : '')+'</span>'
        +'<span class="num dt2">'+esc(fmtDate(c.completedAt))+'</span>'
        +'<span class="num sc">'+(c.score==null? 'n/a' : esc(c.score)+(c.max? '/'+esc(c.max) : '')+(pct!=null? ' ('+pct+'%)' : ''))+'</span>'
        +'<span class="num vr">'+esc(c.contentVersion||'not recorded')+'</span></li>';
    }).join('')+'</ol>'
    +(notDone.length? '<p class="missing">Not yet completed in this scope: lesson'+(notDone.length>1?'s ':' ')+notDone.map(function(t){ return t.no; }).join(', ')+'.</p>' : '')
    +'<h3>What this evidences</h3><div class="evid"><p>'+esc(r.statement)+'</p>'
    +'<p>Why a record like this exists: AMLR Art. 12 asks obliged entities to run training programmes that are duly documented. This record can be one piece of that documentation. It does not show, by itself, that a firm\'s programme meets Art. 12.</p>'
    +(a12.quote? '<blockquote>“… '+esc(a12.quote)+'”<br><span class="cite">AMLR (Regulation (EU) 2024/1624), Art. 12, '+esc(a12.para)+'.</span></blockquote>' : '')
    +'<p>No continuing professional development (CPD) hours or accreditation are claimed. Shifts and practice rooms are not part of this record.</p></div>'
    +'<div class="sh-foot"><dl><dt>Issued</dt><dd>'+esc(fmtDate(r.issued))+'</dd>'
    +'<dt>Content version at completion</dt><dd>'+esc(verText||'none')+'</dd>'
    +'<dt>Current content version</dt><dd>'+esc(r.content.version||'n/a')+(r.content.date? ' ('+esc(fmtDate(r.content.date))+')' : '')+'</dd>'
    +'<dt>Source</dt><dd>Device record in the learner\'s browser</dd></dl>'
    +'<div><div class="sh-lab">Integrity code</div><div class="code" aria-label="Integrity code">'+esc(r.integrity.code)+'</div><p class="codenote">'+esc(AE.CODE_NOTE)+'</p></div></div>'
    +'<p class="fine">RegRadar Academy is a prototype for training. Practice cases and CF Bank are fictional. Not legal advice.</p>'
    +'</article>';
  return h;
}
function emptyHTML(){
  var n=completions().length;
  return '<div class="empty"><h2>'+(n? 'No completed lessons in this scope' : 'No completed lessons on this device yet')+'</h2>'
    +'<p>'+(n? 'Pick another scope above, or finish more lessons.' : 'A certificate lists the lessons you have finished, with dates and scores. Finish one lesson in the learning path and it appears here. Nothing is stored anywhere except this browser.')+'</p>'
    +'<a class="btn pri" href="academy.html">Go to the learning path</a></div>';
}

/* ── page ── */
function pageHTML(){
  var L=S.learner, sl=scopeList(), cs=completions().length;
  var h='<header class="head noprint"><div><div class="kicker">REGRADAR ACADEMY · EVIDENCE</div><h1>Your completion certificate</h1>'
    +'<p class="ev-intro">A record of the lessons you completed, with dates, scores and the content version, to print, save as PDF or keep as a file. It is self-attested by your device record, not an accredited certificate.</p></div></header>';
  h+='<div class="ev-cols noprint"><section class="card" aria-labelledby="dtH"><h2 class="h" id="dtH">Details on the certificate</h2>'
    +'<p class="sub">All optional. Leave the name empty for an anonymous record.</p>'
    +'<div class="fields"><div class="fld"><label for="fName">Name</label><input id="fName" type="text" maxlength="120" autocomplete="name" value="'+esc(L.name)+'"></div>'
    +'<div class="fld"><label for="fRole">Role</label><input id="fRole" type="text" maxlength="120" autocomplete="organization-title" value="'+esc(L.role)+'"></div>'
    +'<div class="fld"><label for="fFirm">Firm</label><input id="fFirm" type="text" maxlength="120" autocomplete="organization" value="'+esc(L.firm)+'"></div>'
    +'<div class="fld wide"><label for="fScope">What to include</label><select id="fScope">'
    +sl.map(function(s){ return '<option value="'+esc(s.id)+'"'+(s.id===S.scopeId?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('')
    +'</select><span class="hint">Whole path, a season of three lessons, or a single lesson. Only completed lessons are listed.</span></div></div></section>'
    +'<section class="card" aria-labelledby="stH"><h2 class="h" id="stH">What is stored, and where</h2><ul class="facts">'
    +'<li>Your lesson completions are in this browser, key <code>regradar-academy-training</code>. They were saved by the learning path.</li>'
    +'<li>The name, role and firm you type here are saved in this browser only, key <code>regradar-academy-learner</code>. They are never sent anywhere: this page makes no request that includes them.</li>'
    +'<li>A downloaded file contains what the certificate shows, including the name if you typed one. You decide who receives it.</li>'
    +'<li>“Clear my data” removes the name, role and firm (and the team-register settings). It does not touch your lesson progress; that has its own button on the learning path.</li></ul></section></div>';
  h+='<div class="actions noprint" role="group" aria-label="Certificate actions">'
    +'<button type="button" class="btn pri" data-act="print">Print or save as PDF</button>'
    +'<button type="button" class="btn" data-act="json">Download JSON</button>'
    +'<button type="button" class="btn" data-act="csv">Download training register (CSV)</button>'
    +'<button type="button" class="btn danger" data-act="clear">Clear my data</button></div>'
    +'<p class="note-live noprint" id="evNote"></p>'
    +'<div class="sheetwrap" id="sheetHost"></div>';
  return h;
}
function drawSheet(){
  var host=document.getElementById('sheetHost'); if(!host) return;
  var r=build(), has=r.completions.length>0;
  host.innerHTML= has? sheetHTML(r) : emptyHTML();
  ['print','json','csv'].forEach(function(a){
    var b=APP.querySelector('[data-act="'+a+'"]'); if(!b) return;
    if(has){ b.removeAttribute('aria-disabled'); b.disabled=false; } else { b.setAttribute('aria-disabled','true'); b.disabled=true; }
  });
  document.title='RegRadar: Academy completion certificate';
}
function drawScope(){
  var sel=document.getElementById('fScope'); if(!sel) return;
  var sl=scopeList(); currentScope();
  sel.innerHTML=sl.map(function(s){ return '<option value="'+esc(s.id)+'"'+(s.id===S.scopeId?' selected':'')+'>'+esc(s.label)+'</option>'; }).join('');
}

/* ── actions ── */
function download(name,type,text){
  var blob=new Blob([text],{type:type}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
}
function note(m){ var n=document.getElementById('evNote'); if(n) n.textContent=m; say(m); }
APP.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b || b.disabled) return;
  var act=b.dataset.act, r=build(), d=today();
  if(act==='print'){ var old=document.title; document.title='RegRadar Academy certificate '+d; window.print(); document.title=old; return; }
  if(act==='json'){ download('regradar-academy-completions-'+d+'.json','application/json;charset=utf-8',JSON.stringify(r,null,2)+'\n'); return note('JSON completion file downloaded. Integrity code '+r.integrity.code+'.'); }
  if(act==='csv'){ download('regradar-academy-training-register-'+d+'.csv','text/csv;charset=utf-8',AE.recordCSV(r)); return note('Training register CSV downloaded ('+r.completions.length+' row'+(r.completions.length>1?'s':'')+').'); }
  if(act==='clear'){
    if(window.confirm('Clear the name, role and firm saved on this device, and the team-register settings? Your lesson progress is not touched.')){
      AE.clearKeys(); S.learner={name:'',role:'',firm:''};
      ['fName','fRole','fFirm'].forEach(function(id){ var i=document.getElementById(id); if(i) i.value=''; });
      drawSheet(); note('Name, role, firm and register settings cleared from this device. Lesson progress is unchanged.');
      var f=document.getElementById('fName'); if(f) f.focus();
    }
  }
});
APP.addEventListener('input',function(e){
  var m={fName:'name',fRole:'role',fFirm:'firm'}[e.target.id]; if(!m) return;
  S.learner[m]=e.target.value; AE.saveLearner(S.learner); drawSheet();
});
APP.addEventListener('change',function(e){
  if(e.target.id!=='fScope') return;
  S.scopeId=e.target.value; drawSheet();
});

/* ── boot ── */
function getJSON(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(u+' '+r.status); return r.json(); }); }
Promise.all([getJSON('data/academy/curriculum.json'), getJSON('data/academy/module-map.json').catch(function(){ return {modules:{}}; })])
.then(function(r){
  CUR=r[0]; META=CUR._meta||{}; TR=CUR.tracks; MAP=r[1].modules||{};
  S.learner=AE.loadLearner();
  APP.innerHTML=pageHTML(); drawSheet();
}).catch(function(e){
  APP.innerHTML='<header class="head"><div><div class="kicker">REGRADAR ACADEMY · EVIDENCE</div><h1>The certificate could not load</h1><p>Open this page from the RegRadar site (it reads small data files). <a href="academy.html">Back to the Academy</a>.</p></div></header>';
  if(window.console) console.warn('Academy certificate: '+e.message);
});
})();
