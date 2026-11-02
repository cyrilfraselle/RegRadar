---
id: F-019
title: Every verified obligation applies from 10 Jul 2027, so DORA, MiCA and PSD2 duties already in force are absent from the register
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/obligations.json
  - build_obligations.py
found: 2026-11-02
fixed_by:
---

## Evidence
`docs/data/obligations.json`: 12 obligations, all `AMLR Art. 19..69`, all `deadline: 2027-07-10`,
all `status: scheduled` (counted with a script on 2026-11-02). Zero entries for DORA, MiCA or PSD2.
The full texts are already parsed and available: `docs/data/laws/32022R2554_EN.json` (64 articles; Art. 64 says
"It shall apply from 17 January 2025"), `32023R1114_EN.json` (149 articles), `32015L2366_EN.json`.
`docs/data/applicability.json` marks these as applying to payment/e-money/crypto entities, so Workspace
tells such a firm what applies, then lists nothing for them. (F-013 covers the Transfer of Funds Regulation
only; F-015 covers missing AMLR articles.) Check for DORA in `findings/` shows only F-009 (RegWatch
classification), not the register.

## Why it matters
A compliance officer opening Workspace in Nov 2026 sees 12 "scheduled" duties and a coverage % that says
nothing about the regimes the regulator inspects today (ICT risk framework Art. 6, major incident reporting
Art. 19, third-party register/contract rules Art. 28-30). It reads as a complete picture; it is not.

## Proposed fix
Owner decision first (legal content, `risk: high`). Then add a first DORA slice of 5-6 obligations (Art. 6, 17,
19, 28, 30 + register of information), hand-authored judgment fields, each `verbatim` asserted against the law
JSON by `build_obligations.py`, `deadline: 2025-01-17`, `status: in_force`. Update `_meta` counts. Make the
workspace header say which regimes are covered (already scoped per F-005).

## How to verify
`python build_obligations.py` passes its verbatim assertions; Workspace lists DORA obligations with state
"in force"; smoke stays at baseline.
