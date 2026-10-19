---
id: F-002
title: ubo.html probes a non-existent /api/config on the hosted site and fails contrast (17 axe)
area: shared
severity: P2
risk: low
status: open
effort: S
files:
  - docs/ubo.html
found: 2026-10-19
fixed_by:
---

## Evidence
Smoke report 2026-10-19: ubo.html console 1, requestFailures 1 (`http 404 /api/config`), axe 17
(serious `color-contrast`). `ubo.html:1634` always runs `fetch('api/config')`; the comment at
line 1624 admits it does not exist on the hosted demo. Contrast: dark theme `--text-3: #666E78`
on `#08090B` = 3.85:1 (line 48; `.onb-l`, `.onb-note`, `.docs .dl`, `.bnote`) and the primary
button `#ffffff` on `#4d8dff` = 3.19:1 (`.pri.btn[onclick="pickFile()"]`). The page is also not
linked from any other page or `site-nav.js`.

## Why it matters
Every visitor of the hosted page generates a guaranteed 404 and a console error, and the text in
the onboarding panel is hard to read.

## Proposed fix
1. Only call `fetch('api/config')` when `location.hostname` is `localhost` or `127.0.0.1`;
   otherwise go straight to the browser/Ollama branch.
2. Raise dark `--text-3` to >= 4.5:1 on #08090B (for example `#7D858F`) and darken the primary
   button background so white text reaches 4.5:1.

## How to verify
`cd tests && node smoke.mjs`: ubo.html console 0, http 0, axe 0.
