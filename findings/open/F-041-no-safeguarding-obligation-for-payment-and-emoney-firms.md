---
id: F-041
title: Safeguarding of client funds (PSD2 Art. 10, EMD2 Art. 7) is claimed as applicable but has no obligation and no control
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/data/obligations.json
  - build_obligations.py
  - docs/data/controls.json
found: 2026-11-26
fixed_by:
---

## Evidence
- `docs/data/applicability.json` (EMD2 entry, ~line 232): `"emi": "direct"`, `"why": "Issuance and redeemability of electronic money, and safeguarding of funds."` So the product itself tells an e-money firm that safeguarding applies.
- `docs/data/obligations.json`: 21 obligations, all `AMLR-art*` (counted 2026-11-26). A search for "safeguard" in `obligations.json` and `controls.json` returns 0 hits.
- The verbatim text is already parsed: `docs/data/laws/32009L0110_EN.json` article 7 "Safeguarding requirements" and `docs/data/laws/32015L2366_EN.json` article 10 "Safeguarding requirements" (confirmed present, titles read 2026-11-26).
- `docs/ai.js` line 141 routes the word "safeguard" to a retrieval query, so Ask the law can find the text while the register and coverage view cannot.
- Related but different: F-019 (DORA/MiCA/PSD2 in general, owner-gated), F-013 (TFR), F-037 (instant payments). None names safeguarding.

## Why it matters
Safeguarding of customer money is the first thing a payment or e-money supervisor inspects and the main prudential duty of those firms. A compliance officer at such a firm sees a coverage score that never mentions it.

## Proposed fix
Add AMLR-style entries for PSD2 Art. 10 and EMD2 Art. 7 in `build_obligations.py` (assert titles against the parsed law, verbatim excerpt only, `who` limited to PI/EMI per `applicability.json`, status `in_force`, deadline null with a source). Add one library control "Daily safeguarding reconciliation and segregation check" mapped to both, labelled demo data. Needs owner sign-off on scope (legal claims, risk high), decided together with F-019.

## How to verify
`python3 build_obligations.py` passes its assertions; `obligations.json` count rises by 2 and each `verbatim` is a substring of the parsed article; Workspace shows both for an EMI/PI profile and none for a CASP-only profile.
