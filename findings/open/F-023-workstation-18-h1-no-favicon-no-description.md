---
id: F-023
title: Analyst workstation page has 18 <h1> elements, no favicon and no meta description
area: academy
severity: P3
risk: low
status: open
effort: S
files:
  - docs/workstation.html
found: 2026-11-05
fixed_by:
---

## Evidence
- `grep -c "<h1" docs/workstation.html` = 18 (page chrome at line 804 plus one per simulated app window, e.g. lines 871, 903, 986). Other pages have exactly one.
- No `<link rel="icon">` (every other page has one) and no `<meta name="description">`.
- Axe does not flag these under wcag2a/aa tags, so the smoke ratchet is silent.

## Why it matters
Screen-reader users navigating by heading get 18 top-level headings with no outline; the tab shows the browser's default icon. This is the flagship Academy page.

## Proposed fix
Keep the single page title `<h1>` (line 804, desktop mark) and demote the in-window titles to `<h2>`, adjusting CSS selectors that target `h1.pt` accordingly. Add `<link rel="icon" type="image/svg+xml" href="favicon.svg">` and a one-sentence meta description saying it is a simulation with fictional data.

## How to verify
`grep -c "<h1" docs/workstation.html` = 1 (the small-screen notice at line 766 may stay if only one is visible at a time; document which); the page looks unchanged at 1280px; favicon request returns 200.
