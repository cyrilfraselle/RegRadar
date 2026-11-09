---
id: F-025
title: Issues and actions tracker has no full backup or restore, and its CSV export drops the audit history
area: compliance
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/actions.js
found: 2026-11-09
fixed_by:
---

## Evidence
`docs/actions.js` line 956: `CSV_COLS` lists 20+ columns (id, title, severity, owner, due_on, control_ids,
obligation_ids, risk_accepted_*, actions) but no `history` field, while every issue carries a `history` array
(`log(i, t)` at line 205: opened, action done, submitted, risk accepted, closed and who validated). The only
export paths are `export-issues` and `export-actions` (lines 1245-1246), both CSV. There is no JSON backup and
no restore; `cases.js` (line 944), `risk-assessment.js` (line 915), `customer-risk.js` (line 915) and
`policies.js` (line 983) each have one. Data lives only in localStorage key `regradar-actions`; the
save-failure toast (line 125) says "changes last until you close the page" but offers no way out.

## Why it matters
The tracker's value to an inspector is the trail: who accepted a risk, who validated closure, when. A user who
clears site data, switches browser or exports to "keep a copy" loses that trail, silently, and a CSV re-import
creates issues whose history starts at the import date.

## Proposed fix
Add "Download backup (JSON)" and "Restore from backup" to the existing Import/export dialog (`ioTitle`),
following the pattern in `cases.js`: validate shape (`Array.isArray(d.issues)`), confirm before replacing,
toast on bad file. Mention the backup in the storage-failure toast. Do not change the CSV columns.

## How to verify
Create an issue, close it, download the backup, clear `regradar-actions` in devtools, restore: the issue,
actions and history entries are identical. A non-JSON file gives a toast, no state change. Smoke unchanged.
