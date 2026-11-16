---
id: F-034
title: No upcoming date in the calendar concerns payments, e-money, crypto or DORA, the firms' own regimes
area: data
severity: P1
risk: high
status: needs_owner
effort: S
files:
  - docs/calendar.html
found: 2026-11-16
fixed_by:
---

## Evidence
Classifying the 31 upcoming rows with `RRCal.topicOf` (title-based): aml 25,
sanctions 3, other 3, and **0** payments, crypto, resilience or prudential
rows. The 15 `laws`/`applicability.json` rows for PSD2, EMD2, MiCA, TFR and
DORA are all "enters into force" or "applies" dates already in the past
(2009 to 2025). Jurisdiction filter: all 31 upcoming are EU, 0 Belgian
(the UI admits this). Registers, transition endings and implementing-standard
dates for PSD2/PSD3, MiCA and DORA are not represented at all, although
VISION targets payment, e-money and crypto firms.

## Why it matters
A payment or crypto compliance officer relying on the calendar for horizon
scanning sees an AML-only future and may assume nothing else is pending. The
page's emptiness messages cover Belgium but not these regimes.

## Proposed fix
Needs the owner: decide which regimes' forward dates enter the engine and from
which verified source (law text articles in `docs/data/laws/`, ESA or
Commission publications). Until then add a visible coverage note on the
calendar ("Dates today cover AML/CFT and sanctions only; PSD, MiCA and DORA
forward dates are not tracked yet"). Never add a date without a source link.

## How to verify
Calendar topic filter shows payments/crypto/resilience rows with source
links; or the coverage note is present and `deadlines.json` is unchanged (it is generated; do not edit it).
