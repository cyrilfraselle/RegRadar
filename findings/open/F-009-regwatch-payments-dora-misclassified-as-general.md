---
id: F-009
title: Payments and DORA-relevant items fall into "General"; the payments themes hold 3.6% of the feed
area: regwatch
severity: P2
risk: medium
status: open
effort: S
files:
  - regulatory_watch.py
found: 2026-10-22
fixed_by:
---

## Evidence
`docs/data/items.json` on 2026-10-22: 585 items; theme counts: General 170 (29%), AML/CFT 160,
MiCA/Crypto 105, Market Infrastructure 98, Payments 15 (2.6%), DORA 6 (1.0%).
Of the 170 items tagged only `General`, 24 contain payment/ICT/DORA/fraud/third-party words in the
title (regex `payment|PSD|e-money|instant|DORA|ICT|operational resilience|cyber|third-party|SEPA|IBAN|fraud`),
for example the EBA final Guidelines on third-party risk (several syndicated copies from Deloitte,
Cyprus Mail, Noerr) and "Noah secures EU licences to expand digital asset payments". The keyword
table at `regulatory_watch.py:650-657` has no "third-party risk", "outsourcing", "SEPA", "fraud"
or bare "payments".
Also 27 title-duplicate groups (54 items, 9% of the feed) remain after `seen.json` dedup (same
headline minus the outlet suffix).

## Why it matters
The target user is a payment, e-money or crypto firm. RegWatch's Payments and DORA filters look
nearly empty although relevant news exists, so they miss exactly what the product promises to surface.

## Proposed fix
Extend the `DORA` and `Payments` keyword lists at `regulatory_watch.py:650-657` (third-party risk,
outsourcing, ICT third-party, SEPA, instant payments regulation, fraud, "payments"); after the
theme match, strip the " - Outlet" suffix before the title-only dedup id so syndicated copies collapse.
Do not hand-edit `items.json`; the pipeline regenerates it.

## How to verify
Re-run the classification over the current archive: `General` falls below 120 items, `Payments`
plus `DORA` rises above 40, and title-duplicate groups drop under 10.
