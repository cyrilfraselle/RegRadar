---
id: F-003
title: extractor.html is an unlinked page with a broken data path and 14 axe violations
area: shared
severity: P3
risk: low
status: open
effort: S
files:
  - docs/extractor.html
  - docs/_legacy/extractor.html
found: 2026-10-19
fixed_by:
---

## Evidence
Smoke report 2026-10-19: extractor.html console 1, requestFailures 1
(`http 404 /data/obligations/index.json`), axe 14 (13 `color-contrast` `#8b9099` on white =
3.2:1, 1 critical `select-name`). `extractor.html:146` fetches `data/obligations/index.json`;
the folder does not exist (obligations live in the single file `data/obligations.json`, 12 entries).
No page, script or markdown file links to extractor.html. It is the oldest tool and predates
the Compliance workspace.

## Why it matters
A page that errors on load and appears in search/crawl or via direct URL makes the product look
broken, and it holds 14 of the 62 axe violations while serving no current workflow.

## Proposed fix
`git mv docs/extractor.html docs/_legacy/extractor.html` (the `_legacy/` folder already exists
and is outside the smoke page list). If the owner wants it kept live instead, fix the path and the `select-name` label.

## How to verify
Smoke no longer lists extractor.html; console error and request failure counts each drop by 1.
