/* ═══════════════════════════════════════════════════════════════════
   ACADEMY EVIDENCE — the pure logic behind the certificate and the register
   ───────────────────────────────────────────────────────────────────
   No DOM, no network, no dependencies. Used by academy-certificate.js and
   academy-register.js in the browser, and by academy/evidence.test.mjs in
   node. AMLR Art. 12 asks for training programmes that are "duly
   documented"; this file turns the Academy's device-local completion
   records into documents a buyer can keep (certificate, JSON, CSV) and a
   compliance officer can merge (register, overdue logic, evidence pack).

   Honesty rules baked in:
   - Everything is SELF-ATTESTED by the device record. Nothing here proves
     who the learner is or that a record was not edited.
   - The verification code is an INTEGRITY code (a short non-cryptographic
     hash of the record contents). It catches accidental changes. It is not
     a digital signature: anyone can recompute it.

   Storage keys introduced here (the existing progress keys are untouched):
     regradar-academy-learner          {v:1, name, role, firm}  optional, typed by the learner
     regradar-academy-register-config  {v:1, required:[ids]|null, months, dueSoonDays}
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var FORMAT='regradar-academy-completions';
var KEYS={learner:'regradar-academy-learner', config:'regradar-academy-register-config'};
var ART12='AMLR (Regulation (EU) 2024/1624) Art. 12, second paragraph: training programmes "duly documented"';
var STATEMENT='This record evidences that the learner completed the RegRadar Academy lessons listed, as self-attested by the device record '
  +'(progress saved in the learner\'s own browser). It has not been verified by RegRadar, by an employer or by any regulator. '
  +'It is not an accredited, regulator-approved or CPD-certified qualification. RegRadar is a prototype and every practice case is fictional.';
var CODE_NOTE='Integrity code: a short hash of the record contents. It shows whether the record was changed after it was created. '
  +'It is not a digital signature: anyone can recompute it, and it does not prove who the learner is.';
var CSV_HEAD=['learner','role','firm','module_id','module_title','completed_on','score','max_score','content_version','related_amlr_obligations','art12_reference'];
var REGISTER_HEAD=CSV_HEAD.concat(['status','refresher_due_on']);

/* ── canonical JSON and the integrity code ─────────────────────── */
function canonical(v){
  if(v===null || typeof v!=='object') return JSON.stringify(v===undefined? null : v);
  if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).filter(function(k){ return v[k]!==undefined; }).sort().map(function(k){ return JSON.stringify(k)+':'+canonical(v[k]); }).join(',')+'}';
}
/* cyrb53: a small, well-known 53-bit non-cryptographic hash. Same result in every JS engine. */
function cyrb53(str){
  var h1=0xdeadbeef, h2=0x41c6ce57, ch;
  for(var i=0;i<str.length;i++){ ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507); h1^=Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507); h2^=Math.imul(h1^(h1>>>13),3266489909);
  return 4294967296*(2097151&h2)+(h1>>>0);
}
function codeOf(obj){
  var hex=cyrb53(canonical(obj)).toString(16).toUpperCase();
  while(hex.length<14) hex='0'+hex;
  hex=hex.slice(-12);
  return 'RR-'+hex.slice(0,4)+'-'+hex.slice(4,8)+'-'+hex.slice(8,12);
}
function withoutIntegrity(rec){ var o={}; Object.keys(rec).forEach(function(k){ if(k!=='integrity') o[k]=rec[k]; }); return o; }

