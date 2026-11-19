---
id: F-033
title: The home briefing says there is no regulatory deadline in 30 days without reading the deadlines the calendar uses
area: shared
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/home.js
found: 2026-11-16
fixed_by:
---

## Evidence
`grep -l "sources/deadlines" docs/*.js docs/*.html` returns only `calendar.js`
and `regwatch.js`. `home.js` (the briefing, VISION idea "Jarvis") builds its
due list from the spine, which takes regulatory dates from
`docs/data/items.json` only when the feed states a deadline (`rr-core.js:238`)
and from `obligations.json`, and prints at `home.js:210`: "No regulatory
deadline in the next 30 days in the repository data". Meanwhile
`deadlines.json` holds 95 dated events (31 upcoming, 10 consultation closings
in 2026, AMLA RTS dates). The calendar and the briefing can therefore
disagree about the same fortnight.

## Why it matters
The briefing is meant to be the opening screen; two tools in the same
product giving different answers to "what is due" erodes trust.

## Proposed fix
In `home.js`, fetch `data/sources/deadlines.json` (tolerate failure) and count
rows within 30 days as regulatory dates in the Due tiles, linking to
`calendar.html`; reuse `RRCal.normalise`/`inWindow` rather than new date code.
Keep the existing empty sentence but make it name the calendar as the source.

## How to verify
With `?today` or by temporarily editing a fixture so one date falls in 30 days,
the briefing tile counts it and the calendar shows the same date; with the
file missing the page shows no console error (smoke).
