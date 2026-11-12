/* ═══════════════════════════════════════════════════════════════════
   ACADEMY REGISTER — the team view, with no backend
   ───────────────────────────────────────────────────────────────────
   A compliance officer collects the JSON completion files (or CSV
   registers) that learners export from academy-certificate.html, loads
   them here and gets one merged register: who completed which lesson,
   what is overdue or outstanding against a required set and a refresher
   interval, a coverage line, a CSV export and a one-page "Training
   evidence pack" to print.

   Files are read in the browser and kept in memory only: reloading the
   page forgets them. Only the settings (required lessons, refresher
   interval) are saved, in 'regradar-academy-register-config'.
   Logic: academy-evidence.js (tested by academy/evidence.test.mjs).
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var AE=window.AcademyEvidence;
var APP=document.getElementById('app'), LIVE=document.getElementById('evLive');
var CUR=null, MAP={}, TR=[], META={}, LABELS={}, TITLES={}, DEMO=null;
var S={sources:[], cfg:AE.loadConfig(), asOf:null, view:'register'};
var RES=null, LIST_MAX=10, MAX_BYTES=2*1024*1024;

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function say(msg){ if(!LIVE) return; LIVE.textContent=''; setTimeout(function(){ LIVE.textContent=msg; },40); }
function pad(n){ return (n<10?'0':'')+n; }
function today(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function fmtDate(d){
  var s=AE.dateOnly(d); if(!s) return '';
  var p=s.split('-'); return new Date(Date.UTC(+p[0],+p[1]-1,+p[2])).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function plural(n,w){ return n+' '+w+(n===1?'':'s'); }
function label(t){ return LABELS[t.id]||t.title; }
function ids(){ return TR.map(function(t){ return t.id; }); }
function requiredIds(){ var r=S.cfg.required; return r? ids().filter(function(i){ return r.indexOf(i)>=0; }) : ids(); }
function asOf(){ return AE.dateOnly(S.asOf)||today(); }
function oblText(list){
  var nums=[], other=[];
  (list||[]).forEach(function(id){ var m=/^AMLR-art(\d+)$/.exec(id); if(m) nums.push(m[1]); else other.push(AE.oblLabel(id)); });
  var out=[]; if(nums.length) out.push('AMLR Art. '+nums.join(', ')); return out.concat(other).join('; ');
}

/* ── compute ── */
function compute(){
  RES=AE.merge(S.sources, {modules:ids(), required:requiredIds(), months:S.cfg.months, dueSoonDays:30, asOf:asOf()});
  return RES;
}
function learnerName(L){ return L.name || 'Unnamed learner'; }
function lstatus(L){
  var s=L.summary;
  if(!s.required) return {cls:'none', text:'No required lessons'};
  if(s.upToDate) return {cls:'current', text:'Up to date'};
  var bits=[]; if(s.overdue) bits.push(s.overdue+' overdue'); if(s.outstanding) bits.push(s.outstanding+' missing');
  return {cls:s.overdue?'overdue':'outstanding', text:bits.join(', ')};
}
function coverageLine(r){
  var c=r.coverage, k=r.required.length;
  if(!c.learners) return 'No learners loaded yet.';
  if(!k) return 'No required lessons selected: choose at least one to see coverage.';
  return c.upToDate+' of '+plural(c.learners,'learner')+' ('+c.upToDatePct+'%) up to date on all '+k+' required lesson'+(k>1?'s':'')+'. '
    +c.valid+' of '+c.slots+' required completions ('+c.validPct+'%) are valid at '+fmtDate(r.asOf)+': '+c.overdue+' overdue, '+c.outstanding+' missing.';
}
function intText(r){
  var i=r.integrity, bits=[]; if(i.match) bits.push(i.match+' matching'); if(i.mismatch) bits.push(i.mismatch+' NOT matching'); if(i.none) bits.push(i.none+' without a code');
  return bits.join(', ')||'no files';
}
function versionText(r){
  var k=Object.keys(r.versions).sort();
  return k.length? k.map(function(v){ return v+': '+plural(r.versions[v],'completion'); }).join('; ') : 'none';
}