/* ── small helpers ─────────────────────────────────────────────── */
function clean(s,max){ return String(s==null?'':s).replace(/\s+/g,' ').trim().slice(0,max||120); }
function oblLabel(id){ var m=/^AMLR-art(\d+)$/.exec(id||''); return m? 'AMLR Art. '+m[1] : String(id||''); }
function dateOnly(v){
  if(v==null||v==='') return null;
  var s=String(v).trim(), m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if(m){ var t=Date.UTC(+m[1],+m[2]-1,+m[3]); var d=new Date(t); return d.getUTCFullYear()===+m[1] && d.getUTCMonth()===+m[2]-1 && d.getUTCDate()===+m[3]? m[1]+'-'+m[2]+'-'+m[3] : null; }
  var p=Date.parse(s); return isNaN(p)? null : new Date(p).toISOString().slice(0,10);
}
function utc(d){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return Date.UTC(+m[1],+m[2]-1,+m[3]); }
function pad(n){ return (n<10?'0':'')+n; }
function addMonths(d,n){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d); if(!m) return null;
  var y=+m[1], mo=+m[2]-1+n, day=+m[3];
  y+=Math.floor(mo/12); mo=((mo%12)+12)%12;
  var last=new Date(Date.UTC(y,mo+1,0)).getUTCDate();
  return y+'-'+pad(mo+1)+'-'+pad(Math.min(day,last));
}
function daysBetween(a,b){ return Math.round((utc(b)-utc(a))/86400000); }
function num(v){ if(v===null||v===undefined||v==='') return null; var n=Number(v); return isFinite(n)? n : null; }

/* ── scopes: whole path, a season (three lessons), one lesson ──── */
function scopes(tracks){
  var out=[{id:'all', label:'Whole path', modules:tracks.map(function(t){ return t.id; })}];
  for(var s=0;s*3<tracks.length;s++){
    var ts=tracks.slice(s*3,s*3+3);
    out.push({id:'season-'+(s+1), label:'Season '+(s+1)+' (lessons '+ts[0].no+' to '+ts[ts.length-1].no+')', modules:ts.map(function(t){ return t.id; })});
  }
  tracks.forEach(function(t){ out.push({id:'lesson:'+t.id, label:'Lesson '+t.no+': '+t.title, modules:[t.id]}); });
  return out;
}

/* ── the certificate record ────────────────────────────────────── */
/* opts: {learner:{name,role,firm}, tracks, completions (AcademyProgress.get().completions),
          scope:{id,label,modules}, issued:'YYYY-MM-DD', content:{version,date}, map:{module:{obligations:[]}}} */
function buildRecord(o){
  var by={}; (o.completions||[]).forEach(function(c){ by[c.module]=c; });
  var L=o.learner||{};
  var list=[];
  o.tracks.forEach(function(t){
    if(o.scope.modules.indexOf(t.id)<0) return;
    var c=by[t.id]; if(!c) return;
    list.push({module:t.id, title:t.title, completedAt:c.completedAt, score:num(c.score), max:num(c.max),
      contentVersion:c.contentVersion||null, obligations:(((o.map||{})[t.id]||{}).obligations||[]).slice()});
  });
  var rec={
    format:FORMAT, v:1, issued:o.issued,
    learner:{name:clean(L.name), role:clean(L.role), firm:clean(L.firm)},
    programme:'RegRadar Academy learning path',
    scope:{id:o.scope.id, label:o.scope.label, lessonsInScope:o.scope.modules.length},
    content:{version:(o.content&&o.content.version)||null, date:(o.content&&o.content.date)||null},
    statement:STATEMENT,
    art12:ART12,
    completions:list
  };
  rec.integrity={code:codeOf(rec), method:'cyrb53 (53-bit, non-cryptographic) over the canonical JSON of this record without this field', note:CODE_NOTE};
  return rec;
}
function verifyRecord(rec){
  if(!rec || !rec.integrity || !rec.integrity.code) return 'none';
  return codeOf(withoutIntegrity(rec))===rec.integrity.code? 'match' : 'mismatch';
}

/* ── CSV ───────────────────────────────────────────────────────── */
/* Text cells that start with = + - @ (or a control character) are prefixed with an apostrophe,
   so a name typed as =HYPERLINK(...) cannot run as a spreadsheet formula. */
