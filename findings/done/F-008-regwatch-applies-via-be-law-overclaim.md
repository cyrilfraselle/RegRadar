---
id: F-008
title: RegWatch badge "Applies · via BE law" asserts a Belgian transposition the product does not hold
area: regwatch
severity: P2
risk: low
status: fixed
effort: S
files:
  - docs/regwatch.html
found: 2026-10-22
fixed_by: fix/F-008-regwatch-via-be-law
---

## Evidence
`docs/regwatch.html:279` `badgeLabel()` returns `'Applies · via BE law'` for every directive whose
verdict is direct. The data folder `docs/data/laws/` holds only EU texts (15 regulations), and
`docs/data/applicability.json` `_meta.disclaimer` says "verify against the instrument and any
Belgian transposition". `applicability.json` only has free-text notes such as "Binds you through Belgian transposition"
and obligations.json says "Extend to AMLD6 (Belgian transposition obligations)" as future work: no
record names a Belgian transposing law or whether it is in force.
The string appears in one place only (`grep -n "via BE" docs/*`).

## Why it matters
A compliance officer reads "Applies · via BE law" as a verified statement about national law. It is
only the EU directive's scope plus an assumption. A wrong or outdated transposition status is a
legal claim the product cannot support.

## Proposed fix
Change the label to "Applies · check national transposition" (and keep the existing disclaimer
visible next to the badge). Do not name a country.

## How to verify
`grep -n "via BE" docs/regwatch.html` returns nothing; the directive badge in the profile view shows
the new wording; smoke stays at 0 errors for regwatch.html.
