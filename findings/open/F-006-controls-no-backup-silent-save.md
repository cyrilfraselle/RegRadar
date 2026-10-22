---
id: F-006
title: Control edits, mappings and test evidence are lost silently and cannot be backed up
area: compliance
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/controls-data.js
  - docs/workspace.html
found: 2026-10-22
fixed_by:
---

## Evidence
`docs/controls-data.js:21` `saveLocal()` is `try { localStorage.setItem(...) } catch (e) {}`: a blocked
or full store drops every control edit, obligation-to-control link and test-log entry (key
`regradar-controls-mine`) without any message. The only export in `workspace.html` is the coverage
CSV (`csv()`, line 414, file `regradar_coverage_report.csv`), which contains no test log, no
control owner edits and cannot be re-imported. By contrast the sibling tools warn and back up:
`cases.js:80` toasts on a failed save, `policies.js:787-788` has "Download a backup (JSON)" and
"Restore", `customer-risk.js:894` has model export/import, `risk-assessment.js:121` toasts.
Measured: `grep -n -i "backup\|restore" docs/workspace.html docs/controls-data.js` returns nothing.

## Why it matters
Test records are the evidence an MLRO shows an inspector (VISION principle 2). They live only in one
browser profile, vanish when site data is cleared, and the user is never told, unlike in every other tool.

## Proposed fix
1. `saveLocal()` returns false on failure and the caller shows a toast "Could not save: browser storage
   is blocked or full. Download a backup."
2. Add "Download controls backup (JSON)" and "Restore from backup" (validate shape: `extra`,
   `extraMappings`, `removedMappings`, `overrides`, `tests`) to the workspace data/settings area, with
   a one-line note that data is device-local. Reuse the pattern in `policies.js:787-800`.

## How to verify
In a browser with storage blocked, saving a control test shows the toast. Add a test, download the
backup, clear site data, restore: the test and mapping reappear and the coverage ring is unchanged.
