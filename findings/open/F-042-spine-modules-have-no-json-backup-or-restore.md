---
id: F-042
title: Board, Briefing and event log keep tasks, owners and the audit trail only in this browser, with no restorable backup
area: shared
severity: P1
risk: medium
status: open
effort: S
files:
  - docs/rr-core.js
  - docs/board.js
  - docs/board.html
found: 2026-11-26
fixed_by:
---

## Evidence
- `docs/rr-core.js` line 894 defines `exportAll()` and line ~900 a copy-to-adapter helper, but `grep -n "exportAll\|importAll" docs/*.js docs/*.html` (2026-11-26) shows no page calls them.
- The only exports on `board.js` (`csvBoard`, `csvLog`, lines 310-326) and `home.js` (`csvAll`, `csvLog`) are CSV. A CSV cannot be re-imported, and the event log's hash chain (`hashOf`, rr-core.js line 442) cannot be rebuilt from it.
- Storage is one localStorage key per table (`regradar-spine-*`, rr-core.js lines 182-190). Clearing site data, a new browser or a private window loses tasks, assignments, links and the whole event log.
- Contrast with Actions, Controls and Impact, which already have a JSON backup and restore (fixed under F-006, F-016, F-025).

## Why it matters
The event log is sold as the dated trail an inspector can read. One browser cleanup erases it and nothing in the UI warns or offers a way back.

## Proposed fix
Add "Download backup (JSON)" using `exportAll()` and "Restore from backup" on the Board page: validate `schema_version`, show counts, confirm before replacing, run `verifyLog()` after restore and report the result. Add the small import function to `rr-core.js`. Same wording pattern as the Actions backup.

## How to verify
Create a task, download the backup, clear `regradar-spine-*` keys, restore: the task, links and event count return and `verifyLog()` reports `ok: true`. A file with a wrong `schema_version` is refused with a message.
