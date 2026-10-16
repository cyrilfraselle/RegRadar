/* ═══════════════════════════════════════════════════════════════════
   ACADEMY EXPLAINER — a small, reusable motion-explainer player
   ───────────────────────────────────────────────────────────────────
   The "motion design videos" of the Academy are not video files: they
   are short scenes drawn as inline SVG and animated with CSS, driven by
   plain JSON (docs/data/academy/explainers.json). This file is the whole
   player. No libraries, no fonts, no network requests.

     AcademyExplainer.mount(el, spec, {onComplete, onStep, onPlay})
     AcademyExplainer.frames(spec)      -> static SVG strings (tests, print)

   spec = { id, title, scenes:[ {title, caption, dur?, items:[...]} ] }

   Every scene has a real-text caption, so the explainer is fully
   readable with animation off: the transcript below the player repeats
   all captions in order. With prefers-reduced-motion the player never
   animates: it shows the finished frame of each scene and a step button.

   Canvas: 480 x 300 viewBox. The stage is shown between ~330 and 680 px
   wide, so SVG text is kept at >= 18 units (>= 12 px on a phone).

   Items (x, y in canvas units; d = delay in seconds into the scene):
     box    {x,y,w,h,text,tone,d,anim}       rounded card, text centred, "\n" = new line
     text   {x,y,text,s,anchor,tone,bold,d}  free label
     icon   {k,x,y,s,tone,d}                 glyph; k in ICONS below (x,y = top left)
     arrow  {pts:[x1,y1,x2,y2,...],tone,dash,d,dur}   line with arrow head at the end
     line   {pts:[...],tone,dash,d}          same, without the head
     token  {x,y,to:[x2,y2],text,tone,d,dur} a dot that travels from (x,y) to `to`
     meter  {x,y,w,h,v,tone,d,text}          horizontal bar filling to v (0..1)
     stamp  {x,y,text,tone,d}                rotated bordered label
     ring   {x,y,r,tone,d}                   circle outline (highlight)
   tone: brand | ok | warn | crit | violet | mute (default)
   anim: fade (default) | pop | none
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var W=480, H=300, MIN_TEXT=18;
var NS='http://www.w3.org/2000/svg';
var uid=0;

/* ── glyphs: 24 x 24 stroke icons ────────────────────────────────── */
var ICONS={
  person:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  doc:'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7',
  coin:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  flag:'M6 21V4M6 4h11l-2 4 2 4H6',
  check:'M4 12.5l5 5L20 6.5',
  cross:'M5 5l14 14M19 5L5 19',
  lock:'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bank:'M3 9l9-5 9 5zM5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
  globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bell:'M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  search:'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5',
  stop:'M8 3h8l5 5v8l-5 5H8l-5-5V8zM8 12h8',
  chain:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  chart:'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  warn:'M12 3l10 18H2zM12 10v5M12 18v.5',
  calendar:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  scale:'M12 4v16M5 20h14M4 8h16M6 8l-3 7a3 3 0 0 0 6 0zM18 8l-3 7a3 3 0 0 0 6 0z',
  server:'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01',
  cloud:'M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1A4.5 4.5 0 0 1 17 18z',
  mail:'M3 6h18v13H3zM3 7l9 7 9-7',
  list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'
};

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tn(t){ return /^(brand|ok|warn|crit|violet|mute)$/.test(t)?t:'mute'; }
function num(n){ return Math.round(n*10)/10; }
function dly(d){ return ' style="--d:'+num(d||0)+'s"'; }
function cls(base,it){ return base+(it.anim==='none'?' still':it.anim==='pop'?' pop':''); }

