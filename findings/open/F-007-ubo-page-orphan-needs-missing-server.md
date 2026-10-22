---
id: F-007
title: ubo.html is an unlinked 1,953-line page that needs a server (ubo_app.py) that is not in the repo
area: shared
severity: P3
risk: low
status: open
effort: S
files:
  - docs/ubo.html
  - docs/_legacy/ubo.html
found: 2026-10-22
fixed_by:
---

## Evidence
Smoke report 2026-10-22: ubo.html console 1, requestFailures 1 (`http 404 /api/config`); it is one of
only two pages (with extractor.html, F-003) with errors, so `tests/baseline.json` cannot reach zero
console errors. F-002 gated the probe on `location.hostname` (`ubo.html:1635`) but smoke serves
from `127.0.0.1`, so the probe still fires. The page calls `api/config` and `api/extract`
(`ubo.html:1637`) from a local server named `ubo_app.py`; `ls` of the repo and
`grep -rn ubo_app` find no such file. No page or script links to ubo.html (`grep -l ubo.html docs/*`
returns only itself) and `site-nav.js` has no entry.

## Why it matters
A page the nav never reaches, with no backend to run it, is dead weight that blocks the quality
ratchet and would look broken to anyone who finds the URL.

## Proposed fix
`git mv docs/ubo.html docs/_legacy/ubo.html` (as proposed for extractor.html in F-003). If the
owner still wants UBO extraction, it belongs in the backend decision, not as a static page.

## How to verify
`cd tests && node smoke.mjs`: ubo.html no longer listed; total console errors and request failures
each drop by 1 compared with 2026-10-22.