/* ── page ── */
function pageHTML(){
  var h='<header class="head noprint"><div><div class="kicker">REGRADAR ACADEMY · EVIDENCE</div><h1>Team training register</h1>'
    +'<p class="ev-intro">For a compliance officer: load the completion files your learners export from their Academy certificate page and get one merged register, with what is overdue or outstanding. Nothing is uploaded: files are read in this browser and forgotten when you close or reload the page.</p></div></header>';
  h+='<section class="card noprint" aria-labelledby="imH"><h2 class="h" id="imH">1. Load learner files</h2>'
    +'<p class="sub">JSON completion files (one learner each) or CSV registers (one or many learners). Several files for the same learner are merged; the latest completion of each lesson counts.</p>'
    +'<div class="drop" id="drop"><button type="button" class="btn pri" data-act="choose">Choose files (JSON or CSV)</button>'
    +'<input type="file" id="fileIn" multiple accept=".json,.csv,application/json,text/csv" hidden aria-label="Learner files">'
    +'<button type="button" class="btn" data-act="demo">Load demo learners (fictional)</button>'
    +'<button type="button" class="btn danger" data-act="clearfiles" id="clearBtn">Remove all files</button>'
    +'<span class="fine" style="flex:1 1 220px">You can also drop files here.</span></div>'
    +'<ul class="files" id="fileList" aria-label="Loaded files"></ul></section>';
  var cfg=S.cfg, req=requiredIds();
  h+='<section class="card noprint" style="margin-top:14px" aria-labelledby="seH"><h2 class="h" id="seH">2. Rules for your firm</h2>'
    +'<p class="sub">Defaults, configure for your firm. AMLR Art. 12 asks for ongoing training and does not fix a refresher interval or which lessons are mandatory for which role.</p>'
    +'<fieldset style="margin-top:10px"><legend style="font-size:14px;font-weight:700">Required lessons</legend><div class="reqs">'
    +TR.map(function(t){ return '<label><input type="checkbox" data-req="'+esc(t.id)+'"'+(req.indexOf(t.id)>=0?' checked':'')+'><span>'+t.no+'. '+esc(t.title)+'</span></label>'; }).join('')
    +'</div></fieldset>'
    +'<div class="set-row"><div class="fld"><label for="fMonths">Refresher interval (months)</label><input id="fMonths" type="number" min="0" max="120" step="1" inputmode="numeric" value="'+esc(cfg.months)+'"><span class="hint">Default 12. 0 = no refresher.</span></div>'
    +'<div class="fld"><label for="fAsOf">Report date</label><input id="fAsOf" type="date" value="'+esc(asOf())+'"><span class="hint">Defaults to today. Change it to test overdue logic.</span></div>'
    +'<button type="button" class="btn" data-act="defaults">Reset rules to defaults</button></div>'
    +'<p class="fine" style="margin-top:8px">A completed lesson is overdue the day after its refresher date and is flagged “due soon” in the last 30 days before it. A required lesson with no completion is “missing”.</p></section>';
  h+='<div id="results" style="margin-top:18px"></div>';
  return h;
}
function filesHTML(){
  if(!S.sources.length) return '<li class="fine">No files loaded yet.</li>';
  return S.sources.map(function(s,i){
    var n=s.learners.length, chip= s.integrity==='match'? '<span class="chip ok">Integrity code matches</span>'
      : s.integrity==='mismatch'? '<span class="chip warn">Integrity code does not match: changed after creation?</span>'
      : s.kind==='demo'? '<span class="chip">Demo data</span>' : '<span class="chip">No integrity code</span>';
    return '<li><span class="fn">'+esc(s.name)+'</span><span class="chip">'+(s.ok? plural(n,'learner') : 'not read')+'</span>'+(s.ok? chip : '<span class="chip warn">Skipped</span>')
      +'<button type="button" class="btn sm" data-act="remove" data-i="'+i+'" aria-label="Remove '+esc(s.name)+'">Remove</button>'
      +(s.warnings.length? '<span class="wmsg">'+s.warnings.map(esc).join(' ')+'</span>' : '')+'</li>';
  }).join('');
}