/* ── item renderers ──────────────────────────────────────────────── */
function lines(text,x,y,size,anchor,extra){
  var ls=String(text).split('\n'), lh=size*1.22, y0=y-(ls.length-1)*lh/2;
  return '<text x="'+num(x)+'" y="'+num(y0)+'" text-anchor="'+(anchor||'middle')+'" dominant-baseline="central" font-size="'+num(size)+'"'+(extra||'')+'>'
    + ls.map(function(l,i){ return '<tspan x="'+num(x)+'"'+(i?' dy="'+num(lh)+'"':'')+'>'+esc(l)+'</tspan>'; }).join('')+'</text>';
}
function size(it,def){ return Math.max(MIN_TEXT, it.s||def||18); }

var R={
  box:function(it){
    var s=size(it), t=tn(it.tone);
    return '<g class="'+cls('a',it)+'"'+dly(it.d)+'><rect class="bx f-'+t+' s-'+t+'" x="'+num(it.x)+'" y="'+num(it.y)+'" width="'+num(it.w)+'" height="'+num(it.h)+'" rx="10"/>'
      +(it.text?lines(it.text,it.x+it.w/2,it.y+it.h/2,s,'middle',' class="ink'+(it.bold?' b':'')+'"'):'')+'</g>';
  },
  text:function(it){
    var s=size(it), t=tn(it.tone);
    return '<g class="'+cls('a',it)+'"'+dly(it.d)+'>'+lines(it.text||'',it.x,it.y,s,it.anchor||'middle',' class="tx-'+t+(it.bold?' b':'')+'"')+'</g>';
  },
  icon:function(it){
    var s=it.s||36, t=tn(it.tone), p=ICONS[it.k]||ICONS.doc;
    return '<g class="'+cls('a',it)+'"'+dly(it.d)+'><g transform="translate('+num(it.x)+' '+num(it.y)+') scale('+num(s/24)+')">'
      +'<path d="'+p+'" class="ic s-'+t+'" fill="none" stroke-width="'+num(1.8)+'" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g></g>';
  },
  arrow:function(it){ return poly(it,true); },
  line:function(it){ return poly(it,false); },
  token:function(it){
    var t=tn(it.tone), to=it.to||[it.x,it.y], dx=to[0]-it.x, dy=to[1]-it.y, s=size(it,18);
    return '<g class="a move" style="--d:'+num(it.d||0)+'s;--t:'+num(it.dur||1.4)+'s;--dx:'+num(dx)+'px;--dy:'+num(dy)+'px">'
      +'<circle class="f-'+t+' s-'+t+'" cx="'+num(it.x)+'" cy="'+num(it.y)+'" r="'+num(it.r||17)+'" stroke-width="2"/>'
      +(it.text?lines(it.text,it.x,it.y,s,'middle',' class="ink b"'):'')+'</g>';
  },
  meter:function(it){
    var t=tn(it.tone), v=Math.max(0,Math.min(1,it.v==null?1:it.v));
    return '<g'+dly(it.d)+'><rect class="trk" x="'+num(it.x)+'" y="'+num(it.y)+'" width="'+num(it.w)+'" height="'+num(it.h)+'" rx="'+num(it.h/2)+'"/>'
      +'<rect class="a grow mf-'+t+'" x="'+num(it.x)+'" y="'+num(it.y)+'" width="'+num(it.w*v)+'" height="'+num(it.h)+'" rx="'+num(it.h/2)+'"'+dly(it.d)+'/></g>';
  },
  stamp:function(it){
    var t=tn(it.tone), s=size(it,19), ls=String(it.text).split('\n'), mx=Math.max.apply(null,ls.map(function(l){return l.length;})), w=(mx*s*0.62)+24, h=s*1.25*ls.length+10;
    return '<g class="a stamp"'+dly(it.d)+'><g transform="translate('+num(it.x)+' '+num(it.y)+') rotate('+num(it.rot==null?-8:it.rot)+')">'
      +'<rect class="f-none s-'+t+'" x="'+num(-w/2)+'" y="'+num(-h/2)+'" width="'+num(w)+'" height="'+num(h)+'" rx="6" stroke-width="3" fill="none"/>'
      +lines(it.text||'',0,0,s,'middle',' class="tx-'+t+' b"')+'</g></g>';
  },
  ring:function(it){
    var t=tn(it.tone);
    return '<circle class="'+cls('a',it)+' s-'+t+'" cx="'+num(it.x)+'" cy="'+num(it.y)+'" r="'+num(it.r||20)+'" fill="none" stroke-width="3"'+dly(it.d)+'/>';
  }
};

