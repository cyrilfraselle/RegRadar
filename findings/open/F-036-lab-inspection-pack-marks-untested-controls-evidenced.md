---
id: F-036
title: Inspection-pack lab calls controls and training "Evidenced" on mere existence
area: compliance
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/labs/001-inspection-pack/pack.js
found: 2026-11-19
fixed_by:
---

## Evidence
`pack.js` rule for Controls and tests: "Evidenced when you have recorded your own
controls", code `n ? {state:'ok'}`; with the demo data, 4 controls with no
tests, owner or evidence render the green pill "Evidenced" (`#secs`, Playwright,
2026-11-19). Staff training is "Evidenced" when the progress object has any key.
Regulatory change log is "Evidenced" when the stored object has any key. This
contradicts VISION principle 2 ("a control without a test, an owner and
evidence is a gap") and the existing open finding F-004 (coverage counts untested controls).

## Why it matters
A document meant for a supervisor that labels untested controls "Evidenced"
is the overclaim an inspector punishes. It must fail safe.

## Proposed fix
Controls: ok only if each control has an owner and a test result within its
frequency (spine control tests); otherwise gap with counts of "no owner", "never
tested". Training: ok only if a completion record exists in the last 12 months,
else "Recorded, completion not dated". Change log: ok only if at least one
assessment has a decision. Keep rule text in each row. Depends on F-035.

## How to verify
Four demo controls without tests show "Gap: 4 never tested"; the green pill
appears only after tests are recorded in the workspace.
