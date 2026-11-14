/* ═══════════════════════════════════════════════════════════════
   RegRadar — site navigation and footer (single source of truth)

   Usage — first thing inside <body>:
     <script src="site-nav.js"></script>
   The bar is inserted where the script tag sits (synchronously, so the
   page never jumps). It carries its own CSS, so it looks the same on
   pages that use rr-ui.css and on pages that do not (the Academy).
   It is always ink, like the landing page's bar: the frame of the site.

   Structure (STREAMS.md, "Target structure of the site"):
     Max ▾       Briefing, Work board, Register, Controls, Policies,
                 Risk (+ Customer risk), Cases, Issues and actions,
                 Change impact, Ask the law
     Academy ▾   AMLR path, Glossary, Evidence
     RegWatch · Country risk · Read the law          [Try Max]

   Pages deliberately left out of the menu (still load if visited):
   extractor (broken on GitHub Pages), ubo (on hold), the single
   Academy practice rooms (they are reached from the AMLR path).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var MENU = [
    { id: "max", label: "Max", items: [
      { href: "home.html",                  t: "Briefing",           d: "What is due, waiting, coming up" },
      { href: "board.html",                 t: "Work board",         d: "Tasks and findings, assigned and tracked" },
      { href: "workspace.html",             t: "Register",           d: "Obligations, the law, coverage" },
      { href: "workspace.html?view=controls", t: "Controls",         d: "Your controls and their tests" },
      { href: "policies.html",              t: "Policies",           d: "Versions, sign-off, attestations" },
      { href: "risk-assessment.html",       t: "Risk",               d: "Business-wide risk assessment" },
      { href: "customer-risk.html",         t: "Customer risk",      d: "Scoring and onboarding checks", sub: true },
      { href: "cases.html",                 t: "Cases",              d: "Alerts, case files, reports to the FIU" },
      { href: "actions.html",               t: "Issues and actions", d: "Findings, remediation, board report" },
      { href: "impact.html",                t: "Change impact",      d: "What a new rule touches in your firm" },
      { href: "ask.html",                   t: "Ask the law",        d: "Cited answers, checked against the text" }
    ]},
    { id: "academy", label: "Academy", items: [
      { href: "academy.html",          t: "AMLR path",  d: "Topic by topic: watch, answer, decide" },
      { href: "glossary.html",         t: "Glossary",   d: "AML and KYC terms, plainly" },
      { href: "academy-register.html", t: "Evidence",   d: "Certificates and the team register" }
    ]},
    { id: "regwatch", label: "RegWatch",     href: "regwatch.html" },
    { id: "country",  label: "Country risk", href: "country-risk.html" },
    { id: "law",      label: "Read the law", href: "law.html" }
  ];

  var GROUP_OF = {
    "home.html": "max", "board.html": "max", "workspace.html": "max", "obligations.html": "max",
    "controls.html": "max", "dashboard.html": "max", "policies.html": "max", "risk-assessment.html": "max",
    "customer-risk.html": "max", "cases.html": "max", "actions.html": "max", "impact.html": "max", "ask.html": "max",
    "regwatch.html": "regwatch", "country-risk.html": "country", "law.html": "law",
    "glossary.html": "academy", "academy.html": "academy", "academy-register.html": "academy",
    "academy-certificate.html": "academy", "film-follow-the-money.html": "academy", "workstation.html": "academy",
    "laundromat.html": "academy", "ownership.html": "academy", "desk.html": "academy", "shift.html": "academy",
    "triage.html": "academy", "casefile.html": "academy"
  };
  var page = location.pathname.split("/").pop() || "index.html";
  var query = location.search;
  var activeGroup = GROUP_OF[page] || "";
  var FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

  function isCurrent(href) {
    var parts = href.split("?");
    if (parts[0] !== page) return false;
    var wantControls = /view=controls/.test(parts[1] || "");
    if (page === "workspace.html") return wantControls === /view=controls|control=/.test(query);
    return true;
  }

  var CSS =
    ".rrn{--n-ink:#05070C;--n-panel:#121827;--n-line:rgba(255,255,255,.09);--n-tx:#F5F7FB;--n-tx2:#AAB4C6;--n-blue:#9DBAFF;" +
    "--n-ease:cubic-bezier(.16,1,.3,1);position:relative;z-index:1000;background:var(--n-ink);color:var(--n-tx2);" +
    "font:500 14px/1.3 " + FONT + ";border-bottom:1px solid var(--n-line);-webkit-font-smoothing:antialiased;text-align:left}" +
    ".rrn *{box-sizing:border-box;margin:0;padding:0}" +
    ".rrn a{color:inherit;text-decoration:none}" +
    ".rrn-in{display:flex;align-items:center;gap:4px;height:56px;padding:0 clamp(16px,3vw,40px);max-width:1440px;margin:0 auto}" +
    ".rrn-brand{display:flex;align-items:center;gap:9px;font-weight:600;font-size:15px;letter-spacing:-.01em;color:var(--n-tx);" +
    "margin-right:clamp(8px,2vw,28px);white-space:nowrap;min-height:44px}" +
    ".rrn-mk{width:22px;height:22px;border-radius:6px;background:var(--n-tx);color:var(--n-ink);display:grid;place-items:center;font-size:12px;font-weight:800}" +
    ".rrn-links{display:flex;align-items:center;gap:clamp(4px,1.2vw,14px)}" +
    ".rrn-grp{position:relative}" +
    ".rrn-btn{all:unset;box-sizing:border-box;position:relative;cursor:pointer;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 8px;" +
    "color:var(--n-tx2);font-size:14px;font-weight:500;border-radius:8px;transition:color .3s}" +
    ".rrn-btn::after{content:'';position:absolute;left:8px;right:8px;bottom:4px;height:2px;border-radius:1px;background:var(--n-tx);" +
    "transform:scaleX(0);transition:transform .5s var(--n-ease)}" +
    ".rrn-btn:hover,.rrn-grp.open>.rrn-btn,.rrn-grp.on>.rrn-btn{color:var(--n-tx)}" +
    ".rrn-grp.on>.rrn-btn::after{transform:scaleX(1)}" +
    ".rrn :focus-visible{outline:3px solid var(--n-blue);outline-offset:2px;border-radius:8px}" +
    ".rrn-car{width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;" +
    "transform:translateY(-2px) rotate(45deg);opacity:.75;transition:transform .3s var(--n-ease)}" +
    ".rrn-grp.open .rrn-car{transform:translateY(1px) rotate(225deg)}" +
    ".rrn-dd{position:absolute;top:calc(100% + 6px);left:-6px;min-width:300px;padding:8px;background:var(--n-panel);" +
    "border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5);display:none}" +
    ".rrn-grp.open .rrn-dd{display:block;animation:rrn-in .35s var(--n-ease)}" +
    "@keyframes rrn-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}" +
    ".rrn-it{display:block;padding:9px 12px;border-radius:10px;min-height:44px}" +
    ".rrn-it:hover,.rrn-it:focus-visible{background:rgba(255,255,255,.07);outline-offset:-3px}" +
    ".rrn-it b{display:block;font-weight:600;color:var(--n-tx);font-size:14px}" +
    ".rrn-it span{display:block;font-weight:400;color:var(--n-tx2);font-size:12.5px;margin-top:2px}" +
    ".rrn-it.sub{margin-left:14px;padding-left:12px;border-left:1px solid rgba(255,255,255,.14);border-radius:0 10px 10px 0}" +
    ".rrn-it[aria-current] b{color:var(--n-blue)}" +
    ".rrn-it[aria-current] b::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--n-blue);margin:0 7px 2px 0}" +
    ".rrn-sp{flex:1}" +
    ".rrn-right{display:flex;align-items:center;gap:6px}" +
    ".rrn-try{position:relative;display:inline-flex;align-items:center;min-height:38px;padding:0 18px;border-radius:999px;background:var(--n-tx);" +
    "color:var(--n-ink)!important;font-weight:600;font-size:14px;white-space:nowrap;transition:transform .3s var(--n-ease)}" +
    ".rrn-try::after{content:'';position:absolute;inset:-3px 0}" +
    ".rrn-try:hover{transform:scale(1.03)}" +
    ".rrn-ic{all:unset;box-sizing:border-box;cursor:pointer;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;color:var(--n-tx2)}" +
    ".rrn-ic:hover{background:rgba(255,255,255,.08);color:var(--n-tx)}" +
    ".rrn-ic svg{width:20px;height:20px}" +
    ".rrn-menu{display:none}" +
    "@media (max-width:960px){" +
    ".rrn-links{display:none}.rrn-menu{display:grid}" +
    ".rrn.mob .rrn-in{flex-wrap:wrap;height:auto;min-height:56px;padding-bottom:12px}" +
    ".rrn.mob .rrn-links{display:flex;flex-direction:column;align-items:stretch;gap:0;order:3;flex:1 0 100%;padding-top:6px}" +
    ".rrn.mob .rrn-grp{border-top:1px solid var(--n-line)}" +
    ".rrn.mob .rrn-btn{width:100%;min-height:48px;font-size:16px;color:var(--n-tx)}" +
    ".rrn.mob .rrn-btn::after{display:none}.rrn.mob .rrn-car{display:none}" +
    ".rrn.mob .rrn-dd{position:static;display:block;box-shadow:none;border:0;background:transparent;padding:0 0 8px;min-width:0;animation:none}" +
    ".rrn.mob button.rrn-btn{pointer-events:none;color:var(--n-tx2);font-size:13px;min-height:36px}" +
    "}" +
    "@media (max-width:420px){.rrn-try{padding:0 14px}.rrn-brand{margin-right:4px}}" +
    "@media (prefers-reduced-motion:reduce){.rrn *{transition:none!important;animation:none!important}}" +
    // footer: landing page footer, themed by the page's data-theme
    ".rrf{margin-top:clamp(40px,6vw,72px);padding:32px clamp(16px,3vw,40px) 112px;border-top:1px solid #DADADF;background:#F5F5F7;color:#515154;" +
    "font:400 13px/1.6 " + FONT + ";text-align:center}" +
    "html[data-theme='dark'] .rrf{background:#05070C;color:#AAB4C6;border-top-color:rgba(255,255,255,.09)}" +
    ".rrf.inherit{background:transparent;color:inherit;border-top-color:rgba(128,128,128,.3)}" +
    ".rrf p{max-width:72ch;margin:0 auto}.rrf b{font-weight:600}" +
    ".rrf ul{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:0 18px;margin:0 0 14px;padding:0}" +
    ".rrf ul a{display:inline-flex;align-items:center;min-height:44px;color:inherit;font-weight:600;text-decoration:none}" +
    ".rrf ul a:hover{text-decoration:underline;text-underline-offset:.2em}" +
    ".rrf :focus-visible{outline:3px solid #0A4FD6;outline-offset:2px;border-radius:6px}" +
    "html[data-theme='dark'] .rrf :focus-visible{outline-color:#9DBAFF}" +
    "@media print{.rrn,.rrf{display:none!important}}";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>'
  };

  var style = el("style"); style.textContent = CSS;
  document.head.appendChild(style);

  var bar = el("header", "rrn");
  bar.setAttribute("data-no-glossary", "");
  var inner = el("nav", "rrn-in");
  inner.setAttribute("aria-label", "RegRadar");
  bar.appendChild(inner);

  var brand = el("a", "rrn-brand", '<span class="rrn-mk" aria-hidden="true">R</span>RegRadar');
  brand.href = "index.html";
  inner.appendChild(brand);

  var links = el("div", "rrn-links");
  inner.appendChild(links);

  var groups = [];
  MENU.forEach(function (g, gi) {
    var wrap = el("div", "rrn-grp" + (g.id === activeGroup ? " on" : ""));
    if (g.href) {
      var link = el("a", "rrn-btn", esc(g.label));
      link.href = g.href;
      if (g.href === page) link.setAttribute("aria-current", "page");
      wrap.appendChild(link);
      links.appendChild(wrap);
      return;
    }
    var btn = el("button", "rrn-btn", esc(g.label) + '<span class="rrn-car" aria-hidden="true"></span>');
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "rrn-dd-" + gi);
    var dd = el("div", "rrn-dd");
    dd.id = "rrn-dd-" + gi;
    g.items.forEach(function (it) {
      var a = el("a", "rrn-it" + (it.sub ? " sub" : ""), "<b>" + esc(it.t) + "</b><span>" + esc(it.d) + "</span>");
      a.href = it.href;
      if (isCurrent(it.href)) a.setAttribute("aria-current", "page");
      dd.appendChild(a);
    });
    wrap.appendChild(btn); wrap.appendChild(dd);
    links.appendChild(wrap);
    groups.push(wrap);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !wrap.classList.contains("open");
      closeAll();
      if (willOpen) { wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
    });
    dd.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      var items = Array.prototype.slice.call(dd.querySelectorAll("a"));
      var i = items.indexOf(document.activeElement);
      e.preventDefault();
      i = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i].focus();
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown") return;
      e.preventDefault();
      closeAll(); wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true");
      var first = dd.querySelector("a"); if (first) first.focus();
    });
  });

  inner.appendChild(el("div", "rrn-sp"));
  var right = el("div", "rrn-right");
  inner.appendChild(right);

  var tryMax = el("a", "rrn-try", "Try Max");
  tryMax.href = "workspace.html";
  right.appendChild(tryMax);

  var menuBtn = el("button", "rrn-ic rrn-menu", ICON.menu);
  menuBtn.type = "button";
  menuBtn.setAttribute("aria-label", "Menu");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.addEventListener("click", function () {
    var on = bar.classList.toggle("mob");
    menuBtn.setAttribute("aria-expanded", on ? "true" : "false");
    menuBtn.innerHTML = on ? ICON.close : ICON.menu;
  });
  right.appendChild(menuBtn);

  function closeAll() {
    groups.forEach(function (w) {
      w.classList.remove("open");
      var b = w.querySelector("button.rrn-btn");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", function (e) { if (!bar.contains(e.target)) closeAll(); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = groups.filter(function (w) { return w.classList.contains("open"); })[0];
    if (open) { closeAll(); open.querySelector("button.rrn-btn").focus(); return; }
    if (bar.classList.contains("mob")) { menuBtn.click(); menuBtn.focus(); }
  });

  // Pages with a light/dark scheme define toggleTheme() later in the
  // document; offer it in the bar once the page has loaded.
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.toggleTheme !== "function") return;
    var t = el("button", "rrn-ic", ICON.theme);
    t.type = "button";
    t.title = "Light / dark";
    t.setAttribute("aria-label", "Switch between light and dark");
    t.addEventListener("click", function () { window.toggleTheme(); });
    right.insertBefore(t, menuBtn);
  });

  var me = document.currentScript;
  if (me && me.parentNode) me.parentNode.insertBefore(bar, me);
  else document.body.insertBefore(bar, document.body.firstChild);

  // Academy modules built on academy-shell.js (desk, ownership…) mount a
  // full-screen fixed frame (.ac-outer) and move the page's content —
  // this bar included — into its screen area. Put the bar back on top,
  // as the frame's first row.
  function dockInAcademyShell() {
    var outer = document.querySelector(".ac-outer");
    if (!outer || outer.firstChild === bar) return;
    bar.style.margin = "0 -10px";
    bar.style.flex = "0 0 auto";
    outer.insertBefore(bar, outer.firstChild);
  }
  document.addEventListener("DOMContentLoaded", dockInAcademyShell);

  // Footer: the same links as the bar, then the disclaimer (max-widget.js
  // appends "Bring Max back" to the first <p>, which is the disclaimer).
  // Full-screen Academy modules (fixed frame) cover it.
  document.addEventListener("DOMContentLoaded", function () {
    var academy = activeGroup === "academy";
    var note;
    if (academy) {
      note = " Academy cases, people and banks (including CF Bank) are fictional.";
    } else if (page === "country-risk.html") {
      note = " Ratings combine FATF and EU listings, the Transparency International CPI and the OC Index; " +
        "where a source could not be refreshed, the page says which values are last-known.";
    } else if (activeGroup === "max" || activeGroup === "law") {
      note = " Legal text is quoted verbatim from official EU sources (EUR-Lex); the firm, controls and test data shown are demo data stored on your device.";
    } else {
      note = " Collected daily from the NBB, FSMA, EBA, ECB, ESMA, EIOPA, AMLA, SRB, FSB, " +
        "the European Commission and EUR-Lex; summaries are AI-assisted.";
    }
    var f = el("footer", "rrf" + (academy ? " inherit" : ""));
    f.setAttribute("data-no-glossary", "");
    var nav = el("nav"); nav.setAttribute("aria-label", "Footer");
    var ul = el("ul");
    [["home.html", "Max"], ["academy.html", "Academy"], ["regwatch.html", "RegWatch"],
     ["country-risk.html", "Country risk"], ["law.html", "Read the law"], ["index.html", "About RegRadar"]]
      .forEach(function (l) { var li = el("li"); var a = el("a", null, esc(l[1])); a.href = l[0]; li.appendChild(a); ul.appendChild(li); });
    nav.appendChild(ul);
    f.appendChild(nav);
    f.appendChild(el("p", null, "<b>RegRadar is a prototype.</b> It is not legal advice: always check the " +
      "official source before acting." + note));
    document.body.appendChild(f);
  });
  window.addEventListener("load", dockInAcademyShell);

  // Max, the quiet assistant (max-widget.js decides where he appears; MAX_ENABLED is its kill switch).
  (function () { var s = document.createElement("script"); s.src = "max-widget.js?v=20261112p"; s.async = true; document.head.appendChild(s); })();
})();