/* ── results ── */
function statusCell(c){
  if(!c.required && !c.completedOn) return '<span class="st none">Optional</span>';
  var word={current:'Valid','due-soon':'Due soon',overdue:'Overdue',outstanding:'Missing',none:'Optional'}[c.status];
  var sub='';
  if(c.completedOn) sub='<span class="dt">'+esc(fmtDate(c.completedOn))+(c.dueOn&&c.status!=='current'? ' · due '+esc(fmtDate(c.dueOn)) : '')+'</span>';
  return '<span class="st '+c.status+'">'+word+'</span>'+sub;
}
function matrixHTML(r){
  var head='<tr><th scope="col">Learner</th>'+TR.map(function(t){
    var q=r.byModule[t.id].required;
    return '<th scope="col" title="'+esc(t.title)+'">L'+t.no+(q?'':' (optional)')+'<br>'+esc(label(t))+'</th>'; }).join('')+'</tr>';
  var rows=r.learners.map(function(L){
    var st=lstatus(L);
    return '<tr><th scope="row">'+esc(learnerName(L))+'<small>'+esc([L.role,L.firm].filter(Boolean).join(' · ')||L.files.join(', '))+'</small><span class="st '+st.cls+'">'+esc(st.text)+'</span></th>'
      +TR.map(function(t){ return '<td>'+statusCell(L.cells[t.id])+'</td>'; }).join('')+'</tr>';
  }).join('');
  return '<div class="tblwrap" tabindex="0" role="region" aria-label="Register: learners by lesson (scrolls sideways on small screens)"><table class="mx"><caption class="sr">Training register at '+esc(fmtDate(r.asOf))+'</caption><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>'
    +'<p class="legend"><span class="st current">Valid</span> completed, inside the refresher interval <span class="st due-soon">Due soon</span> refresher within 30 days <span class="st overdue">Overdue</span> refresher date passed <span class="st outstanding">Missing</span> required, never completed</p>';
}
function moduleTableHTML(r){
  var rows=TR.filter(function(t){ return r.byModule[t.id].required; }).map(function(t){
    var m=r.byModule[t.id];
    return '<tr><th scope="row" style="font-weight:600">'+t.no+'. '+esc(t.title)+'</th><td class="n">'+m.current+'</td><td class="n">'+m.dueSoon+'</td><td class="n">'+m.overdue+'</td><td class="n">'+m.outstanding+'</td><td class="n">'+(m.pct==null?'n/a':m.pct+'%')+'</td></tr>';
  }).join('');
  if(!rows) return '';
  return '<h3 class="sec" style="font-size:12px;font-family:var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-2);margin:22px 0 10px">By required lesson</h3>'
    +'<div class="tblwrap" tabindex="0" role="region" aria-label="Completion by required lesson"><table class="small-table"><thead><tr><th scope="col">Lesson</th><th scope="col" class="n">Valid</th><th scope="col" class="n">of which due soon</th><th scope="col" class="n">Overdue</th><th scope="col" class="n">Missing</th><th scope="col" class="n">Rate</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function packHTML(r){
  var L=r.learners, k=r.required.length, a12=(META.evidence||{}).art12||{};
  var rows=TR.filter(function(t){ return r.byModule[t.id].required; }).map(function(t){
    var m=r.byModule[t.id];
    return '<tr><td>'+t.no+'. '+esc(t.title)+'</td><td>'+esc(oblText((MAP[t.id]||{}).obligations)||'none mapped')+'</td><td class="n">'+m.current+'</td><td class="n">'+m.dueSoon+'</td><td class="n'+(m.overdue?' ov':'')+'">'+m.overdue+'</td><td class="n'+(m.outstanding?' ov':'')+'">'+m.outstanding+'</td><td class="n">'+(m.pct==null?'n/a':m.pct+'%')+'</td></tr>';
  }).join('');
  /* the pack lists learners who need action first, then the rest alphabetically; at most LIST_MAX so it stays one page */
  var shown=L.slice().sort(function(a,b){ return (a.summary.upToDate?1:0)-(b.summary.upToDate?1:0) || (b.summary.overdue-a.summary.overdue) || (b.summary.outstanding-a.summary.outstanding); }).slice(0,LIST_MAX);
  var lrows=shown.map(function(x){
    var st=lstatus(x), s=x.summary;
    return '<tr><td class="nm" title="'+esc(learnerName(x))+'">'+esc(learnerName(x))+'</td><td class="rf">'+esc([x.role,x.firm].filter(Boolean).join(' · '))+'</td><td class="n">'+s.current+' of '+s.required+'</td><td class="n">'+esc(fmtDate(s.last)||'none')+'</td><td class="'+(x.summary.upToDate?'okc':'ov')+'">'+esc(st.text)+'</td></tr>';
  }).join('');
  return '<article class="sheet pack" id="pack" aria-label="Training evidence pack, preview">'
    +'<div class="sh-top"><div class="sh-brand"><small>RegRadar Academy</small>Learning path</div><div class="sh-badge">Self-attested · prototype</div></div>'
    +'<h2 class="sh-title">Training evidence pack</h2>'
    +'<p class="sh-scope">Report date '+esc(fmtDate(r.asOf))+' · '+plural(L.length,'learner')+' · '+plural(k,'required lesson')+' of '+TR.length+'</p>'
    +'<h3>Scope and period</h3><div class="two"><dl><dt>Learners</dt><dd>'+L.length+'</dd><dt>Source files</dt><dd>'+S.sources.length+' ('+esc(intText(r))+')</dd>'
    +'<dt>Completions dated</dt><dd>'+(r.period.first? esc(fmtDate(r.period.first))+' to '+esc(fmtDate(r.period.last)) : 'none')+'</dd></dl>'
    +'<dl><dt>Refresher</dt><dd>'+(r.months? 'every '+r.months+' months' : 'none')+' (default 12, configure for your firm)</dd>'
    +'<dt>Content versions</dt><dd>'+esc(versionText(r))+'</dd><dt>Current content</dt><dd>'+esc(META.content_version||'n/a')+(META.content_date? ' ('+esc(fmtDate(META.content_date))+')' : '')+'</dd></dl></div>'
    +'<p style="margin-top:10px;font-weight:700">'+esc(coverageLine(r))+'</p>'
    +(k? '<h3>Completion by required lesson, with the AMLR obligations it trains on</h3><div class="tw" tabindex="0" role="region" aria-label="Completion by required lesson"><table><thead><tr><th>Lesson</th><th>Related AMLR obligations</th><th class="n">Valid</th><th class="n">Due soon</th><th class="n">Overdue</th><th class="n">Missing</th><th class="n">Rate</th></tr></thead><tbody>'+rows+'</tbody></table></div>' : '')
    +(L.length? '<h3>Learners</h3><div class="tw" tabindex="0" role="region" aria-label="Learners and their status"><table><thead><tr><th>Learner</th><th>Role · firm</th><th class="n">Valid</th><th class="n">Last completion</th><th>Status</th></tr></thead><tbody>'+lrows+'</tbody></table></div>'
      +(L.length>LIST_MAX? '<p class="more">Showing '+LIST_MAX+' of '+L.length+' learners, those needing action first. The register CSV lists everyone.</p>' : '') : '')
    +'<h3>AMLR Art. 12</h3><blockquote style="margin-top:0">“… '+esc(a12.quote||'')+'”<br><span class="cite">AMLR (Regulation (EU) 2024/1624), Art. 12, '+esc(a12.para||'')+'.</span></blockquote>'
    +'<p class="fine" style="margin-top:8px">Self-attested by each learner\'s device record: not verified by RegRadar or any regulator, not accredited or regulator-approved, no CPD hours claimed. '
    +'Whether training is “appropriate to their functions” is the firm\'s judgement. Register integrity code <b class="mono">'+esc(r.code)+'</b> is a short hash of the register contents, not a signature. Practice cases and CF Bank are fictional. Not legal advice.</p>'
    +'</article>';
}
function resultsHTML(){
  var r=compute();
  if(!r.learners.length){
    return '<div class="empty noprint"><h2>No learners yet</h2><p>Load one or more completion files above, or try the register with four fictional demo learners.</p><button type="button" class="btn pri" data-act="demo">Load demo learners (fictional)</button></div>';
  }
  var c=r.coverage;
  var h='<div class="noprint"><h2 class="sec" style="font-size:12px;font-family:var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-2);margin-bottom:10px">3. Register</h2>'
    +'<div class="kpis k3"><div class="kpi"><div class="n">'+c.learners+'</div><div class="l">Learners</div></div>'
    +'<div class="kpi"><div class="n">'+c.upToDate+'<small> of '+c.learners+'</small></div><div class="l">Up to date'+(c.upToDatePct==null?'':' ('+c.upToDatePct+'%)')+'</div></div>'
    +'<div class="kpi"><div class="n">'+c.overdue+'</div><div class="l">Overdue refreshers</div></div>'
    +'<div class="kpi"><div class="n">'+c.outstanding+'</div><div class="l">Missing completions</div></div></div>'
    +'<p class="cover" id="coverage">'+esc(coverageLine(r))+'</p>'
    +'<div class="tools"><div class="seg views" role="group" aria-label="View"><button type="button" data-act="view" data-v="register" aria-pressed="'+(S.view==='register')+'">Register</button>'
    +'<button type="button" data-act="view" data-v="pack" aria-pressed="'+(S.view==='pack')+'">Evidence pack</button></div>'
    +'<button type="button" class="btn" data-act="regcsv">Export register (CSV)</button>'
    +'<button type="button" class="btn pri" data-act="print">Print evidence pack</button></div>'
    +'<p class="note-live" id="evNote"></p></div>';
  if(S.view==='register') h+='<div class="noprint">'+matrixHTML(r)+moduleTableHTML(r)+'</div>';
  else h+='<div class="sheetwrap">'+packHTML(r)+'</div>';
  return h;
}
function draw(){
  var fl=document.getElementById('fileList'); if(fl) fl.innerHTML=filesHTML();
  var cb=document.getElementById('clearBtn'); if(cb) cb.disabled=!S.sources.length;
  var res=document.getElementById('results'); if(res) res.innerHTML=resultsHTML();
}

