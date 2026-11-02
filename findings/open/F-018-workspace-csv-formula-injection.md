---
id: F-018
title: Workspace coverage CSV writes user-entered control names without the spreadsheet formula guard every other export has
area: compliance
severity: P2
risk: low
status: open
effort: S
files:
  - docs/workspace.html
found: 2026-11-02
fixed_by:
---

## Evidence
`docs/workspace.html` `csv()` (around line 410) builds `regradar_coverage_report.csv` with
`'"'+String(x).replace(/"/g,'""')+'"'` only. The last column is `cs.map(c=>c.name).join('; ')`, i.e. control
names the user typed (or imported). A control named `=HYPERLINK("http://x","Open")` or `+cmd|...` is written
verbatim, and Excel/Sheets evaluates it when the report is opened.
Every other export already neutralises this (prefix `'` for cells starting `= + - @ TAB CR`):
`actions.js:957`, `cases.js:186`, `customer-risk.js:215`, `risk-assessment.js:762`, `policies-data.js:576`,
`impact.js:544`. Workspace is the only exporter of user-typed text without it. The file also has no UTF-8 BOM
(others prepend U+FEFF), so accented control names open garbled in Excel.

## Why it matters
The coverage report is the file a compliance officer mails to a manager or auditor. A pasted/imported control
name can run a formula on the recipient's machine; this is the product's headline export.

## Proposed fix
In `csv()` add the same guard used in `impact.js:544` (prefix `'` when the cell matches `/^[=+\-@\t\r]/`) and
prepend `'﻿'` to the Blob text with type `text/csv;charset=utf-8`.

## How to verify
In the browser console on workspace.html create a control named `=1+1`, link it to an obligation, export the
CSV: the cell reads `'=1+1`, and opening in a spreadsheet shows text, not 2. `node --check` on the script; smoke
stays at baseline.
