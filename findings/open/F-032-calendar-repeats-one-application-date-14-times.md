---
id: F-032
title: Calendar lists the AMLR application date as 14 separate rows (one per article), burying real events
area: regwatch
severity: P2
risk: low
status: open
effort: S
files:
  - docs/calendar.js
found: 2026-11-16
fixed_by:
---

## Evidence
Of 31 upcoming rows, 20 fall on 2027-07-10. Of those, 12 have
`source: "obligations.json"` (ids `AMLR-art19` ... `AMLR-art34`, titles like
"AMLR Art. 19 applies") and 2 are `applicability.json` ("AMLR applies",
"AMLD6 applies"): 14 rows say the same thing (the regulation applies from
10 Jul 2027). Counted with `RRCal.normalise` on `deadlines.json`. A reader
scrolling the month list sees the same date repeated and has to hunt for the
distinct AMLA standards and the OJ implementing regulation on the same day.

## Why it matters
Noise hides signal; the count in the header ("21 dates") overstates how many
distinct things are due, and an .ics export for all shown adds 14 duplicate
calendar events.

## Proposed fix
In `normalise`, fold rows with `source` `obligations.json` into one row per
(date, law): keep the law-level `applicability.json` row and drop the
per-article rows, or merge them into a single row "AMLR: 12 articles in the
register apply" listing the article ids in the `method` text. Do not change
`deadlines.json` (generated).

## How to verify
Upcoming count drops from 31 to 19 or fewer; no two rows share date and law
title; `node tests/calendar.test.mjs` passes (adjust its expected counts only
if they hard-code 95/31).
