---
id: F-001
title: Academy pages use a grey (#8B9099) that fails text contrast on 3 pages (30 axe violations)
area: academy
severity: P2
risk: low
status: fixed
effort: S
files:
  - docs/shift.html
  - docs/triage.html
  - docs/casefile.html
found: 2026-10-19
fixed_by: fix/F-001-academy-ink3-contrast
---

## Evidence
`node tests/smoke.mjs` (report.json, 2026-10-19): shift.html axe 12, casefile.html axe 16,
triage.html axe 2, all `color-contrast` serious. A targeted axe run shows one colour
causes them all: `#8b9099` on `#fafafa` = 3.07:1 and on `#f4f5f6` = 2.93:1 (needs 4.5:1).
It comes from the token declared at `shift.html:21` (`--ink-3`), `casefile.html:19` (`--ink-3`)
and `triage.html:14` (`--text-3`). Affected text: nav links `.rr > a`, `.ac-tab > .n`,
`.rlbl`, `.fine`, `.keyhint`, `.badge.locked`, triage `footer span`.

## Why it matters
Low-vision users cannot read hints, step numbers and the locked-badge labels in the training
pages; it is also 30 of the 62 serious axe violations in the whole site.

## Proposed fix
In each of the three files change the light-theme token to a value with >= 4.5:1 on #fafafa and
#f4f5f6 (for example `#5B6069`'s lighter sibling `#6B717A`, check it is >= 4.5 on both).
Do not touch the dark-theme token unless axe flags it.

## How to verify
`cd tests && node smoke.mjs`: axe for shift, casefile and triage is 0; then ratchet the baseline.
