---
id: F-020
title: RegWatch "Coming up" day counts are frozen at pipeline time and there is no stale-data warning
area: regwatch
severity: P2
risk: low
status: open
effort: S
files:
  - docs/regwatch.html
found: 2026-11-02
fixed_by:
---

## Evidence
`docs/data/meta.json` `timeline[]` stores `days_away` (e.g. 2026-12-31 -> 60, written 2026-11-01T12:36Z).
`docs/regwatch.html` `deadlineRow()` (line ~372) prints `d.days_away` verbatim and uses it for the "soon" (<45)
highlight; it never recomputes from `d.date`. The header only shows "updated 1 Nov, 12:36" (line ~644) with no
age check. Compare `country-risk.html`, which has a stale-feed banner. If the daily pipeline stops the page keeps showing "60 days" forever, and a
deadline that has passed still shows a positive number.

## Why it matters
A deadline countdown that silently freezes is the kind of error a regulator-facing user trusts and gets burned by.

## Proposed fix
Compute days from `d.date` against today's date in the browser (floor, in UTC date terms); hide entries already
past or label them "passed"; if `META.last_updated` is older than 3 days show a visible warning line
"Feed last refreshed N days ago" in the header.

## How to verify
Edit `meta.json` locally to `last_updated` 5 days old: warning shown. A timeline date of yesterday shows
"passed", not a number. Smoke has 0 console errors, axe unchanged.
