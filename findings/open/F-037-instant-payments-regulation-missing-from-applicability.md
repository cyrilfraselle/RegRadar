---
id: F-037
title: Instant Payments Regulation (EU) 2024/886 is absent from the law corpus and applicability matrix
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/applicability.json
found: 2026-11-19
fixed_by:
---

## Evidence
`docs/data/applicability.json` lists 15 regulations (AMLR, AMLD6, AMLAR, TFR, DORA,
NIS2, MiCA, MiFID II, MiFIR, MAR, CRR, CRD IV, PSD2, EMD2, GDPR). `docs/data/laws/`
holds the same set; no `32024R0886` file. In `docs/data/items.json` (765 items) the
string "2024/886" occurs 0 times and "verification of payee" 0 times. The matrix is
what drives "what applies to us" in the workspace, impact analysis and RegWatch
(`impact-match.js`, `regwatch.js`). A payment or e-money institution therefore gets
a list with no instant-payment or SEPA rule at all.

## Why it matters
VISION targets payment and e-money firms; the headline payments rulebook after
PSD2 is missing, so "what applies to us" is silently incomplete for the core
segment. I did not verify the application dates against the OJ text in this run;
the developer must take them from the official text, never from memory.

## Proposed fix
Owner decides scope. Then add one regulation entry for CELEX 32024R0886 (applies
per entity type, `applies_from` from the OJ text, note on euro-area versus
non-euro states) and add the CELLAR text to the laws corpus in a separate
pipeline change. Cite the article for each verdict.

## How to verify
Impact page for a payment institution lists the instrument with a source link;
`python3 -m json.tool docs/data/applicability.json` passes; smoke unchanged.
