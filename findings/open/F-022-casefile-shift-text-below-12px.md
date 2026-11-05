---
id: F-022
title: Casefile and Shift academy pages use 9-11px text in 51 declarations
area: academy
severity: P2
risk: low
status: open
effort: S
files:
  - docs/casefile.html
  - docs/shift.html
found: 2026-11-05
fixed_by:
---

## Evidence
- Count of `font-size` declarations below 12px (`grep -cE "font-size: ?(([0-9]|1[01])(\.[0-9]+)?px|0?\.[0-6][0-9]*rem)"`): `casefile.html` 29, `shift.html` 22 (46 literal 9-11.5px matches by the narrower regex `font-size: ?(9|10|11)(\.5)?px`).
- Both pages are linked from `docs/site-nav.js` and from each other and `triage.html`; they are the story-driven end of the Academy track.
- Quality floor in NEXT_STEPS rule 4: text >= 12px. Axe does not flag font size, so the smoke ratchet cannot catch this.

## Why it matters
Uppercase 9-11px labels (case ids, figures, footers) are the content a trainee needs to read cases; they are hard to read on phones and for low-vision users.

## Proposed fix
In both files raise all sub-12px `font-size` values to 12px (use a single `--fs-label:12px` custom property per file if simpler). Re-check that headers, chips and tables do not wrap into overflow at 390px.

## How to verify
The grep above returns 0 lines for both files; smoke overflow stays `[]` at 390/768/1280 and axe stays 0.
