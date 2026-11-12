---
id: F-028
title: Half of RegWatch "Critical" items are informational publications, and one story is counted three times
area: regwatch
severity: P2
risk: high
status: open
effort: S
files:
  - classification_v3.py
found: 2026-11-12
fixed_by:
---

## Evidence
`docs/data/items.json` on 2026-11-12: 724 items, impact 3 (Critical) = 236 (32.6%), impact 2 = 488, impact 1 = 0.
Of the 236 Critical items, 122 (52%) have `legal_status: informational`, and only 51 are `binding`.
114 of them are `doc_type: publication`. Examples with `impact: 3`: FSMA "Opinion on the payout of a Belgian
supplementary pension"; EBA "consumer factsheet on white-labelled financial products". Cause:
`classify_article()` in `classification_v3.py:561-566` returns 3 for any official-regulator source whose text contains
any `REGULATOR_OUTPUT_SIGNALS` or `REG_IMPACT_SIGNALS` term, with no check of binding status or topic relevance.
Three Nordea fine headlines ("UPDATED", "BREAKING", plain) are three separate Critical items.
Class 1 (Info) is never produced, so the 4-level scale is effectively 2.

## Why it matters
When a third of the feed is "Critical" the badge carries no signal, and alert fatigue hides the AMLA and EBA rules
that matter. Changing a scoring rule changes what users are told is critical, so the owner decides.

## Proposed fix
In `classify_article()` require, for path 1, that `legal_status` is not purely informational (or that a
`REG_IMPACT_SIGNALS` term hits) and demote the rest to 2. Add a near-duplicate collapse on normalised title
(strip UPDATED/BREAKING prefixes). Show before/after counts in the PR; do not edit `items.json` by hand.

## How to verify
After the next pipeline run: Critical share well below 33%, zero Critical items with `legal_status: informational`
unless justified in the PR, no duplicate normalised titles among Critical items.