function poly(it,head){
  var p=it.pts||[0,0,0,0], t=tn(it.tone), d='M'+num(p[0])+' '+num(p[1]), i;
  for(i=2;i<p.length;i+=2) d+=' L'+num(p[i])+' '+num(p[i+1]);
  var out='<path class="a '+(it.dash?'dashed':'draw')+' s-'+t+'" d="'+d+'"'+(it.dash?'':' pathLength="1"')+' fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'
    +' style="--d:'+num(it.d||0)+'s;--t:'+num(it.dur||0.7)+'s"/>';
  if(head && p.length>=4){
    var n=p.length, x2=p[n-2], y2=p[n-1], x1=p[n-4], y1=p[n-3], a=Math.atan2(y2-y1,x2-x1), L=11, sp=0.5;
    var ax=x2-L*Math.cos(a-sp), ay=y2-L*Math.sin(a-sp), bx=x2-L*Math.cos(a+sp), by=y2-L*Math.sin(a+sp);
    out+='<path class="a f-'+t+' s-'+t+'" d="M'+num(x2)+' '+num(y2)+' L'+num(ax)+' '+num(ay)+' L'+num(bx)+' '+num(by)+'z" stroke-width="1.5" stroke-linejoin="round"'
      +dly((it.d||0)+(it.dur||0.7)*0.85)+'/>';
  }
  return out;
}

function sceneSVG(scene){
  var items=(scene.items||[]).map(function(it){ var f=R[it.t]; return f? f(it) : ''; }).join('');
  return '<svg class="rrx-svg" viewBox="0 0 '+W+' '+H+'" aria-hidden="true" focusable="false" xmlns="'+NS+'">'+items+'</svg>';
}

/* Scene length in seconds: long enough for the last animation and for
   the caption to be read at a comfortable ~3 words per second. */
function sceneDur(scene){
  if(scene.dur) return scene.dur;
  var last=0;
  (scene.items||[]).forEach(function(it){ last=Math.max(last,(it.d||0)+(it.dur||(it.t==='token'?1.4:it.t==='arrow'||it.t==='line'?0.7:0.5))); });
  var words=String(scene.caption||'').split(/\s+/).length;
  return Math.max(6, Math.ceil(Math.max(last+1.4, words/3.3)));
}
function totalDur(spec){ return spec.scenes.reduce(function(s,sc){ return s+sceneDur(sc); },0); }

