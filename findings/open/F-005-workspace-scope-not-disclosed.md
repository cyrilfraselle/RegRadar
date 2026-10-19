---
id: F-005
title: Coverage dashboard does not say it covers only 12 AMLR articles, while the firm-type picker says DORA, MiCA, PSD2 apply
area: compliance
severity: P1
risk: low
status: open
effort: S
files:
  - docs/workspace.html
found: 2026-10-19
fixed_by:
---

## Evidence
`docs/data/obligations.json` `_meta`: count 12, scope "AMLR ... Chapter III Section 1 ... plus EDD,
PEP, suspicious-transaction reporting"; all 12 ids are `AMLR-art*`. Yet `data/applicability.json`
(same workspace, firm-type picker `#entitySel`) covers 15 regulations and marks DORA
(32022R2554), PSD2 (32015L2366), MiCA (32023R1114) and the Transfer of Funds Regulation
(32023R1113) as applicable to payment, e-money and crypto firms, and their full text is in
`docs/data/laws/`. `workspace.html` (checked: grep for "AMLR", "scope", "12 obligations") shows no
statement of scope next to the KPI ring; selecting "Payment institution" still reports "x percent
covered" from AMLR-only data. The one place the limit is written is the `_meta` field, never shown.

## Why it matters
A compliance officer at a payment or crypto firm reads "100 percent covered" and does not learn
that operational resilience (DORA), safeguarding/SCA (PSD2/EMD2) and MiCA obligations are not in the
register at all. That is the most likely thing to be missed and the claim most likely to overreach.

## Proposed fix
Render a persistent notice above the KPIs from `_meta.scope` and `_meta.count`: "This register
contains N obligations from AMLR only. DORA, MiCA, PSD2/EMD2 and TFR obligations are not yet
included; coverage figures do not speak to them." When an entity is selected, list the
regulations `applicability.json` marks direct/conditional for it that have no obligations.
Copy and display only, no data change.

## How to verify
Open workspace.html, pick "Crypto / CASP": the notice names MiCA and TFR as not yet in the
register; the notice also appears in the CSV header row.
