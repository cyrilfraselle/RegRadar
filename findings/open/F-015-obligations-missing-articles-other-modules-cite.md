---
id: F-015
title: Obligations registry omits AMLR articles that the BWRA, policies, cases and training modules rely on
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/obligations.json
  - build_obligations.py
found: 2026-10-29
fixed_by:
---

## Evidence
`docs/data/obligations.json` holds 12 obligations: AMLR Art. 19-26, 34, 42, 46, 69 (`_meta.scope`).
Other shipped modules work on provisions that have no register entry: `docs/cases.js:32-34` quotes
Art. 71 (refrain from transactions, 3 working days), Art. 72 and Art. 73 (tipping-off) and Art. 11(2)
(compliance officer); the Business-wide risk assessment module implements Art. 10; the policies module
implements Art. 9; the training module Art. 12. Counted occurrences of ids in data, JS and HTML:
only `AMLR-art19..26, 34, 42, 46, 69` exist; there is no `AMLR-art9`, `art10`, `art11`, `art12`, `art71`
or `art73`. Titles verified in `docs/data/laws/32024R1624_EN.json`: 9 "Scope of internal policies,
procedures and controls", 10 "Business-wide risk assessment", 11 "Compliance functions", 12 "Awareness of
requirements", 71 "Refraining from carrying out transactions", 73 "Prohibition of disclosure".

## Why it matters
A compliance officer at a payment, e-money or crypto firm cannot map a control, policy or case rule to
the governance, reporting-hold and tipping-off duties inspectors check first, and the "covered" ring on
the workspace silently ignores them. Links from the cases and policies modules to the register dead-end.

## Proposed fix
Owner approves scope. Then add six obligations (Art. 9, 10, 11, 12, 71, 73) with `scaffold_obligations.py`
for raw text, hand-written judgement fields, verbatim excerpts asserted by `build_obligations.py`, and
update `_meta.count/scope`. Same `deadline` 2027-07-10 as the others (Art. 90).

## How to verify
`python3 build_obligations.py` asserts all excerpts against the source; workspace shows 18 obligations;
the cases module "Learn more" for Art. 71/73 links to a register entry.