/* ── loading files ── */
function readFile(f){
  return new Promise(function(resolve){
    var bad=function(msg){ resolve({name:f.name, kind:'json', learners:[], integrity:'none', warnings:[msg], ok:false}); };
    if(f.size>MAX_BYTES) return bad('File is larger than 2 MB.');
    var rd=new FileReader();
    rd.onerror=function(){ bad('Could not read the file.'); };
    rd.onload=function(){
      var text=String(rd.result||''), known=ids();
      if(/\.csv$/i.test(f.name) || (!/\.json$/i.test(f.name) && !/^\s*[\[{]/.test(text))) return resolve(AE.importCSV(text, f.name, known));
      var obj; try{ obj=JSON.parse(text); }catch(e){ return bad('Not valid JSON.'); }
      if(Array.isArray(obj)){
        var parts=obj.map(function(o,i){ return AE.importJSON(o, f.name+' #'+(i+1), known); });
        var ok=parts.filter(function(p){ return p.ok; });
        var s={name:f.name, kind:'json', learners:[], integrity:'none', warnings:[], ok:ok.length>0};
        ok.forEach(function(p){ s.learners=s.learners.concat(p.learners); s.warnings=s.warnings.concat(p.warnings); });
        if(ok.length<parts.length) s.warnings.push((parts.length-ok.length)+' entr'+(parts.length-ok.length>1?'ies':'y')+' skipped (not a completions record).');
        s.integrity= ok.some(function(p){ return p.integrity==='mismatch'; })? 'mismatch' : ok.length && ok.every(function(p){ return p.integrity==='match'; })? 'match' : 'none';
        return resolve(s);
      }
      resolve(AE.importJSON(obj, f.name, known));
    };
    rd.readAsText(f);
  });
}
function addFiles(list){
  var files=Array.prototype.slice.call(list||[]); if(!files.length) return;
  Promise.all(files.map(readFile)).then(function(srcs){
    var added=0, dup=0;
    srcs.forEach(function(s){
      if(S.sources.some(function(x){ return x.name===s.name; })){ dup++; return; }
      S.sources.push(s); added++;
    });
    draw();
    var res=compute();
    say('Loaded '+plural(added,'file')+(dup? ', skipped '+dup+' already loaded' : '')+'. '+plural(res.learners.length,'learner')+' in the register.');
  });
}
function loadDemo(){
  if(S.sources.some(function(s){ return s.kind==='demo'; })) return;
  var go=function(d){
    var t=new Date(); var base=Date.UTC(t.getFullYear(),t.getMonth(),t.getDate());
    var learners=d.learners.map(function(L){ return {name:L.name, role:L.role, firm:L.firm, completions:L.completions.filter(function(c){ return ids().indexOf(c.module)>=0; }).map(function(c){
      return {module:c.module, completedAt:new Date(base-c.daysAgo*86400000).toISOString(), score:c.score, max:c.max, contentVersion:c.contentVersion}; })}; });
    S.sources.push({name:'Demo learners (fictional)', kind:'demo', learners:learners, integrity:'none', warnings:['Invented names and dates, for trying the register.'], ok:true});
    draw(); say('Demo learners loaded: '+plural(learners.length,'learner')+'.');
  };
  if(DEMO) return go(DEMO);
  fetch('data/academy/demo-learners.json').then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(d){ DEMO=d; go(d); })
    .catch(function(){ say('The demo data could not be loaded.'); });
}

/* ── events ── */
function download(name,type,text){
  var blob=new Blob([text],{type:type}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
}
function note(m){ var n=document.getElementById('evNote'); if(n) n.textContent=m; say(m); }
function focusBtn(sel){ var b=APP.querySelector(sel); if(b) b.focus(); }
APP.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b || b.disabled) return;
  var act=b.dataset.act;
  if(act==='choose'){ document.getElementById('fileIn').click(); return; }
  if(act==='demo'){ loadDemo(); return; }
  if(act==='clearfiles'){ S.sources=[]; draw(); say('All files removed from this page.'); return; }
  if(act==='remove'){ var i=+b.dataset.i, nm=S.sources[i]&&S.sources[i].name; S.sources.splice(i,1); draw(); say((nm||'File')+' removed.'); return; }
  if(act==='defaults'){
    AE.clearKeys(); S.cfg=AE.defaultConfig(); S.asOf=today();
    var m=document.getElementById('fMonths'); if(m) m.value=S.cfg.months;
    var a=document.getElementById('fAsOf'); if(a) a.value=asOf();
    APP.querySelectorAll('[data-req]').forEach(function(x){ x.checked=true; });
    draw(); say('Rules reset to defaults.'); return;
  }
  if(act==='view'){ S.view=b.dataset.v; draw(); focusBtn('[data-act="view"][aria-pressed="true"]'); return; }
  if(act==='regcsv'){
    var r=compute(); download('regradar-training-register-'+r.asOf+'.csv','text/csv;charset=utf-8',AE.registerCSV(r, TITLES, MAP));
    return note('Register exported as CSV ('+AE.registerRows(r, TITLES, MAP).length+' rows).');
  }
  if(act==='print'){
    if(S.view!=='pack'){ S.view='pack'; draw(); }
    var old=document.title; document.title='RegRadar Academy training evidence pack '+asOf();
    setTimeout(function(){ window.print(); document.title=old; },60); return;
  }
});
APP.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='fileIn'){ addFiles(t.files); t.value=''; return; }
  if(t.dataset && t.dataset.req){
    var chosen=[]; APP.querySelectorAll('[data-req]').forEach(function(x){ if(x.checked) chosen.push(x.dataset.req); });
    S.cfg.required= chosen.length===TR.length? null : chosen; AE.saveConfig(S.cfg); draw(); return;
  }
  if(t.id==='fMonths'){
    var v=Math.floor(Number(t.value)); if(!isFinite(v)||v<0) v=12; if(v>120) v=120;
    t.value=v; S.cfg.months=v; AE.saveConfig(S.cfg); draw(); return;
  }
  if(t.id==='fAsOf'){ S.asOf=t.value||today(); if(!t.value) t.value=asOf(); draw(); }
});
['dragenter','dragover'].forEach(function(ev){ APP.addEventListener(ev,function(e){ var d=e.target.closest('#drop'); if(!d) return; e.preventDefault(); d.classList.add('over'); }); });
['dragleave','drop'].forEach(function(ev){ APP.addEventListener(ev,function(e){ var d=e.target.closest('#drop'); if(!d) return; e.preventDefault(); d.classList.remove('over'); if(ev==='drop') addFiles(e.dataTransfer.files); }); });

