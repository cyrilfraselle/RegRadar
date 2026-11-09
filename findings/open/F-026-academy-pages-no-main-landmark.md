---
id: F-026
title: Five Academy pages have no main landmark, so screen-reader users cannot jump to the content
area: academy
severity: P2
risk: low
status: open
effort: S
files:
  - docs/casefile.html
  - docs/desk.html
  - docs/ownership.html
  - docs/shift.html
  - docs/triage.html
found: 2026-11-09
fixed_by:
---

## Evidence
Counting `<main` and `role="main"` in `docs/*.html` on 2026-11-09: `casefile.html`, `desk.html`,
`ownership.html`, `shift.html` and `triage.html` have 0 of each (every other tool page has one). The axe
`region`/`landmark-one-main` rules are not counted as serious/critical, so smoke (0 violations on these pages)
does not see it. `desk.html` has a skip link (count 1) but the other four have none (`grep -ci skip` = 0), and
their body starts with the nav then content `div`s (`<body>` at casefile.html:216, ownership.html:183,
shift.html:271, triage.html:177).

## Why it matters
Keyboard and screen-reader users must tab through the whole site menu on every screen of the training
modules; the quality floor in NEXT_STEPS.md asks for real landmarks and keyboard access.

## Proposed fix
Wrap the primary content of each page in `<main id="main">` (or change the existing top content wrapper's
tag) without changing layout, and add a visually-hidden-until-focus "Skip to content" link as the first
element after the nav on the four pages without one. Reuse the skip-link style from `desk.html`.

## How to verify
Per page, `document.querySelectorAll('main').length === 1`; Tab from page load reaches the skip link first and
Enter moves focus into main. Smoke: no overflow or axe regressions at 390/768/1280.
