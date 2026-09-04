/* ═══════════════════════════════════════════════════════════════════
   GLOSSARY — a global AML/KYC term dictionary with hover/tap tooltips.
   ───────────────────────────────────────────────────────────────────
   Terms aren't hand-marked in case content — Glossary.enhance(root)
   scans rendered text under `root` and wraps the first mention of each
   known term in a <span class="gl-term">, so every existing and future
   case brief, CIF page, or verdict gets coverage automatically instead
   of requiring every case JSON to be retrofitted by hand.

   Colors ride the same --ink/--grid/--console/--mono token contract as
   academy-engine.css, so the same tooltip renders correctly on every
   Academy page's own palette.
   ═══════════════════════════════════════════════════════════════════ */
window.Glossary = (function(){
'use strict';

/* id: canonical key (also the glossary.html anchor).
   m: match strings, longest-first isn't required — the builder sorts.
   t: tooltip title. d: one-two sentence, plain-English definition. */
const TERMS = [
  {id:'pep', m:['PEPs','PEP','politically exposed persons','politically exposed person'],
   t:'PEP — Politically Exposed Person',
   d:'A person who holds or has held a prominent public function, or their close family and associates. PEP status isn’t itself suspicious, but it raises exposure to corruption and bribery risk, which is why it triggers enhanced due diligence.'},
  {id:'ubo', m:['UBOs','UBO','beneficial owners','beneficial owner','beneficial ownership'],
   t:'UBO — Ultimate Beneficial Owner',
   d:'The natural person(s) who ultimately own or control a legal entity, directly or through a chain of ownership — typically at a 25% threshold, or by other means of control.'},
  {id:'cdd', m:['CDD'],
   t:'CDD — Customer Due Diligence',
   d:'The baseline checks every customer gets at onboarding and throughout the relationship: identity verification, understanding the business relationship, and ongoing monitoring.'},
  {id:'edd', m:['EDD'],
   t:'EDD — Enhanced Due Diligence',
   d:'A deeper level of CDD applied to higher-risk customers — more evidence, more frequent review, senior sign-off — triggered by factors like PEP status, high-risk jurisdictions, or complex ownership.'},
  {id:'sow', m:['SoW', 'source of wealth'],
   t:'SoW — Source of Wealth',
   d:'The origin of a customer’s overall wealth — how they accumulated their net worth over time, not just the funds in one transaction.'},
  {id:'sof', m:['SoF', 'source of funds'],
   t:'SoF — Source of Funds',
   d:'The origin of the specific funds used in a particular transaction or relationship — narrower than source of wealth.'},
  {id:'adverse-media', m:['adverse media', 'negative media'],
   t:'Adverse Media',
   d:'Negative news or public information about a customer — fraud, corruption, sanctions evasion — screened for as part of risk assessment, distinct from a formal criminal record.'},
  {id:'sanctions', m:['sanctions screening', 'sanctions'],
   t:'Sanctions',
   d:'Legal restrictions — asset freezes, transaction bans — imposed on listed individuals, entities, or countries. Screening checks customers and counterparties against consolidated sanctions lists.'},
  {id:'str-sar', m:['STR/SAR', 'STR', 'SAR', 'suspicious transaction report', 'suspicious activity report'],
   t:'STR/SAR — Suspicious Transaction/Activity Report',
   d:'A formal report filed with the Financial Intelligence Unit when a transaction or pattern is suspected of being linked to money laundering or terrorist financing.'},
  {id:'rba', m:['risk-based approach', 'risk based approach'],
   t:'Risk-Based Approach',
   d:'The principle that AML controls should scale with the actual risk a customer or relationship presents, rather than applying identical checks to everyone.'},
  {id:'tm', m:['transaction monitoring'],
   t:'Transaction Monitoring',
   d:'Ongoing, often automated, screening of account activity for patterns that don’t match the customer’s expected profile — the main tool for catching laundering after onboarding.'},
  {id:'kyc', m:['KYC'],
   t:'KYC — Know Your Customer',
   d:'The overall process of verifying a customer’s identity and understanding their risk profile. CDD and EDD are both part of KYC.'},
  {id:'kyb', m:['KYB'],
   t:'KYB — Know Your Business',
   d:'KYC applied to a corporate customer — verifying the entity’s legal existence, structure, and the individuals who own and control it.'},
  {id:'fiu', m:['FIU'],
   t:'FIU — Financial Intelligence Unit',
   d:'The national body that receives, analyses, and acts on suspicious transaction reports — in Belgium, this is CTIF-CFI.'},
  {id:'mlro', m:['MLRO'],
   t:'MLRO — Money Laundering Reporting Officer',
   d:'The person within a firm legally responsible for AML compliance and for deciding whether a suspicion is reported to the FIU.'},
  {id:'nominee', m:['nominee shareholder', 'nominee'],
   t:'Nominee',
   d:'A person or entity holding legal title to shares or assets on behalf of someone else — the nominee is not the real economic owner.'},
  {id:'shell-company', m:['shell company', 'shell companies'],
   t:'Shell Company',
   d:'A company with no real operations, employees, or physical presence — often used to obscure ownership or move funds through layers.'},
  {id:'structuring', m:['structuring'],
   t:'Structuring',
   d:'Deliberately splitting a large transaction into smaller ones to stay under a reporting or identification threshold.'},
  {id:'cif', m:['CIF'],
   t:'CIF — Customer Information File',
   d:'The internal record holding everything the bank knows about a customer — identity, risk rating, ownership, activity history.'},
  {id:'aml', m:['AML'],
   t:'AML — Anti-Money Laundering',
   d:'The laws, regulations, and internal controls designed to prevent, detect, and report the laundering of criminal proceeds.'},
];
const BY_ID = {}; TERMS.forEach(t=>BY_ID[t.id]=t);

/* One alias -> term map, and one regex built from all aliases (longest
   first, so "source of wealth" wins over any shorter overlapping
   alias). Case-insensitive: this app's text is professional case-file
   prose, not free-form user content, so the false-positive risk of a
   lowercase match is low and the coverage gain is worth it. */
const ALIAS_TO_TERM = {};
const ALL_ALIASES = [];
TERMS.forEach(term=>term.m.forEach(alias=>{
  ALIAS_TO_TERM[alias.toLowerCase()] = term;
  ALL_ALIASES.push(alias);
}));
ALL_ALIASES.sort((a,b)=>b.length-a.length);
const escapeRe = s=>s.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');
const MATCH_RE = new RegExp('\\b(' + ALL_ALIASES.map(escapeRe).join('|') + ')\\b', 'gi');

const SKIP_TAGS = new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','BUTTON','A']);

function collectTextNodes(root){
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node){
      if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p = node.parentElement;
      if(!p) return NodeFilter.FILTER_REJECT;
      if(SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if(p.closest('.gl-term, .gl-tip')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n; while((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

function wrapNode(node, seen){
  const text = node.nodeValue;
  MATCH_RE.lastIndex = 0;
  let m, cursor = 0, frag = null;
  while((m = MATCH_RE.exec(text))){
    const term = ALIAS_TO_TERM[m[0].toLowerCase()];
    if(!term || seen.has(term.id)) continue;   // first mention per enhance() call only
    seen.add(term.id);
    if(!frag) frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(text.slice(cursor, m.index)));
    const span = document.createElement('span');
    span.className = 'gl-term';
    span.dataset.term = term.id;
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', term.t + ' — glossary term');
    span.textContent = m[0];
    frag.appendChild(span);
    cursor = m.index + m[0].length;
  }
  if(frag){
    frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }
}

/* Scans `root`, wrapping the first mention of each term found under it.
   Safe to call repeatedly (e.g. after every re-render) — already-
   wrapped spans are skipped, not re-processed. */
function enhance(root){
  if(!root) return;
  const seen = new Set();
  collectTextNodes(root).forEach(n=>wrapNode(n, seen));
}

/* ── tooltip UI ── */
let tipEl = null, openSpan = null, hoverTimer = null, hideTimer = null;
const hoverCapable = window.matchMedia && window.matchMedia('(hover: hover)').matches;

function ensureTip(){
  if(tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'gl-tip';
  tipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tipEl);
  return tipEl;
}

function place(span){
  const tip = ensureTip();
  const r = span.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  tip.style.visibility = 'hidden';
  tip.style.display = 'block';
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = r.left + r.width/2 - tw/2;
  left = Math.max(8, Math.min(left, vw - tw - 8));
  let top = r.bottom + 8, flipped = false;
  if(top + th > vh - 8){ top = r.top - th - 8; flipped = true; }
  tip.style.left = left + 'px';
  tip.style.top = Math.max(8, top) + 'px';
  tip.classList.toggle('gl-flip', flipped);
  tip.style.visibility = 'visible';
}

function openTip(span){
  const term = BY_ID[span.dataset.term]; if(!term) return;
  clearTimeout(hideTimer);
  const tip = ensureTip();
  tip.innerHTML = `<div class="gl-t">${escHtml(term.t)}</div><div class="gl-d">${escHtml(term.d)}</div>
    <a class="gl-more" href="glossary.html#${term.id}" target="_blank" rel="noopener">Learn more →</a>`;
  openSpan = span;
  span.classList.add('gl-on');
  place(span);
  tip.classList.add('on');
}
function closeTip(){
  if(!tipEl) return;
  tipEl.classList.remove('on');
  if(openSpan) openSpan.classList.remove('gl-on');
  openSpan = null;
}
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('mouseenter', e=>{
  const span = e.target.closest && e.target.closest('.gl-term');
  if(!span || !hoverCapable) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(()=>openTip(span), 200);
}, true);
document.addEventListener('mouseleave', e=>{
  const span = e.target.closest && e.target.closest('.gl-term');
  if(!span || !hoverCapable) return;
  clearTimeout(hoverTimer);
  hideTimer = setTimeout(closeTip, 150);
}, true);
document.addEventListener('focusin', e=>{
  const span = e.target.closest && e.target.closest('.gl-term');
  if(span) openTip(span);
});
document.addEventListener('focusout', e=>{
  const span = e.target.closest && e.target.closest('.gl-term');
  if(span) closeTip();
});
document.addEventListener('click', e=>{
  const span = e.target.closest && e.target.closest('.gl-term');
  if(span){ e.stopPropagation(); openSpan===span ? closeTip() : openTip(span); return; }
  if(!e.target.closest('.gl-tip')) closeTip();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeTip(); });
window.addEventListener('scroll', ()=>{ if(openSpan) place(openSpan); }, true);
window.addEventListener('resize', ()=>{ if(openSpan) place(openSpan); });

/* ── auto-enhance: any page that includes this script gets coverage
      for free, including modules built after this file was written —
      no per-page wiring, no render function to remember to call.
      The observer disconnects itself during enhance()'s own DOM
      writes to avoid re-triggering on its own mutations. ── */
let observer = null, pending = false;
function runEnhance(){
  if(!document.body) return;
  if(observer) observer.disconnect();
  enhance(document.body);
  if(observer) observer.observe(document.body, {childList:true, subtree:true});
}
function scheduleEnhance(){
  if(pending) return;
  pending = true;
  setTimeout(()=>{ pending=false; runEnhance(); }, 180);
}
function start(){
  runEnhance();
  observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, {childList:true, subtree:true});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();

return {enhance, terms: TERMS};
})();