function csvCell(v){
  if(v===null||v===undefined) return '';
  if(typeof v==='number') return String(v);
  v=String(v);
  if(/^[=+\-@\t\r]/.test(v)) v="'"+v;
  return /[",\r\n]/.test(v)? '"'+v.replace(/"/g,'""')+'"' : v;
}
function unformula(s){ return String(s==null?'':s).replace(/^'([=+\-@])/, '$1'); }
function csvText(head,rows){ return [head].concat(rows).map(function(r){ return r.map(csvCell).join(','); }).join('\r\n')+'\r\n'; }
function parseCSV(text){
  text=String(text||'').replace(/^﻿/,'');
  var rows=[], row=[], cell='', q=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n' || c==='\r'){ if(c==='\r' && text[i+1]==='\n') i++; row.push(cell); cell=''; if(row.length>1 || row[0]!=='') rows.push(row); row=[]; }
    else cell+=c;
  }
  if(cell!=='' || row.length){ row.push(cell); if(row.length>1 || row[0]!=='') rows.push(row); }
  return rows;
}
function recordRows(rec, titles){
  var L=rec.learner||{};
  return (rec.completions||[]).map(function(c){
    return [L.name||'', L.role||'', L.firm||'', c.module, c.title||(titles&&titles[c.module])||c.module, dateOnly(c.completedAt)||'',
      num(c.score), num(c.max), c.contentVersion||'', (c.obligations||[]).join('|'), ART12];
  });
}
function recordCSV(rec){ return csvText(CSV_HEAD, recordRows(rec)); }

/* ── importing: JSON record or CSV register -> a "source" ──────── */
/* source: {name, kind, learners:[{name,role,firm,completions:[{module,completedAt,score,max,contentVersion}]}],
            integrity:'match'|'mismatch'|'none', warnings:[], ok:boolean} */
function importJSON(obj, fileName, known){
  var src={name:fileName||'file', kind:'json', learners:[], integrity:'none', warnings:[], ok:false};
  if(!obj || typeof obj!=='object' || obj.format!==FORMAT || obj.v!==1 || !Array.isArray(obj.completions)){
    src.warnings.push('Not a RegRadar Academy completions file (expected format "'+FORMAT+'", v 1).'); return src;
  }
  src.integrity=verifyRecord(obj);
  var L=obj.learner||{}, comps=[], bad=0, unk=0;
  obj.completions.forEach(function(c){
    var d=c && dateOnly(c.completedAt);
    if(!c || typeof c.module!=='string' || !d){ bad++; return; }
    if(known && known.indexOf(c.module)<0){ unk++; return; }
    comps.push({module:c.module, completedAt:c.completedAt, score:num(c.score), max:num(c.max), contentVersion:c.contentVersion||null});
  });
  if(bad) src.warnings.push(bad+' completion'+(bad>1?'s':'')+' skipped (missing module or date).');
  if(unk) src.warnings.push(unk+' completion'+(unk>1?'s':'')+' skipped (module not in this version of the curriculum).');
  src.learners.push({name:clean(L.name), role:clean(L.role), firm:clean(L.firm), completions:comps});
  src.ok=true; return src;
}
function importCSV(text, fileName, known){
  var src={name:fileName||'file', kind:'csv', learners:[], integrity:'none', warnings:[], ok:false};
  var rows=parseCSV(text);
  if(rows.length<1){ src.warnings.push('The file is empty.'); return src; }
  var head=rows[0].map(function(h){ return String(h).trim().toLowerCase().replace(/[\s-]+/g,'_'); });
  function ix(){ for(var a=0;a<arguments.length;a++){ var k=head.indexOf(arguments[a]); if(k>=0) return k; } return -1; }
  var iL=ix('learner','name'), iR=ix('role'), iF=ix('firm'), iM=ix('module_id','module'), iD=ix('completed_on','completion_date','completed'),
      iS=ix('score'), iX=ix('max_score','max'), iV=ix('content_version','version');
  if(iM<0 || iD<0){ src.warnings.push('Missing column: need at least module_id and completed_on.'); return src; }
  var map={}, order=[], bad=0, unk=0, anon=0;
  rows.slice(1).forEach(function(r){
    var name=clean(unformula(iL>=0? r[iL] : '')), role=clean(unformula(iR>=0? r[iR] : '')), firm=clean(unformula(iF>=0? r[iF] : ''));
    var k=name? name.toLowerCase()+'|'+firm.toLowerCase() : '|'+firm.toLowerCase();
    if(!map[k]){ map[k]={name:name, role:role, firm:firm, completions:[]}; order.push(k); if(!name) anon++; }
    var L=map[k]; if(role && !L.role) L.role=role;
    var mod=clean(r[iM]), raw=iD>=0? clean(r[iD],40) : '';
    if(!mod && !raw) return;                    /* placeholder row for an outstanding module */
    if(!raw) return;                            /* module listed, not completed */
    var d=dateOnly(raw);
    if(!mod || !d){ bad++; return; }
    if(known && known.indexOf(mod)<0){ unk++; return; }
    var sc=iS>=0? clean(r[iS],20) : '', mx=iX>=0? num(r[iX]) : null, sv=null;
    var frac=/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(sc);
    if(frac){ sv=Number(frac[1]); if(mx==null) mx=Number(frac[2]); } else sv=num(sc);
    L.completions.push({module:mod, completedAt:d, score:sv, max:mx, contentVersion:iV>=0? (clean(r[iV],20)||null) : null});
  });
  if(bad) src.warnings.push(bad+' row'+(bad>1?'s':'')+' skipped (unreadable date or module).');
  if(unk) src.warnings.push(unk+' row'+(unk>1?'s':'')+' skipped (module not in this version of the curriculum).');
  if(anon) src.warnings.push('Rows without a learner name are kept as an unnamed learner.');
  src.warnings.push('CSV files carry no integrity code.');
  src.learners=order.map(function(k){ return map[k]; });
  src.ok=true; return src;
}

/* ── merge, refresher and overdue logic ────────────────────────── */
/* opts: {modules:[ids in curriculum order], required:[ids], months:12 (0 = no refresher), dueSoonDays:30, asOf:'YYYY-MM-DD'}
   status of a required module for a learner:
     outstanding  never completed
     overdue      completed, but the refresher interval has passed (strictly after the due date)
     due-soon     refresher falls due within dueSoonDays
     current      completed and inside the interval
   A module that is not required still shows its completion (status as above) but never counts as outstanding. */
function statusOf(completedOn, asOf, months, soon){
  var dueOn=months>0? addMonths(completedOn, months) : null;
  if(!dueOn) return {status:'current', dueOn:null};
  if(daysBetween(dueOn, asOf)>0) return {status:'overdue', dueOn:dueOn};
  if(daysBetween(asOf, dueOn)<=soon) return {status:'due-soon', dueOn:dueOn};
  return {status:'current', dueOn:dueOn};
}
function merge(sources, o){
  var months=o.months>0? Math.floor(o.months) : 0, soon=o.dueSoonDays==null? 30 : o.dueSoonDays;
  var req={}; (o.required||[]).forEach(function(id){ req[id]=true; });
  var mods=o.modules, byKey={}, order=[], n=0;
  (sources||[]).forEach(function(s, si){
    (s.learners||[]).forEach(function(L, li){
      var key=L.name? L.name.toLowerCase()+'|'+(L.firm||'').toLowerCase() : 'anon|'+si+'|'+li;
      var e=byKey[key];
      if(!e){ e=byKey[key]={key:key, name:L.name||'', role:L.role||'', firm:L.firm||'', files:[], all:{}}; order.push(key); }
      if(L.role) e.role=L.role;
      if(e.files.indexOf(s.name)<0) e.files.push(s.name);
      (L.completions||[]).forEach(function(c){
        var d=dateOnly(c.completedAt); if(!d) return;
        var a=e.all[c.module]||(e.all[c.module]=[]);
        a.push({on:d, score:c.score, max:c.max, version:c.contentVersion||null});
      });
    });
  });
  var learners=order.map(function(key){
    var e=byKey[key], cells={}, sum={required:0, current:0, dueSoon:0, overdue:0, outstanding:0, completed:0, last:null};
    mods.forEach(function(m){
      var a=e.all[m]; a=a&&a.slice().sort(function(x,y){ return x.on<y.on? -1 : x.on>y.on? 1 : 0; });
      var isReq=!!req[m], cell={module:m, required:isReq, status:isReq?'outstanding':'none', completedOn:null, dueOn:null, score:null, max:null, version:null, repeats:0};
      if(a && a.length){
        var c=a[a.length-1], st=statusOf(c.on, o.asOf, months, soon);
        cell.status=st.status; cell.dueOn=st.dueOn; cell.completedOn=c.on; cell.score=c.score; cell.max=c.max; cell.version=c.version; cell.repeats=a.length-1;
        sum.completed++; if(!sum.last || c.on>sum.last) sum.last=c.on;
      }
      if(isReq){
        sum.required++;
        if(cell.status==='outstanding') sum.outstanding++;
        else if(cell.status==='overdue') sum.overdue++;
        else{ sum.current++; if(cell.status==='due-soon') sum.dueSoon++; }
      }
      cells[m]=cell;
    });
    sum.upToDate=sum.required>0 && sum.overdue===0 && sum.outstanding===0;
    return {key:key, name:e.name, role:e.role, firm:e.firm, files:e.files, cells:cells, summary:sum};
  });
  learners.sort(function(a,b){ return (a.name||'￿').toLowerCase()<(b.name||'￿').toLowerCase()? -1 : (a.name||'￿').toLowerCase()>(b.name||'￿').toLowerCase()? 1 : 0; });
  var byModule={};
  mods.forEach(function(m){
    var r={module:m, required:!!req[m], learners:learners.length, completed:0, current:0, dueSoon:0, overdue:0, outstanding:0, pct:null};
    learners.forEach(function(L){ var c=L.cells[m]; if(c.completedOn) r.completed++;
      if(!c.required) return;
      if(c.status==='outstanding') r.outstanding++; else if(c.status==='overdue') r.overdue++; else{ r.current++; if(c.status==='due-soon') r.dueSoon++; } });
    if(r.required && learners.length) r.pct=Math.round(100*r.current/learners.length);
    byModule[m]=r;
  });
  var slots=0, valid=0, ov=0, out=0, upTo=0, first=null, last=null, versions={}, noCode=0;
  learners.forEach(function(L){
    slots+=L.summary.required; valid+=L.summary.current; ov+=L.summary.overdue; out+=L.summary.outstanding; if(L.summary.upToDate) upTo++;
    mods.forEach(function(m){ var c=L.cells[m]; if(!c.completedOn) return;
      if(!first||c.completedOn<first) first=c.completedOn; if(!last||c.completedOn>last) last=c.completedOn;
      var v=c.version||'not recorded'; versions[v]=(versions[v]||0)+1; });
  });
  var integrity={match:0, mismatch:0, none:0}; (sources||[]).forEach(function(s){ integrity[s.integrity||'none']=(integrity[s.integrity||'none']||0)+1; });
  var res={asOf:o.asOf, months:months, dueSoonDays:soon, modules:mods.slice(), required:mods.filter(function(m){ return req[m]; }),
    learners:learners, byModule:byModule, versions:versions, integrity:integrity,
    period:{first:first, last:last},
    coverage:{learners:learners.length, upToDate:upTo, upToDatePct:learners.length? Math.round(100*upTo/learners.length) : null,
      slots:slots, valid:valid, validPct:slots? Math.round(100*valid/slots) : null, overdue:ov, outstanding:out}};
  res.code=codeOf({asOf:res.asOf, months:months, required:res.required, rows:learners.map(function(L){
    return {n:L.name, f:L.firm, c:mods.map(function(m){ var c=L.cells[m]; return c.completedOn? [m,c.completedOn,c.score,c.max,c.version] : null; }).filter(Boolean)}; })});
  return res;
}
/* One CSV row per learner x module that is required or completed. titles: {id:title}; map: module-map modules. */
function registerRows(res, titles, map){
  var out=[];
  res.learners.forEach(function(L){
    res.modules.forEach(function(m){
      var c=L.cells[m]; if(!c.required && !c.completedOn) return;
      out.push([L.name, L.role, L.firm, m, (titles&&titles[m])||m, c.completedOn||'', c.score, c.max, c.version||'',
        (((map||{})[m]||{}).obligations||[]).join('|'), ART12, c.status, c.dueOn||'']);
    });
  });
  return out;
}
function registerCSV(res, titles, map){ return csvText(REGISTER_HEAD, registerRows(res, titles, map)); }

/* ── optional device storage (new keys only) ───────────────────── */
function defStore(){ try{ return typeof localStorage!=='undefined'? localStorage : null; }catch(e){ return null; } }
function loadLearner(store){
  store=store||defStore(); var out={name:'', role:'', firm:''};
  try{ var p=JSON.parse(store.getItem(KEYS.learner)||'null'); if(p && p.v===1){ out.name=clean(p.name); out.role=clean(p.role); out.firm=clean(p.firm); } }catch(e){}
  return out;
}
function saveLearner(L, store){
  store=store||defStore();
  try{ var v={v:1, name:clean(L.name), role:clean(L.role), firm:clean(L.firm)};
    if(!v.name && !v.role && !v.firm) store.removeItem(KEYS.learner); else store.setItem(KEYS.learner, JSON.stringify(v)); return true; }catch(e){ return false; }
}
function defaultConfig(){ return {v:1, required:null, months:12, dueSoonDays:30}; }
function loadConfig(store){
  store=store||defStore(); var c=defaultConfig();
  try{ var p=JSON.parse(store.getItem(KEYS.config)||'null');
    if(p && p.v===1){ if(Array.isArray(p.required)) c.required=p.required.filter(function(x){ return typeof x==='string'; });
      if(isFinite(p.months) && p.months>=0 && p.months<=120) c.months=Math.floor(p.months); } }catch(e){}
  return c;
}
function saveConfig(c, store){
  store=store||defStore();
  try{ store.setItem(KEYS.config, JSON.stringify({v:1, required:c.required, months:c.months, dueSoonDays:c.dueSoonDays})); return true; }catch(e){ return false; }
}
/* Removes ONLY the keys this feature introduced. Training progress has its own button on the Academy hub. */
function clearKeys(store){
  store=store||defStore();
  try{ store.removeItem(KEYS.learner); store.removeItem(KEYS.config); return true; }catch(e){ return false; }
}

var api={FORMAT:FORMAT, KEYS:KEYS, ART12:ART12, STATEMENT:STATEMENT, CODE_NOTE:CODE_NOTE, CSV_HEAD:CSV_HEAD, REGISTER_HEAD:REGISTER_HEAD,
  canonical:canonical, cyrb53:cyrb53, codeOf:codeOf, oblLabel:oblLabel, dateOnly:dateOnly, addMonths:addMonths, daysBetween:daysBetween,
  scopes:scopes, buildRecord:buildRecord, verifyRecord:verifyRecord, recordRows:recordRows, recordCSV:recordCSV,
  csvCell:csvCell, csvText:csvText, parseCSV:parseCSV, importJSON:importJSON, importCSV:importCSV,
  statusOf:statusOf, merge:merge, registerRows:registerRows, registerCSV:registerCSV,
  loadLearner:loadLearner, saveLearner:saveLearner, loadConfig:loadConfig, saveConfig:saveConfig, defaultConfig:defaultConfig, clearKeys:clearKeys};
if(typeof module==='object' && module.exports) module.exports=api;
if(typeof window!=='undefined') window.AcademyEvidence=api;
})();
