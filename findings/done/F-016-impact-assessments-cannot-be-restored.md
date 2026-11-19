---
id: F-016
title: Change-impact assessments live only in one browser and cannot be restored from a backup
area: compliance
severity: P2
risk: medium
status: fixed
effort: S
files:
  - docs/impact.js
  - docs/impact.html
found: 2026-10-29
fixed_by: fix/F-016-impact-backup
---

## Evidence
`docs/impact.js` stores every assessment in `localStorage['regradar-impact']` (`saveStore`, line 54).
The only exports are a per-item JSON (`case 'json'`, line ~615), a tasks CSV and a printed memo. There is
no import or restore path (no `FileReader` or file input in impact.js/impact.html; `grep -ci restore` = 0),
whereas cases.js, actions.js, policies.js, risk-assessment.js and customer-risk.js each have
backup/restore. Clearing site data or switching device loses the decision, overrides and dates.

## Why it matters
An impact decision (what a regulatory change touches and who decided) is evidence for an inspector;
losing it with a cache clear is a silent failure, and it is inconsistent with the sibling modules.

## Proposed fix
Add "Back up all assessments" (whole STORE as JSON) and "Restore from file" (validate `assessments`
object, confirm before replacing, report count) in the same place as the existing exports, copying the
pattern in `docs/actions.js`.

## How to verify
Create an assessment, back up, clear storage, restore: the list and decisions return. Invalid file shows
an error and changes nothing.
