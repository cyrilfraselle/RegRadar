---
id: F-039
title: Gap assessment page (gaps.html) is not linked from the site navigation or any page
area: shared
severity: P2
risk: low
status: open
effort: S
files:
  - docs/site-nav.js
found: 2026-11-23
fixed_by:
---

## Evidence
`gaps.html` (added 2026-11-18, commit 5747281) has 0 references in any other `docs/*.html` or `docs/*.js`
(grep for "gaps.html" across docs/ returns only the file itself). `docs/site-nav.js` MENU "Max" group
(lines 24-35) lists Briefing, Work board, Register, Topics, Controls, Policies, Risk, Customer risk, Cases,
Issues and actions, Change impact, Ask the law, but not the gap assessment, and the page-to-group map
(line 50-53) has no `"gaps.html"` entry, so the page shows no active nav state either.

## Why it matters
The page that answers "what are we not covered on" for a compliance officer cannot be found except by typing
the URL, which also hides it from the smoke/review attention that linked pages get.

## Proposed fix
Add `{ href: "gaps.html", t: "Gaps", d: "Obligations x controls: what is not covered or tested" }` after
"Register" in the Max group, and `"gaps.html": "max"` in the group map. No other change.

## How to verify
Every page's nav shows "Gaps"; on gaps.html the Max group is highlighted; smoke stays at 0 new violations.
