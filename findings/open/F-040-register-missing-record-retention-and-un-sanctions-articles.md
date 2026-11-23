---
id: F-040
title: Register has no record-retention (AMLR Art. 77-78) or UN-sanctions freeze (Art. 27) obligation
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/obligations.json
  - build_obligations.py
found: 2026-11-23
fixed_by:
---

## Evidence
`docs/data/obligations.json` has 21 obligations: AMLR Art. 8-14, 16, 18-26, 34, 42, 46, 69. In
`docs/data/laws/32024R1624_EN.json` the articles "Temporary measures for customers subject to UN
financial sanctions" (Art. 27), "Record retention" (Art. 77) and "Provision of records to competent
authorities" (Art. 78) exist and have no register entry; grep of `obligations.json` for 77 and 78 finds
none. They are not in open F-015 (Art. 9-12, 71, 73) or F-013 (TFR). No module covers them either:
`docs/cases.js` and `docs/policies-data.js` have no retention rule or period.

## Why it matters
Record retention (five-year period, access for supervisors on request) and freezing on UN listings are among
the first things an inspector asks a payment, e-money or crypto firm to show. A control library with no
register entry to map to cannot show coverage, and "Ask the law" retrieval can find the text but the
register and gap map stay silent.

## Proposed fix
Owner approves scope. Add Art. 27, 77 and 78 with `scaffold_obligations.py` raw text, hand-written
judgement fields, verbatim excerpts asserted by `build_obligations.py`, deadline per Art. 90 (2027-07-10),
and update `_meta.count/scope`. Check legal wording of any judgement field before merge.

## How to verify
`python3 build_obligations.py` passes its assertions; register shows 24 obligations; gaps.html lists
three more "Not covered" tiles; `verified_obligations` in metrics rises by 3.
