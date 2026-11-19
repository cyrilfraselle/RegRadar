---
id: F-027
title: RegWatch "Coming up" is a hand-typed 4-line list with no sources, and no consultation closing date appears anywhere
area: regwatch
severity: P1
risk: medium
status: fixed (items 1-2; consultation closing dates remain, see follow-up)
effort: S
files:
  - intelligence_v4.py
  - docs/regwatch.html
found: 2026-11-12
fixed_by: fix/F-027-regwatch-sourced-dates
---

## Evidence
- `docs/data/meta.json` `timeline` has 4 entries on 2026-11-12: CSRD reporting, CRR3 own funds, MiCA Commission review,
  and "AMLR applies; AMLD6 transposition deadline" (10 Jul 2027). Only the last one is AML/payments/crypto
  operational. Rendered by `deadlineRow()` in `docs/regwatch.html:380`; the empty state is "No dated deadlines".
- The entries come from `BASE_TIMELINE` in `intelligence_v4.py:219-227`, typed by hand. No entry has a `source`
  or URL field, so the reader cannot check any date. Three of the 7 base entries (2026-07-01, 2026-07-10,
  2026-09-17) are already in the past and silently drop out; the 17 Sep 2026 "DORA first ICT major-incident
  reporting review window" has no citation anywhere in the repo.
- `docs/data/items.json` (724 items): the `deadline` field is empty on 724 of 724 items, `so_what` and `action`
  are empty on 714 of 724. Example: "Consultation on the draft RTS on Customer Due Diligence" (AMLA, 2026-10-06,
  `impact: 3`, url set) has `deadline: ""`. 16 items are `doc_type: consultation`, none carries a closing date.

## Why it matters
An MLRO opens RegWatch to learn what is due next. The consultation windows on AMLA draft RTS (CDD, group-wide
requirements) are exactly what they must respond to, and they are invisible. Unsourced dates in a compliance
calendar are worse than none: nobody can verify them. This is the "horizon scanning as a core loop" promise in
VISION.md, today unmet.

## Proposed fix
1. In `intelligence_v4.py` add a required `source` URL (official EUR-Lex or regulator page) to every
   `BASE_TIMELINE` entry; entries whose date cannot be tied to a source are removed, not guessed. Pass `source`
   through to `meta.json`.
2. In `docs/regwatch.html` `deadlineRow()` render the source as a link ("Source") and drop the entry if absent.
3. For `doc_type == consultation` items, read the closing date from the item page/summary when stated and put it in
   `deadline`; if not stated leave empty. Do not infer. (If this is too large for one PR, ship 1 and 2 and file a
   follow-up for 3.)
Dates must come from the cited source, never from memory.

## How to verify
`meta.json` `timeline` entries all have a `source` that resolves; the Coming up panel shows a "Source" link per row;
no row lacks one. Count of `items.json` consultations with a non-empty `deadline` goes up from 0 where the source states one.
