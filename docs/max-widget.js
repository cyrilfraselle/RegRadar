/* ═══════════════════════════════════════════════════════════════
   Max: RegRadar's quiet assistant (the owner's parents' cat).

   First slice: the cat and the chat panel SHELL only. No AI, no
   network calls beyond this file's own stylesheet. The answer engine
   is plugged in later through ONE hook: window.RegMax.setAnswerer().

   Behaviour
   - First page view of a browser session (sessionStorage): about 2.5 s
     after load Max walks in from the right edge, sits down at the
     bottom right, and a bubble greets once, hiding itself after ~8 s.
   - Later pages: he is simply sitting there. No timed prompts, no
     auto-opening, no notifications.
   - Click (a real button) opens the panel; Esc closes and returns focus.
   - "Hide Max" hides him on this device (localStorage); the footer then
     shows "Bring Max back".
   - prefers-reduced-motion: no walk, he fades in already sitting, no idle loops.
   - ?maxdemo=1 cycles every state slowly so the owner can preview them.

   Loaded by one line at the end of site-nav.js (and by index.html).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MAX_ENABLED = true; // kill switch: false = Max never appears anywhere

  // Full-frame simulation pages: Max stays out of the way there.
  var EXCLUDE = ['workstation.html', 'desk.html', 'laundromat.html', 'ownership.html',
    'shift.html', 'triage.html', 'casefile.html', 'film-follow-the-money.html'];
  var page = location.pathname.split('/').pop() || 'index.html';
  if (!MAX_ENABLED || EXCLUDE.indexOf(page) !== -1 || window.__regMax) return;
  window.__regMax = true;

  var K_HIDDEN = 'regradar-max-hidden', K_GREETED = 'regradar-max-greeted';
  var params = new URLSearchParams(location.search);
  var DEMO = params.get('maxdemo') === '1';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lget(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function lset(s, k, v) { try { if (v == null) s.removeItem(k); else s.setItem(k, v); } catch (e) {} }

  /* ------------------------------------------------------------ the answer hook
     THE single place where an answer engine plugs in later. Until something
     calls RegMax.setAnswerer(fn), the input stays disabled and Max says chat
     is coming soon. Contract for fn(question, ctx) -> Promise:
       ctx.say(text)            add a message from Max (plain text)
       ctx.sayNode(node)        add a message from Max (DOM node)
       ctx.setState(name)       'sit' | 'think' | 'found' | 'unsure'
       ctx.page                 { file, open, celex, art } light page context
     Nothing in this file talks to a model or a network. */
  var ANSWER = null;

  /* ------------------------------------------------------------ the cat (original SVG) */
  var HEAD =
    '<g class="mx-head">' +
      '<path class="mx-fill mx-ear" d="M-8.6 -2.5 L-7.2 -14 L-1.4 -7.2 Z"/>' +
      '<path class="mx-fill mx-ear" d="M1.4 -7.2 L7.2 -14 L8.6 -2.5 Z"/>' +
      '<ellipse class="mx-fill" cx="0" cy="0" rx="10" ry="9"/>' +
      '<g class="mx-eyes"><ellipse cx="-4" cy="-0.6" rx="1.6" ry="2.1"/><ellipse cx="4" cy="-0.6" rx="1.6" ry="2.1"/></g>' +
      '<path class="mx-nose" d="M-1.3 3 L1.3 3 L0 4.5 Z"/>' +
      '<g class="mx-dots"><circle cx="9" cy="-19" r="1.6"/><circle cx="14" cy="-22" r="1.9"/><circle cx="20" cy="-24" r="2.2"/></g>' +
    '</g>';
  var CAT =
    '<svg viewBox="0 0 80 64" aria-hidden="true" focusable="false"><g class="mx-fig">' +
      // walking pose, facing left (he walks in from the right)
      '<g class="mx-walk">' +
        '<g class="mx-tail-w"><path class="mx-tail-h" d="M58 36 C66 34 70 26 68 18"/><path class="mx-tail-i" d="M58 36 C66 34 70 26 68 18"/></g>' +
        '<rect class="mx-fill mx-leg mx-lb" x="28" y="40" width="5" height="20" rx="2.5"/>' +
        '<rect class="mx-fill mx-leg mx-la" x="53" y="40" width="5" height="20" rx="2.5"/>' +
        '<rect class="mx-fill" x="20" y="28" width="40" height="17" rx="8.5"/>' +
        '<rect class="mx-fill mx-leg mx-la" x="23" y="40" width="5" height="20" rx="2.5"/>' +
        '<rect class="mx-fill mx-leg mx-lb" x="48" y="40" width="5" height="20" rx="2.5"/>' +
      '</g>' +
      // sitting pose
      '<g class="mx-sit">' +
        '<g class="mx-tail-s"><path class="mx-tail-h" d="M50 60 C60 61 68 58 68 50 C68 46 65 44 63 46"/><path class="mx-tail-i" d="M50 60 C60 61 68 58 68 50 C68 46 65 44 63 46"/></g>' +
        '<g class="mx-sit-body">' +
          '<path class="mx-fill" d="M24 61 C22 50 24 38 32 32 C40 28 50 34 52 46 C54 54 53 60 50 61 Z"/>' +
          '<ellipse class="mx-fill" cx="45" cy="52" rx="9" ry="9"/>' +
          '<rect class="mx-fill" x="26" y="44" width="5.5" height="17" rx="2.75"/>' +
          '<rect class="mx-fill" x="32" y="44" width="5.5" height="17" rx="2.75"/>' +
        '</g>' +
      '</g>' +
      HEAD +
    '</g></svg>';
  var AVATAR = '<svg viewBox="-13 -16 26 27" aria-hidden="true" focusable="false">' + HEAD.replace('class="mx-head"', '') + '</svg>';

  /* ------------------------------------------------------------ helpers */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, label) {
    var b = el('button', 'mx-b ' + (cls || ''), text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }

  // Light page context, ready for the answer hook (obligation, article or tool).
  function pageContext() {
    return { file: page, open: params.get('open') || '', celex: page === 'law.html' ? (params.get('celex') || '') : '',
      art: page === 'law.html' ? (params.get('art') || '') : '' };
  }

  /* ------------------------------------------------------------ theme
     Pages with a light/dark switch set html[data-theme]; others (landing,
     glossary) are read from the body background. */
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(document.body).backgroundColor || '');
    if (!m || m[4] === '0') return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.45;
  }

  /* ------------------------------------------------------------ build */
  var root, btn, bubble, panel, log, input, send, live, demoTag, closeB;
  var state = 'sit', greetTimer = null, revertTimer = null;

  function setState(s) {
    state = s;
    if (!btn) return;
    var c = btn.classList;
    c.remove('mx-walking', 'mx-seated', 'mx-thinking', 'mx-found', 'mx-unsure');
    if (s === 'walk') { c.add('mx-walking'); return; }
    c.add('mx-seated');
    if (s === 'think') c.add('mx-thinking');
    if (s === 'found') c.add('mx-found');
    if (s === 'unsure') c.add('mx-unsure');
    clearTimeout(revertTimer);
    if ((s === 'found' || s === 'unsure') && !DEMO) revertTimer = setTimeout(function () { setState('sit'); }, 3000);
  }

  function build() {
    root = el('div');
    root.id = 'max-root';
    root.setAttribute('data-no-glossary', '');
    root.classList.toggle('mx-dark', isDark());
    live = el('div', 'mx-vh');
    live.setAttribute('role', 'status');
    root.appendChild(live);

    btn = el('button', 'mx-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Max, ask about the law');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'max-panel');
    btn.innerHTML = CAT;
    btn.addEventListener('click', function () { if (panel && !panel.hidden) closePanel(); else openPanel(); });
    root.appendChild(btn);
    document.body.appendChild(root);

    // Follow theme switches made after load.
    new MutationObserver(function () { root.classList.toggle('mx-dark', isDark()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    watchObstacles();
  }

  /* ------------------------------------------------------------ appear */
  function appear() {
    build();
    var greet = !lget(sessionStorage, K_GREETED) && !DEMO;
    if (!greet || reduced) {
      setState('sit');
      requestAnimationFrame(function () { btn.classList.add('mx-on'); });
      if (greet) { lset(sessionStorage, K_GREETED, '1'); setTimeout(showBubble, 700); }
      if (DEMO) startDemo();
      return;
    }
    setTimeout(function () {
      lset(sessionStorage, K_GREETED, '1');
      setState('walk');
      btn.classList.add('mx-entering', 'mx-on');
      var landed = false;
      function done(e) {
        if (landed || (e && e.target !== btn)) return;
        landed = true;
        btn.removeEventListener('animationend', done);
        btn.classList.remove('mx-entering');
        setState('sit');
        setTimeout(showBubble, 600);
      }
      btn.addEventListener('animationend', done);
      setTimeout(done, 3400); // safety: if animations never run, he still sits down

    }, 2500);
  }

  function showBubble() {
    if (panel && !panel.hidden) return;
    bubble = el('div', 'mx-bubble');
    bubble.appendChild(el('p', '', 'Hi, I am Max. Ask me about the law.'));
    var open = button('mx-pri', 'Ask Max');
    open.addEventListener('click', function () { hideBubble(); openPanel(); });
    var x = button('mx-ghost mx-x', '×', 'Dismiss greeting');
    x.addEventListener('click', function () { hideBubble(); btn.focus(); });
    bubble.appendChild(open); bubble.appendChild(x);
    root.insertBefore(bubble, btn);
    // Hides by itself after ~8 s, but never while the visitor is pointing at or focused on it.
    var hold = false;
    bubble.addEventListener('mouseenter', function () { hold = true; });
    bubble.addEventListener('mouseleave', function () { hold = false; armHide(); });
    bubble.addEventListener('focusin', function () { hold = true; });
    bubble.addEventListener('focusout', function () { hold = false; armHide(); });
    function armHide() { clearTimeout(greetTimer); greetTimer = setTimeout(function () { if (!hold) hideBubble(); }, 8000); }
    armHide();
  }
  function hideBubble() {
    clearTimeout(greetTimer);
    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
    bubble = null;
  }

  /* ------------------------------------------------------------ panel */
  function buildPanel() {
    panel = el('div', 'mxp');
    panel.id = 'max-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'mxp-title');

    var h = el('div', 'mxp-h');
    var av = el('div', 'mxp-av'); av.innerHTML = AVATAR; h.appendChild(av);
    var t = el('div', 'mxp-t');
    var h2 = el('h2', '', 'Max'); h2.id = 'mxp-title'; t.appendChild(h2);
    t.appendChild(el('p', '', 'Guide to the legal texts'));
    h.appendChild(t);
    var hideB = button('mx-ghost', 'Hide Max', 'Hide Max on this device');
    hideB.addEventListener('click', hideMax);
    closeB = button('mx-ghost mx-x', '×', 'Close chat');
    closeB.addEventListener('click', closePanel);
    h.appendChild(hideB); h.appendChild(closeB);
    panel.appendChild(h);

    log = el('div', 'mxp-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', 'Conversation with Max');
    panel.appendChild(log);

    var f = el('form', 'mxp-f');
    f.setAttribute('autocomplete', 'off');
    var row = el('div', 'mxp-in');
    var lab = el('label', 'mx-vh', 'Your question for Max'); lab.htmlFor = 'mxp-q';
    input = el('textarea'); input.id = 'mxp-q'; input.rows = 1;
    send = el('button', 'mx-b mx-pri', 'Send'); send.type = 'submit';
    row.appendChild(lab); row.appendChild(input); row.appendChild(send);
    f.appendChild(row);
    var legal = el('div', 'mxp-legal');
    legal.appendChild(el('span', '', 'Prototype. Not legal advice.'));
    var a = el('a', '', 'Search the law now'); a.href = 'ask.html';
    legal.appendChild(a);
    f.appendChild(legal);
    f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    panel.appendChild(f);

    panel.addEventListener('keydown', trapKeys);
    root.appendChild(panel);
    say('Max is still learning to talk. Chat is coming soon.');
    say('Meanwhile, “Search the law now” below finds the relevant articles in the legal texts for you.');
    syncInput();
  }

  function syncInput() {
    var on = typeof ANSWER === 'function';
    input.disabled = !on; send.disabled = !on;
    input.placeholder = on ? 'Ask about the law' : 'Chat is coming soon';
  }

  function say(text) { var m = el('div', 'mxp-m mxp-max'); m.appendChild(el('p', '', text)); return addMsg(m); }
  function sayNode(node) { var m = el('div', 'mxp-m mxp-max'); m.appendChild(node); return addMsg(m); }
  function addMsg(m) { log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

  function submit() {
    var q = input.value.trim();
    if (!q || typeof ANSWER !== 'function') return;
    addMsg(el('div', 'mxp-m mxp-you', q));
    input.value = '';
    setState('think');
    Promise.resolve().then(function () {
      return ANSWER(q, { say: say, sayNode: sayNode, setState: setState, page: pageContext() });
    }).catch(function () {
      say('Something went wrong on my side. Please try again.'); setState('unsure');
    }).then(function () { if (state === 'think') setState('sit'); });
  }

  function focusables() {
    return [].slice.call(panel.querySelectorAll('button,a[href],textarea,input,[tabindex]:not([tabindex="-1"])'))
      .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
  }
  function trapKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function onDocFocus(e) { if (panel && !panel.hidden && !panel.contains(e.target)) { var f = focusables(); if (f.length) f[0].focus(); } }

  function openPanel() {
    hideBubble();
    if (!panel) buildPanel();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('focusin', onDocFocus);
    (input.disabled ? closeB : input).focus();
  }
  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('focusin', onDocFocus);
    btn.focus();
  }

  /* ------------------------------------------------------------ hide / bring back */
  function hideMax() {
    lset(localStorage, K_HIDDEN, '1');
    document.removeEventListener('focusin', onDocFocus);
    stopDemo();
    var msg = 'Max is hidden on this device. Use “Bring Max back” in the page footer to see him again.';
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = btn = panel = bubble = null;
    var back = footerLink();
    var note = el('div', 'mx-vh'); note.setAttribute('role', 'status'); document.body.appendChild(note);
    setTimeout(function () { note.textContent = msg; }, 60);
    setTimeout(function () { if (note.parentNode) note.parentNode.removeChild(note); }, 6000);
    if (back) { back.setAttribute('tabindex', '-1'); back.focus({ preventScroll: true }); back.removeAttribute('tabindex'); }
  }

  function footerLink() {
    var foot = document.querySelector('footer.rrf p') || document.querySelector('body > footer p') || document.querySelector('body > footer');
    if (!foot) { foot = el('p', 'rrf'); foot.style.textAlign = 'center'; document.body.appendChild(foot); }
    if (document.getElementById('mx-back')) return document.getElementById('mx-back');
    var wrap = el('span'); wrap.id = 'mx-back-wrap';
    wrap.appendChild(document.createTextNode(' '));
    var b = el('button', 'mx-back', 'Bring Max back'); b.type = 'button'; b.id = 'mx-back';
    b.addEventListener('click', function () {
      lset(localStorage, K_HIDDEN, null);
      wrap.parentNode.removeChild(wrap);
      lset(sessionStorage, K_GREETED, '1'); // back means sitting, no walk-in or greeting
      appear();
      btn.focus();
    });
    wrap.appendChild(b);
    foot.appendChild(wrap);
    return b;
  }

  /* ------------------------------------------------------------ keep out of the way
     Lift Max above anything fixed or sticky at the bottom that he would
     cover: the landing page's floating CTA, sticky action bars, or anything
     marked data-max-avoid. Modal dialogs and drawers sit above him (z-index 90). */
  var AVOID = '#cta.show,.minibar,[data-max-avoid]';
  var lifting = false;
  function updateLift() {
    lifting = false;
    if (!root) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = vw <= 560 ? 64 : 72, right = vw <= 560 ? 8 : 14, base = 10;
    var left = vw - right - w, top = vh - base - 58 - 8, lift = 0;
    [].forEach.call(document.querySelectorAll(AVOID), function (n) {
      if (root.contains(n)) return;
      var r = n.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= top || r.top >= vh || r.right <= left || r.left >= vw - right) return;
      lift = Math.max(lift, vh - r.top + 6 - base);
    });
    root.style.setProperty('--mx-lift', Math.round(lift) + 'px');
  }
  function queueLift() { if (!lifting) { lifting = true; requestAnimationFrame(updateLift); } }
  function watchObstacles() {
    window.addEventListener('scroll', queueLift, { passive: true });
    window.addEventListener('resize', queueLift);
    var cta = document.getElementById('cta');
    if (cta) new MutationObserver(function () { queueLift(); setTimeout(queueLift, 650); })
      .observe(cta, { attributes: true, attributeFilter: ['class'] });
    updateLift();
  }

  /* ------------------------------------------------------------ demo (?maxdemo=1 only) */
  var demoTimer = null;
  function startDemo() {
    var steps = [['walk', 'Walking'], ['sit', 'Sitting (breathing, blink, tail flick)'], ['think', 'Thinking'],
      ['found', 'Found a source (ears perk)'], ['unsure', 'Not sure (head tilt)']], i = 0;
    demoTag = el('div', 'mxp-demo'); demoTag.setAttribute('role', 'status');
    root.insertBefore(demoTag, btn);
    function next() {
      if (!root) return;
      setState(steps[i][0]); demoTag.textContent = 'Max demo: ' + steps[i][1];
      i = (i + 1) % steps.length;
      demoTimer = setTimeout(next, 4000);
    }
    next();
  }
  function stopDemo() { clearTimeout(demoTimer); }

  /* ------------------------------------------------------------ public API (for the later engine) */
  window.RegMax = {
    setAnswerer: function (fn) { ANSWER = typeof fn === 'function' ? fn : null; if (panel) syncInput(); },
    setState: setState,
    open: function () { if (root) openPanel(); }
  };

  function start() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'max-widget.css?v=20261112m';
    link.onload = function () {
      if (lget(localStorage, K_HIDDEN) === '1' && !DEMO) footerLink();
      else appear();
    };
    document.head.appendChild(link);
  }
  // Run after the page (and site-nav's footer) is in place.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})();
