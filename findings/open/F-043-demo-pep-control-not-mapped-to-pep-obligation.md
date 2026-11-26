---
id: F-043
title: Demo control "Enhanced ongoing monitoring: PEP book" maps to no obligation, so AMLR Art. 42 (PEPs) shows as a gap; 13 of 21 obligations have no control at all
area: compliance
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/data/controls.json
found: 2026-11-26
fixed_by:
---

## Evidence
`docs/data/controls.json` (8 controls, generated 2026-09-29, scope text still says "Chapter III"): ctl-06, ctl-07 and ctl-08 have `"obligation_ids": []`. ctl-07 is named "Enhanced ongoing monitoring — PEP book"; `AMLR-art42` in `obligations.json` is the PEP provision (`what`: "PEP relationships need senior management sign-off ... enhanced ongoing monitoring"). The register grew from 12 to 21 obligations on 2026-11-23, the controls seed was not updated.
Script on 2026-11-26: obligations with no mapped control = Art. 8, 9, 10, 11, 12, 13, 14, 16, 18, 34, 42, 46, 69 (13 of 21). That includes Art. 69 (report to the FIU), rated high.

## Why it matters
A first-time user opening the demo sees most "high" obligations as uncovered, including PEPs where the demo control exists. This looks like a product fault, and the coverage dashboard teaches the wrong lesson.

## Proposed fix
Map ctl-07 to `AMLR-art42` (the only mapping the control name supports). Optionally add three clearly fictional demo controls for Art. 69 (STR escalation), Art. 11/13 (compliance officer reporting, staff training) and Art. 10 (annual BWRA refresh), `status: pending_review`, `last_tested: null`. Update `_meta.scope`. Do not add test results or evidence the demo does not have (see F-004, F-036).

## How to verify
Workspace demo: Art. 42 shows one linked control; uncovered count drops from 13; `node tests/spine.test.mjs` and the smoke run still pass.
