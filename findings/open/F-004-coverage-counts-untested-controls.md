---
id: F-004
title: "Covered" counts any mapped control, even a draft, in-review or untested one
area: compliance
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/controls-data.js
  - docs/workspace.html
found: 2026-10-19
fixed_by:
---

## Evidence
`docs/controls-data.js:108-122` `coverage()` marks an obligation mapped when
`controls.filter(c => has(c.obligation_ids, o.id)).length > 0`, ignoring `status`, `last_tested`
and `effectiveness`. `workspace.html:230-232` turns that into the KPI ring "N percent covered"
and "Open gaps", and `csv()` (line 389-390) exports the same as "Covered" / "Gap". In
`data/controls.json` ctl-06 and ctl-07 are `pending_review` and ctl-07 has `last_tested: null`:
mapping either to an obligation turns its gap into "Covered". The overdue count is shown
separately (line 234) but never reduces coverage.

## Why it matters
VISION.md principle 2 says a control without a test, owner and evidence is a gap and the product
says so plainly. The headline number overstates coverage, and it is exported into a report an
MLRO may hand to a board or regulator. This is a scoring rule, hence high risk.

## Proposed fix
Owner decides the definition. Recommended: an obligation is "Covered" only if it has at least one
control that is `approved`, has a recorded test, and is not overdue; "Partially covered" if mapped
only to draft/in-review/overdue controls; "Gap" otherwise. Show the three states in the ring,
list and CSV, and add a one-line "how coverage is computed" note (already in NEXT_STEPS B).

## How to verify
Map ctl-07 (untested) to an otherwise unmapped obligation: it shows Partial, not Covered, and
the CSV status column matches.