/* ── styles, injected once ───────────────────────────────────────── */
var CSS=[
'.rrx{--rx-bg:#F4F6F9;--rx-card:#FFFFFF;--rx-ink:#1A1F27;--rx-ink2:#465060;--rx-line:#C3C9D1;--rx-edge:#DDE1E6;',
' --rx-brand:#1A5583;--rx-brand-bg:#E3EDF6;--rx-ok:#1B6B42;--rx-ok-bg:#E3F3EA;--rx-warn:#7A5200;--rx-warn-bg:#FBF0DA;',
' --rx-crit:#A8322A;--rx-crit-bg:#FBE9E6;--rx-violet:#6A3AB5;--rx-violet-bg:#EFE8FA;--rx-mute:#4F5968;--rx-mute-bg:#E9ECF1;',
' --rx-btn:#1A5583;--rx-btn-ink:#FFFFFF;--ease:cubic-bezier(.2,.7,.3,1);',
' margin:0;border:1px solid var(--rx-edge);border-radius:12px;background:var(--rx-card);color:var(--rx-ink);overflow:hidden;',
' font-family:"Helvetica Neue",Helvetica,Arial,"Liberation Sans",system-ui,sans-serif;font-size:15px;line-height:1.5}',
'@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .rrx{',
' --rx-bg:#151A21;--rx-card:#10151B;--rx-ink:#E6EDF3;--rx-ink2:#B4BDCB;--rx-line:#3A4452;--rx-edge:#2A3340;',
' --rx-brand:#7DB4E6;--rx-brand-bg:#16293B;--rx-ok:#4CC88C;--rx-ok-bg:#112A1D;--rx-warn:#E8B04A;--rx-warn-bg:#2C2209;',
' --rx-crit:#F58089;--rx-crit-bg:#331A1D;--rx-violet:#BD9CF5;--rx-violet-bg:#271C3D;--rx-mute:#A9B3C1;--rx-mute-bg:#222A35;',
' --rx-btn:#7DB4E6;--rx-btn-ink:#08121C}}',
':root[data-theme="dark"] .rrx{',
' --rx-bg:#151A21;--rx-card:#10151B;--rx-ink:#E6EDF3;--rx-ink2:#B4BDCB;--rx-line:#3A4452;--rx-edge:#2A3340;',
' --rx-brand:#7DB4E6;--rx-brand-bg:#16293B;--rx-ok:#4CC88C;--rx-ok-bg:#112A1D;--rx-warn:#E8B04A;--rx-warn-bg:#2C2209;',
' --rx-crit:#F58089;--rx-crit-bg:#331A1D;--rx-violet:#BD9CF5;--rx-violet-bg:#271C3D;--rx-mute:#A9B3C1;--rx-mute-bg:#222A35;',
' --rx-btn:#7DB4E6;--rx-btn-ink:#08121C}',
'.rrx *{box-sizing:border-box}',
'.rrx-stage{position:relative;background:var(--rx-bg);border-bottom:1px solid var(--rx-edge)}',
'.rrx-svg{display:block;width:100%;max-width:640px;margin:0 auto;height:auto}',
/* svg paint */
'.rrx-svg .bx{stroke-width:2}',
'.rrx-svg .f-brand{fill:var(--rx-brand-bg)}.rrx-svg .f-ok{fill:var(--rx-ok-bg)}.rrx-svg .f-warn{fill:var(--rx-warn-bg)}',
'.rrx-svg .f-crit{fill:var(--rx-crit-bg)}.rrx-svg .f-violet{fill:var(--rx-violet-bg)}.rrx-svg .f-mute{fill:var(--rx-mute-bg)}.rrx-svg .f-none{fill:none}',
'.rrx-svg .s-brand{stroke:var(--rx-brand)}.rrx-svg .s-ok{stroke:var(--rx-ok)}.rrx-svg .s-warn{stroke:var(--rx-warn)}',
'.rrx-svg .s-crit{stroke:var(--rx-crit)}.rrx-svg .s-violet{stroke:var(--rx-violet)}.rrx-svg .s-mute{stroke:var(--rx-mute)}',
'.rrx-svg path.f-brand,.rrx-svg path.f-ok,.rrx-svg path.f-warn,.rrx-svg path.f-crit,.rrx-svg path.f-violet,.rrx-svg path.f-mute{fill:currentColor}',
'.rrx-svg path.f-brand{fill:var(--rx-brand)}.rrx-svg path.f-ok{fill:var(--rx-ok)}.rrx-svg path.f-warn{fill:var(--rx-warn)}',
'.rrx-svg path.f-crit{fill:var(--rx-crit)}.rrx-svg path.f-violet{fill:var(--rx-violet)}.rrx-svg path.f-mute{fill:var(--rx-mute)}',
'.rrx-svg .ink{fill:var(--rx-ink);font-family:inherit}.rrx-svg .b{font-weight:700}',
'.rrx-svg .tx-brand{fill:var(--rx-brand)}.rrx-svg .tx-ok{fill:var(--rx-ok)}.rrx-svg .tx-warn{fill:var(--rx-warn)}',
'.rrx-svg .tx-crit{fill:var(--rx-crit)}.rrx-svg .tx-violet{fill:var(--rx-violet)}.rrx-svg .tx-mute{fill:var(--rx-ink2)}',
'.rrx-svg text{font-family:"Helvetica Neue",Helvetica,Arial,"Liberation Sans",system-ui,sans-serif}',
'.rrx-svg .trk{fill:var(--rx-mute-bg);stroke:var(--rx-line);stroke-width:1}',
'.rrx-svg .mf-brand{fill:var(--rx-brand)}.rrx-svg .mf-ok{fill:var(--rx-ok)}.rrx-svg .mf-warn{fill:var(--rx-warn)}',
'.rrx-svg .mf-crit{fill:var(--rx-crit)}.rrx-svg .mf-violet{fill:var(--rx-violet)}.rrx-svg .mf-mute{fill:var(--rx-mute)}',
'.rrx-svg .dashed{stroke-dasharray:6 6}',
/* motion */
'.rrx-svg .a{animation:rx-in .5s var(--ease) both;animation-delay:var(--d,0s)}',
'.rrx-svg .a.pop{animation-name:rx-pop;transform-box:fill-box;transform-origin:center}',
'.rrx-svg .a.still{animation:none}',
'.rrx-svg .a.draw{stroke-dasharray:1;animation:rx-draw var(--t,.7s) ease-out both;animation-delay:var(--d,0s)}',
'.rrx-svg .a.move{animation:rx-move var(--t,1.4s) cubic-bezier(.45,.05,.3,1) both;animation-delay:var(--d,0s)}',
'.rrx-svg .a.grow{transform-box:fill-box;transform-origin:left center;animation:rx-grow 1s var(--ease) both;animation-delay:var(--d,0s)}',
'.rrx-svg .a.stamp{transform-box:fill-box;transform-origin:center;animation:rx-stamp .45s var(--ease) both;animation-delay:var(--d,0s)}',
'@keyframes rx-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
'@keyframes rx-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}',
'@keyframes rx-draw{from{stroke-dashoffset:1;opacity:1}to{stroke-dashoffset:0;opacity:1}}',
'@keyframes rx-move{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}',
'@keyframes rx-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
'@keyframes rx-stamp{from{opacity:0;transform:scale(1.7)}to{opacity:1;transform:none}}',
'.rrx.is-paused .rrx-svg .a{animation-play-state:paused}',
/* static frames: idle, reduced motion, or animation switched off */
'.rrx.is-static .rrx-svg .a{animation:none!important;opacity:1;transform:none}',
'.rrx.is-static .rrx-svg .a.draw{stroke-dashoffset:0}',
'.rrx.is-static .rrx-svg .a.move{transform:translate(var(--dx),var(--dy))}',
'@media (prefers-reduced-motion:reduce){.rrx .rrx-svg .a{animation:none!important;opacity:1;transform:none}',
' .rrx .rrx-svg .a.draw{stroke-dashoffset:0}.rrx .rrx-svg .a.move{transform:translate(var(--dx),var(--dy))}}',
/* overlay play button */
'.rrx-start{position:absolute;right:12px;bottom:12px;display:flex}',
'.rrx-start button{display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 22px;border:0;border-radius:28px;background:var(--rx-btn);color:var(--rx-btn-ink);',
' font:700 15px/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28)}',
'.rrx-start button:hover{filter:brightness(1.08)}',
/* caption */
'.rrx-cap{padding:16px 18px 8px}',
'.rrx-step{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--rx-brand)}',
'.rrx-title{font-size:17px;font-weight:700;letter-spacing:-.01em;margin-top:4px}',
'.rrx-text{color:var(--rx-ink2);font-size:15px;line-height:1.6;margin-top:6px;max-width:66ch}',
/* controls */
'.rrx-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 14px 12px}',
'.rrx-bar button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;min-width:40px;padding:0 14px;border:1px solid var(--rx-line);',
' border-radius:8px;background:var(--rx-card);color:var(--rx-ink);font:600 14px/1 inherit;font-family:inherit;cursor:pointer}',
'.rrx-bar button:hover:not(:disabled){border-color:var(--rx-brand);color:var(--rx-brand)}',
'.rrx-bar button:disabled{opacity:.55;cursor:not-allowed}',
'.rrx-bar .pri{background:var(--rx-btn);border-color:var(--rx-btn);color:var(--rx-btn-ink)}',
'.rrx-bar .pri:hover:not(:disabled){filter:brightness(1.08);color:var(--rx-btn-ink)}',
'.rrx-dots{display:flex;gap:2px;margin-left:auto;align-items:center}',
'.rrx-dots button{min-width:28px;min-height:36px;padding:0;border:0;background:none;position:relative}',
'.rrx-dots button::before{content:"";position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid var(--rx-line);background:var(--rx-card)}',
'.rrx-dots button.on::before{background:var(--rx-brand);border-color:var(--rx-brand)}',
'.rrx-dots button.seen::before{border-color:var(--rx-brand)}',
'.rrx-prog{height:4px;background:var(--rx-mute-bg);position:relative;overflow:hidden}',
'.rrx-prog i{position:absolute;inset:0;background:var(--rx-brand);transform-origin:left center;transform:scaleX(var(--p,0));transition:transform .25s linear;display:block}',
'.rrx-tx{border-top:1px solid var(--rx-edge);padding:0 18px}',
'.rrx-tx summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:14px;font-weight:600;color:var(--rx-ink2)}',
'.rrx-tx ol{padding:0 0 12px 20px;color:var(--rx-ink2);font-size:14px;line-height:1.6}',
'.rrx-tx li{margin-top:6px}.rrx-tx li b{color:var(--rx-ink)}',
'.rrx button:focus-visible,.rrx summary:focus-visible{outline:3px solid var(--rx-brand);outline-offset:2px}',
'@media (max-width:480px){.rrx-bar .lbl{display:none}.rrx-bar button{padding:0 12px}}',
'@media (prefers-reduced-motion:reduce){.rrx-prog i{transition:none}}'
].join('\n');

