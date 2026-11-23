---
id: F-038
title: Gap assessment shows "Covered and tested" for a control whose last test failed
area: compliance
severity: P1
risk: high
status: open
effort: S
files:
  - docs/gaps.js
found: 2026-11-23
fixed_by:
---

## Evidence
`docs/gaps.js` `ctlState()` (lines 21-27) returns 2 ("tested") whenever `c.last_tested` is set and not overdue.
It never reads `c.effectiveness`. In `docs/controls-store.js:45` a test result is one of
`effective | needs_improvement | failed`, and `recordTest()` (line 210-214) sets `last_tested = today`
and `effectiveness = result` for every result, including `failed`. So: approved control with an owner,
log a test with result "failed" -> `statusOf()` = `covered_tested`, the tile turns green, the lead line says
"N are covered and tested", and the xlsx export (line 117+) says "Covered and tested". Reproduce: open
gaps.html, in workspace.html log a failed test on an approved, owned, mapped control, reload gaps.html.

## Why it matters
VISION principle 2 (evidence-first): a failed control is a finding, not coverage. The gap map and its
dated snapshots are meant for the MLRO and inspectors, so a green tile on a failed control overstates
assurance in a regulator-facing export. It is a scoring rule, hence high risk (owner decision).

## Proposed fix
In `ctlState`, treat `effectiveness === 'failed'` as state 1 (in place, not effectively tested) and
`needs_improvement` as state 1 too, or add a config toggle `failedIsUntested` (default on) next to the
three existing toggles. Show "last test failed" in the detail pane control list and the status label
"Covered, last test failed". Keep snapshots backward compatible (status keys unchanged).

## How to verify
Control approved + owned + mapped + test result failed -> status "Covered, not tested" (or the new label),
not "Covered and tested"; the lead count and xlsx match; effective test still gives "Covered and tested".
