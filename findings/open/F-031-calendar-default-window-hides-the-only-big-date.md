---
id: F-031
title: The calendar opens on "Next 90 days" and shows 1 date, while 21 of the 31 upcoming dates sit just beyond
area: regwatch
severity: P2
risk: low
status: open
effort: S
files:
  - docs/calendar.html
  - docs/calendar.js
found: 2026-11-16
fixed_by:
---

## Evidence
Measured with `RRCal.inWindow` on `docs/data/sources/deadlines.json` (95 dated
events, 31 on or after 2026-11-16), today = 2026-11-16:
- window 90 days (the default, `calendar.html:72` `value="90" selected`, `S.win = '90'` in `calendar.js`): **1** date (a CFSP sanctions decision applying today);
- window 180 days: still **1**;
- window 365 days: 21; "All upcoming": 31.
The 2027-07-10 AMLR/AMLD6 application date (236 days away) and the AMLA
RTS dates are therefore invisible on first load. The one row shown is not a
payment-firm obligation. The empty-state hint ("The next matching date is...")
only appears when the list is empty, so with 1 row it never shows.

## Why it matters
A compliance officer opens the page, sees a single sanctions decision and
concludes nothing is coming. The product's main forward date is hidden behind
a dropdown.

## Proposed fix
Default the window to "All upcoming" (or 12 months), and when the chosen
window holds fewer than 3 rows append one line: "Next date outside this
window: <date> (<title>). Widen the window." Keep `?today=` behaviour.

## How to verify
Load `calendar.html?today=2026-11-16`: the list opens with the 2027-07-10
rows visible without touching any control; `node tests/calendar.test.mjs` passes.