/* ── boot ── */
function getJSON(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(u+' '+r.status); return r.json(); }); }
Promise.all([getJSON('data/academy/curriculum.json'), getJSON('data/academy/module-map.json').catch(function(){ return {modules:{}}; }),
  getJSON('data/academy/rounds.json').catch(function(){ return {_meta:{}}; })])
.then(function(r){
  CUR=r[0]; META=CUR._meta||{}; TR=CUR.tracks; MAP=r[1].modules||{}; LABELS=(r[2]._meta||{}).labels||{};
  TR.forEach(function(t){ TITLES[t.id]=t.title; });
  S.asOf=today();
  /* keep only required ids that still exist */
  if(S.cfg.required){ S.cfg.required=S.cfg.required.filter(function(i){ return TITLES[i]; }); if(S.cfg.required.length===TR.length) S.cfg.required=null; }
  APP.innerHTML=pageHTML(); draw();
  /* #demo loads the fictional demo learners; #pack opens the evidence pack view */
  if(/(^|[#&-])pack\b/.test(location.hash)){ S.view='pack'; }
  if(/(^|[#&-])demo\b/.test(location.hash)) loadDemo(); else if(S.view==='pack') draw();
}).catch(function(e){
  APP.innerHTML='<header class="head"><div><div class="kicker">REGRADAR ACADEMY · EVIDENCE</div><h1>The register could not load</h1><p>Open this page from the RegRadar site (it reads small data files). <a href="academy.html">Back to the Academy</a>.</p></div></header>';
  if(window.console) console.warn('Academy register: '+e.message);
});
})();
