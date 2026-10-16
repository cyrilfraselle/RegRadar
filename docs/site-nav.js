/* ═══════════════════════════════════════════════════════════════
   RegRadar — site navigation (single source of truth)

   Every page used to carry its own copy of the top menu, and the
   copies drifted: RegWatch had a sidebar and three corner links, the
   reference pages a four-link bar, the Academy modules their own
   01/02/03 tabs with no way back. The menu now lives only here.

   Usage — first thing inside <body>:
     <script src="site-nav.js"></script>
   The bar is inserted where the script tag sits (synchronously, so the
   page never jumps). It is always dark: the pages it sits on use three
   different palettes and light/dark schemes, and a fixed dark bar
   reads as the site's frame on all of them.

   Pages deliberately left out of the menu (still load if visited):
   extractor (broken on GitHub Pages), ubo (on hold).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var MENU = [
    // One page: a plain link, no dropdown.
    { id: "regwatch", label: "RegWatch", href: "regwatch.html" },
    // Standalone tools: plain links.
    { id: "compliance", label: "Compliance", items: [
      { href: "workspace.html",       t: "Workspace",            d: "Obligations, law, controls, coverage" },
      { sep: "Assess" },
      { href: "risk-assessment.html", t: "Business risk",        d: "Firm-wide ML/TF risk assessment" },
      { href: "customer-risk.html",   t: "Customer risk",        d: "Scoring, onboarding checklists, reviews" },
      { sep: "Operate" },
      { href: "cases.html",           t: "Cases and STR",        d: "Alerts, case files, reports to the FIU" },
      { href: "policies.html",        t: "Policies",             d: "Versions, sign-off, attestations" },
      { href: "actions.html",         t: "Issues and actions",   d: "Remediation, escalation, board report" },
      { href: "impact.html",          t: "Change impact",        d: "What a regulatory change touches in your firm" },
      { href: "ask.html",             t: "Ask the law",          d: "Cited answers, checked against the legal text" },
      { sep: "Reference" },
      { href: "law.html",             t: "Read the law",         d: "EU texts in EN, FR, NL" },
    ]},
    { id: "country", label: "Country Risk", href: "country-risk.html" },
    { id: "academy", label: "Academy", items: [
      { href: "academy.html",     t: "Overview",            d: "How the training works" },
      { href: "workstation.html", t: "Analyst workstation", d: "The full simulation" },
      { sep: "Practice modules" },
      { href: "laundromat.html",  t: "01 · Laundromat",     d: "Spot the red flags" },
      { href: "ownership.html",   t: "02 · Ownership",      d: "Find the beneficial owner" },
      { href: "desk.html",        t: "03 · The Desk",       d: "Work an alert queue" },
      { sep: "Reference" },
      { href: "glossary.html",    t: "AML/KYC Glossary",    d: "Terms explained plainly" },
    ]},
  ];

  var GROUP_OF = {
    "regwatch.html": "regwatch",
    "workspace.html": "compliance", "law.html": "compliance", "obligations.html": "compliance",
    "risk-assessment.html": "compliance", "customer-risk.html": "compliance", "cases.html": "compliance",
    "policies.html": "compliance", "actions.html": "compliance", "impact.html": "compliance", "ask.html": "compliance",
    "controls.html": "compliance", "dashboard.html": "compliance",
    "country-risk.html": "country", "glossary.html": "academy",
    "academy.html": "academy", "workstation.html": "academy", "laundromat.html": "academy",
    "ownership.html": "academy", "desk.html": "academy", "shift.html": "academy",
    "triage.html": "academy", "casefile.html": "academy",
  };
  var page = location.pathname.split("/").pop();
  var activeGroup = GROUP_OF[page] || "";

  var CSS =
    ".rrn{--rrn-bg:#0B0D10;--rrn-bg2:#14171B;--rrn-line:#262B33;--rrn-tx:#C9CED6;--rrn-tx2:#8B929C;" +
    "--rrn-hi:#FFFFFF;--rrn-acc:#4D8DFF;position:relative;z-index:1000;background:var(--rrn-bg);" +
    "color:var(--rrn-tx);font:500 13px/1.3 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;" +
    "border-bottom:1px solid var(--rrn-line);-webkit-font-smoothing:antialiased}" +
    ".rrn *{box-sizing:border-box}" +
    ".rrn-in{display:flex;align-items:center;gap:6px;height:48px;padding:0 16px;max-width:1440px;margin:0 auto}" +
    ".rrn a{color:inherit;text-decoration:none}" +
    ".rrn-brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px;color:var(--rrn-hi);" +
    "margin-right:14px;letter-spacing:-.01em;white-space:nowrap}" +
    ".rrn-mk{width:24px;height:24px;border-radius:6px;background:var(--rrn-acc);color:#05070C;display:grid;" +
    "place-items:center;font-weight:800;font-size:13px}" +
    ".rrn-sub{font-weight:400;font-size:11px;color:var(--rrn-tx2)}" +
    ".rrn-grp{position:relative}" +
    ".rrn-btn{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;height:48px;padding:0 12px;" +
    "color:var(--rrn-tx);border-bottom:2px solid transparent;margin-bottom:-1px}" +
    ".rrn-btn:hover,.rrn-grp.open .rrn-btn{color:var(--rrn-hi)}" +
    ".rrn-btn:focus-visible{outline:2px solid var(--rrn-acc);outline-offset:-4px;border-radius:6px}" +
    ".rrn-grp.on .rrn-btn{color:var(--rrn-hi);border-bottom-color:var(--rrn-acc)}" +
    ".rrn-car{width:7px;height:7px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;" +
    "transform:translateY(-2px) rotate(45deg);opacity:.7;transition:transform .15s}" +
    ".rrn-grp.open .rrn-car{transform:translateY(1px) rotate(225deg)}" +
    ".rrn-dd{position:absolute;top:calc(100% + 1px);left:0;min-width:270px;padding:6px;background:var(--rrn-bg2);" +
    "border:1px solid var(--rrn-line);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.45);display:none}" +
    ".rrn-grp.open .rrn-dd{display:block}" +
    ".rrn-it{display:block;padding:8px 10px;border-radius:7px}" +
    ".rrn-it:hover,.rrn-it:focus-visible{background:#1E232A;outline:none}" +
    ".rrn-it b{display:block;font-weight:600;color:var(--rrn-hi);font-size:13px}" +
    ".rrn-it span{display:block;font-weight:400;color:var(--rrn-tx2);font-size:12px;margin-top:2px}" +
    ".rrn-it.cur b{color:var(--rrn-acc)}" +
    ".rrn-sep{padding:10px 10px 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;" +
    "color:var(--rrn-tx2);border-top:1px solid var(--rrn-line);margin-top:6px}" +
    ".rrn-sp{flex:1}" +
    ".rrn-ic{all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:7px;" +
    "color:var(--rrn-tx);font-size:15px}" +
    ".rrn-ic:hover{background:#1E232A;color:var(--rrn-hi)}" +
    ".rrn-ic:focus-visible{outline:2px solid var(--rrn-acc)}" +
    ".rrn-right{display:flex}.rrn-menu{display:none}" +
    "@media (max-width:900px){" +
    ".rrn-sub,.rrn-grp{display:none}.rrn-menu{display:grid}" +
    ".rrn.mob .rrn-in{flex-wrap:wrap;height:auto;min-height:48px}" +
    ".rrn.mob .rrn-grp{display:block;flex:1 0 100%;border-top:1px solid var(--rrn-line);order:2}" +
    ".rrn.mob .rrn-btn{height:44px;width:100%}.rrn.mob .rrn-grp.on .rrn-btn{border-bottom-color:transparent}" +
    ".rrn.mob .rrn-dd{position:static;display:block;box-shadow:none;border:0;background:transparent;padding:0 0 8px}" +
    ".rrn.mob .rrn-car{display:none}}" +
    ".rrf{margin-top:48px;padding:22px 16px 28px;border-top:1px solid rgba(128,128,128,.25);" +
    "font:400 12px/1.6 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:inherit;opacity:.82;text-align:center}" +
    ".rrf p{max-width:760px;margin:0 auto}.rrf b{font-weight:600}";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var style = el("style"); style.textContent = CSS;
  document.head.appendChild(style);

  var bar = el("header", "rrn");
  bar.setAttribute("role", "banner");
  bar.setAttribute("data-no-glossary", "");
  var inner = el("nav", "rrn-in");
  inner.setAttribute("aria-label", "RegRadar");
  bar.appendChild(inner);

  inner.appendChild(el("a", "rrn-brand",
    '<span class="rrn-mk">R</span>RegRadar<span class="rrn-sub">Belgium &amp; EU</span>'));
  inner.lastChild.href = "index.html";

  var groups = [];
  MENU.forEach(function (g, gi) {
    var wrap = el("div", "rrn-grp" + (g.id === activeGroup ? " on" : ""));
    if (g.href) {
      var link = el("a", "rrn-btn", esc(g.label));
      link.href = g.href;
      if (g.id === activeGroup) link.setAttribute("aria-current", "page");
      wrap.appendChild(link);
      inner.appendChild(wrap);
      return;
    }
    var btn = el("button", "rrn-btn", esc(g.label) + '<span class="rrn-car" aria-hidden="true"></span>');
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "rrn-dd-" + gi);
    var dd = el("div", "rrn-dd");
    dd.id = "rrn-dd-" + gi;
    g.items.forEach(function (it) {
      if (it.sep) { dd.appendChild(el("div", "rrn-sep", esc(it.sep))); return; }
      var a = el("a", "rrn-it" + (it.href.split("#")[0] === page ? " cur" : ""),
        "<b>" + esc(it.t) + "</b><span>" + esc(it.d) + "</span>");
      a.href = it.href;
      dd.appendChild(a);
    });
    wrap.appendChild(btn); wrap.appendChild(dd);
    inner.appendChild(wrap);
    groups.push(wrap);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !wrap.classList.contains("open");
      closeAll();
      if (willOpen) { wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
    });
  });

  inner.appendChild(el("div", "rrn-sp"));
  var right = el("div", "rrn-right");
  inner.appendChild(right);

  var menuBtn = el("button", "rrn-ic rrn-menu", "☰");
  menuBtn.type = "button";
  menuBtn.setAttribute("aria-label", "Menu");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.addEventListener("click", function () {
    var on = bar.classList.toggle("mob");
    menuBtn.setAttribute("aria-expanded", on ? "true" : "false");
    menuBtn.textContent = on ? "✕" : "☰";
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
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

  // Pages with a light/dark scheme define toggleTheme() later in the
  // document; offer it in the bar once the page has loaded.
  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.toggleTheme !== "function") return;
    var t = el("button", "rrn-ic", "◐");
    t.type = "button";
    t.title = "Light / dark";
    t.setAttribute("aria-label", "Toggle light or dark theme");
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

  // Footer disclaimer, on every page that carries the menu. Full-screen
  // Academy modules (fixed frame) cover it; they show their own
  // "simulated environment · fictional data" notice instead.
  document.addEventListener("DOMContentLoaded", function () {
    var academy = activeGroup === "academy";
    var note;
    if (academy) {
      note = " Academy cases, people and banks (including CF Bank) are fictional.";
    } else if (page === "country-risk.html") {
      note = " Ratings combine FATF and EU listings, the Transparency International CPI and the OC Index; " +
        "where a source could not be refreshed, the page says which values are last-known.";
    } else if (activeGroup === "compliance") {
      note = " Legal text is quoted verbatim from official EU sources (EUR-Lex); the firm, controls and test data shown are demo data stored on your device.";
    } else {
      note = " Collected daily from the NBB, FSMA, EBA, ECB, ESMA, EIOPA, AMLA, SRB, FSB, " +
        "the European Commission and EUR-Lex; summaries are AI-assisted.";
    }
    var f = el("footer", "rrf",
      "<p><b>RegRadar is a prototype.</b> It is not legal advice: always check the " +
      "official source before acting." + note + "</p>");
    f.setAttribute("data-no-glossary", "");
    document.body.appendChild(f);
  });
  window.addEventListener("load", dockInAcademyShell);
})();