function injectCSS(){
  if(document.getElementById('rrx-css')) return;
  var st=document.createElement('style'); st.id='rrx-css'; st.textContent=CSS; document.head.appendChild(st);
}

/* ── the player ──────────────────────────────────────────────────── */
function reducedMotion(){ try{ return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }

function mount(host, spec, opts){
  injectCSS();
  opts=opts||{};
  var id='rrx'+(++uid), scenes=spec.scenes||[], n=scenes.length;
  var reduced=reducedMotion();
  var motionOff=reduced;                    /* "static frames" mode */
  try{ if(!reduced && localStorage.getItem('regradar-ex-static')==='1') motionOff=true; }catch(e){}
  var idx=0, elapsed=0, playing=false, started=false, finished=false, completedOnce=false, timer=null, seen={0:true};
  var total=totalDur(spec);

  host.innerHTML='';
  var fig=document.createElement('figure');
  fig.className='rrx is-static'; fig.setAttribute('role','group');
  fig.setAttribute('aria-label','Explainer: '+(spec.title||''));
  fig.innerHTML=
    '<div class="rrx-stage" id="'+id+'-stage"></div>'
   +'<div class="rrx-prog" aria-hidden="true"><i id="'+id+'-p"></i></div>'
   +'<figcaption class="rrx-cap" id="'+id+'-cap" aria-live="off"></figcaption>'
   +'<div class="rrx-bar" role="group" aria-label="Explainer controls">'
   +  '<button type="button" id="'+id+'-prev" aria-label="Previous step"><span aria-hidden="true">&#9664;</span><span class="lbl">Back</span></button>'
   +  '<button type="button" id="'+id+'-play" class="pri"></button>'
   +  '<button type="button" id="'+id+'-next" aria-label="Next step"><span class="lbl">Next</span><span aria-hidden="true">&#9654;</span></button>'
   +  '<button type="button" id="'+id+'-replay" aria-label="Replay from the start"><span aria-hidden="true">&#8634;</span><span class="lbl">Replay</span></button>'
   +  (reduced?'':'<button type="button" id="'+id+'-mo" aria-pressed="false"><span class="lbl">Static frames</span><span class="lbl-s" aria-hidden="true" style="display:none">Aa</span></button>')
   +  '<div class="rrx-dots" id="'+id+'-dots" role="group" aria-label="Go to step"></div>'
   +'</div>'
   +'<details class="rrx-tx"><summary>Read this as text</summary><ol id="'+id+'-tx"></ol></details>';
  host.appendChild(fig);

  var $=function(s){ return document.getElementById(id+'-'+s); };
  var stage=$('stage'), cap=$('cap'), bPlay=$('play'), bPrev=$('prev'), bNext=$('next'), bRe=$('replay'), bMo=$('mo'), dots=$('dots');

  $('tx').innerHTML=scenes.map(function(s){ return '<li><b>'+esc(s.title)+'.</b> '+esc(s.caption)+'</li>'; }).join('');
  dots.innerHTML=scenes.map(function(s,i){ return '<button type="button" data-i="'+i+'" aria-label="Step '+(i+1)+': '+esc(s.title)+'"></button>'; }).join('');

  function isStatic(){ return motionOff || !started; }
  function syncMode(){
    fig.classList.toggle('is-static', isStatic());
    fig.classList.toggle('is-paused', started && !playing && !finished);
    if(bMo){
      bMo.setAttribute('aria-pressed', motionOff?'true':'false');
      bMo.querySelector('.lbl').textContent=motionOff?'Animate':'Static frames';
    }
  }
  function label(){
    var secs=Math.round(total);
    if(motionOff){ bPlay.style.display='none'; return; }
    bPlay.style.display='';
    if(playing) bPlay.innerHTML='<span aria-hidden="true">&#10074;&#10074;</span><span class="lbl">Pause</span>';
    else if(finished) bPlay.innerHTML='<span aria-hidden="true">&#8634;</span><span class="lbl">Watch again</span>';
    else if(started) bPlay.innerHTML='<span aria-hidden="true">&#9654;</span><span class="lbl">Resume</span>';
    else bPlay.innerHTML='<span aria-hidden="true">&#9654;</span><span class="lbl">Play ('+secs+' s)</span>';
    bPlay.setAttribute('aria-label', playing?'Pause':finished?'Watch again from the start':started?'Resume':'Play the explainer, about '+secs+' seconds');
  }
  function paintStage(){
    stage.innerHTML=sceneSVG(scenes[idx])
      +((!started && !motionOff)?'<div class="rrx-start"><button type="button" id="'+id+'-big" aria-label="Play the explainer, about '+Math.round(total)+' seconds"><span aria-hidden="true">&#9654;</span> Play, '+Math.round(total)+' s</button></div>':'');
    var big=document.getElementById(id+'-big'); if(big) big.addEventListener('click',function(){ start(); });
  }
  function paintCap(){
    var s=scenes[idx];
    cap.innerHTML='<div class="rrx-step">Step '+(idx+1)+' of '+n+'</div><div class="rrx-title">'+esc(s.title)+'</div><p class="rrx-text">'+esc(s.caption)+'</p>';
    Array.prototype.forEach.call(dots.children,function(b,i){ b.classList.toggle('on',i===idx); b.classList.toggle('seen',!!seen[i]&&i!==idx); if(i===idx) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current'); });
    bPrev.disabled=idx===0; bNext.disabled=idx===n-1;
  }
  function paintProg(){
    var done=0, i; for(i=0;i<idx;i++) done+=sceneDur(scenes[i]);
    var p=(!started||motionOff)? (idx+1)/n : Math.min(1,(done+elapsed/1000)/total);
    $('p').parentNode.style.setProperty('--p',p); $('p').style.setProperty('--p',p);
  }
  function render(i){
    idx=Math.max(0,Math.min(n-1,i)); seen[idx]=true; elapsed=0;
    paintStage(); paintCap(); paintProg(); syncMode(); label();
    if(opts.onStep) try{ opts.onStep(idx,spec); }catch(e){}
  }
  function stop(){ clearInterval(timer); timer=null; }
  function runTimer(){
    stop();
    timer=setInterval(function(){
      if(!playing) return;
      elapsed+=100;
      if(elapsed>=sceneDur(scenes[idx])*1000){
        if(idx<n-1){ render(idx+1); }
        else{ finish(); }
      } else paintProg();
    },100);
  }
  function finish(){
    stop(); playing=false; finished=true; elapsed=sceneDur(scenes[idx])*1000;
    $('p').style.setProperty('--p',1); syncMode(); label();
    if(!completedOnce){ completedOnce=true; if(opts.onComplete) try{ opts.onComplete(spec); }catch(e){} }
  }
  function start(){
    if(motionOff){ return; }
    started=true; finished=false; playing=true; seen={0:true};
    render(0); runTimer(); syncMode(); label();
    if(opts.onPlay) try{ opts.onPlay(spec); }catch(e){}
  }
  function play(){
    if(motionOff) return;
    if(finished || !started){ start(); return; }
    playing=true; syncMode(); label(); runTimer();
  }
  function pause(){ playing=false; syncMode(); label(); }
  function goTo(i,manual){
    if(manual){ cap.setAttribute('aria-live','polite'); }
    var wasPlaying=manual? false : playing;   /* stepping by hand pauses the timer */
    if(!started && !motionOff){ started=true; }
    finished=false;
    render(i);
    playing=wasPlaying && !motionOff;
    if(playing) runTimer(); else stop();
    syncMode(); label();
    if(motionOff && i===n-1 && !completedOnce){ completedOnce=true; if(opts.onComplete) try{ opts.onComplete(spec); }catch(e){} }
    if(!motionOff && i===n-1 && !playing && started && !completedOnce){ /* manual stepping to the end counts as watched */
      completedOnce=true; if(opts.onComplete) try{ opts.onComplete(spec); }catch(e){} }
  }

  bPlay.addEventListener('click',function(){ if(playing) pause(); else play(); });
  bPrev.addEventListener('click',function(){ goTo(idx-1,true); });
  bNext.addEventListener('click',function(){ goTo(idx+1,true); });
  bRe.addEventListener('click',function(){
    cap.setAttribute('aria-live','off'); completedOnce=completedOnce;
    if(motionOff){ goTo(0,true); return; }
    started=false; finished=false; playing=false; stop(); start();
  });
  if(bMo) bMo.addEventListener('click',function(){
    motionOff=!motionOff; try{ localStorage.setItem('regradar-ex-static',motionOff?'1':'0'); }catch(e){}
    if(motionOff){ playing=false; stop(); }
    paintStage(); syncMode(); label(); paintProg();
  });
  dots.addEventListener('click',function(e){ var b=e.target.closest('button[data-i]'); if(b) goTo(+b.dataset.i,true); });
  document.addEventListener('visibilitychange',function(){ if(document.hidden && playing) pause(); });

  render(0);
  return {
    play:play, pause:pause, replay:function(){ bRe.click(); }, goTo:function(i){ goTo(i,true); },
    get index(){ return idx; }, get playing(){ return playing; }, get duration(){ return total; },
    destroy:function(){ stop(); host.innerHTML=''; }
  };
}

function frames(spec){ return (spec.scenes||[]).map(sceneSVG); }
function fetchSpecs(url){
  return fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
}

window.AcademyExplainer={mount:mount, frames:frames, duration:totalDur, sceneDuration:sceneDur, load:fetchSpecs, injectCSS:injectCSS, ICONS:ICONS, MIN_TEXT:MIN_TEXT};
})();
