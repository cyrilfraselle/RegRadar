---
id: F-029
title: RegWatch, the law reader and the glossary have no skip link, so keyboard users tab through the whole nav each time
area: shared
severity: P3
risk: low
status: open
effort: S
files:
  - docs/regwatch.html
  - docs/law.html
  - docs/glossary.html
found: 2026-11-12
fixed_by:
---

## Evidence
`grep -ci skip` on `docs/regwatch.html`, `docs/law.html`, `docs/glossary.html` = 0 each, and `docs/site-nav.js` has no
skip logic (0 matches). Each has `<main class="wrap" id="main">` (regwatch.html:223, law.html:191, glossary.html:44), so
the target exists. Other tool pages (actions, cases, policies, impact, ask, workspace) already have a skip link
(`grep -ci skip` = 3 to 4). The injected nav (`site-nav.js`) holds the Compliance menu of 9 links plus the other tool entries.

## Why it matters
Keyboard and screen-reader users cross the whole header before the content on the three most-read pages (WCAG 2.4.1).
axe does not flag it as serious, so smoke is blind to it.

## Proposed fix
Copy the skip-link markup and CSS used in `docs/policies.html` (first element in `<body>`, `href="#main"`, visible on
focus) into the three pages, and make `main` `tabindex="-1"` if the target does not take focus.

## How to verify
Tab once on each page: a "Skip to content" link appears and Enter moves focus to `main`. Smoke axe stays 0.
