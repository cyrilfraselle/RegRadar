---
id: F-013
title: The obligations register has no Transfer of Funds Regulation (travel rule) duties, which already apply to payment and crypto firms
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/obligations.json
found: 2026-10-26
fixed_by:
---

## Evidence
`docs/data/obligations.json` holds 12 items, all `AMLR-art19..26, 34, 42, 46, 69` (`_meta.scope`: AMLR Chapter III Section 1 plus STR). The full text of Regulation (EU) 2023/1113 (TFR) is already in the repo (`docs/data/laws/32023R1113_EN.json`, 30+ articles: Art. 4-6 payer/payee data, Art. 7-9 missing information, Art. 14-19 crypto-asset transfers, Art. 26 record retention) and `docs/ai.js` even has a "travel rule" query expansion, but no register entry, control mapping, impact rule or coverage count refers to it. The `who` values in the register already include `pi`, `emi` and `casp`.

## Why it matters
For the product's stated first customers (payment, e-money, crypto), the travel rule is the obligation they are examined on first and it is applicable now, whereas the registered AMLR duties mostly apply from 10 Jul 2027. A coverage dashboard that says the firm is covered while showing none of the TFR duties gives a misleading picture for exactly those firms (the scope notice added for F-005 mitigates but does not close this).

## Proposed fix
First slice only (about 6 entries, under 300 lines): TFR Art. 4 (payer and payee data), Art. 7 (detect missing info, PSP), Art. 14 (crypto transfers info), Art. 16 (CASP detect missing info), Art. 17 (CASP incomplete info handling), Art. 26 (record retention). Same schema as the existing items; every `verbatim` excerpt copied from `32023R1113_EN.json` and asserted by a script, `who` limited to the types the article actually binds, deadlines taken from the text. Update `_meta.count` and `scope`. Owner review needed because it adds legal claims and priorities.

## How to verify
A script asserts every `verbatim` fragment appears in the cited article's text; `docs/workspace.html` lists the new items; smoke ratchet unchanged.
