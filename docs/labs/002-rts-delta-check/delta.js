(function(){
'use strict';
var KEY='regradar-lab-002-covered';
var IDS=['c_ident','c_data','c_timing','c_ubo','c_reg','c_agent','c_purpose','c_pep'];
var items=[],covered={};
try{covered=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){covered={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(covered));}catch(e){}}
function el(t,c,x){var n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n;}
function gaps(){return items.filter(function(i){return !covered[i.id];});}
function count(){
  var g=gaps().length;
  document.getElementById('count').textContent=g+' of '+items.length+' items need a template check';
}
function render(){
  var ul=document.getElementById('rows');ul.textContent='';
  items.forEach(function(i){
    var li=el('li','row');
    var top=el('div','top');top.appendChild(el('strong','',i.task));
    top.appendChild(el('span','pill draft','Draft only, not yet in force'));
    li.appendChild(top);
    var cols=el('div','cols');
    var a=el('div','col');a.appendChild(el('h3','','AMLR says ('+i.art+')'));
    a.appendChild(el('blockquote','','\u201C'+i.quote+'\u201D'));
    var b=el('div','col');b.appendChild(el('h3','','Draft RTS adds'));
    b.appendChild(el('p','ph','PLACEHOLDER (demo): the owner fills this from the final draft CDD RTS, with article reference and date. No requirement is asserted here.'));
    cols.appendChild(a);cols.appendChild(b);li.appendChild(cols);
    var lab=el('label','sw');var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!covered[i.id];
    cb.addEventListener('change',function(){covered[i.id]=cb.checked;save();count();});
    lab.appendChild(cb);lab.appendChild(el('span','','My template already covers this'));
    li.appendChild(lab);ul.appendChild(li);
  });
  count();
}
function q(s){s=String(s);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
document.getElementById('csvBtn').addEventListener('click',function(){
  var rows=[['id','task','amlr_ref','rts_status','template_covers']].concat(items.map(function(i){return [i.id,i.task,i.art,'draft only',covered[i.id]?'yes':'no'];}));
  var blob=new Blob([rows.map(function(r){return r.map(q).join(',');}).join('\r\n')],{type:'text/csv'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rts-delta-gap-list.csv';document.body.appendChild(a);a.click();a.remove();
});
document.getElementById('resetBtn').addEventListener('click',function(){covered={};save();render();});
fetch('../../data/cra-checklist.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
  var by={};d.items.forEach(function(i){by[i.id]=i;});
  items=IDS.map(function(id){return by[id];}).filter(Boolean);
  render();
}).catch(function(){document.getElementById('rows').textContent='';document.getElementById('count').textContent='Could not load the checklist data.';});
})();
