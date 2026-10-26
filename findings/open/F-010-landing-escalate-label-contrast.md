---
id: F-010
title: Landing page "Escalate" label is white on mint (1.63:1) on mobile and with reduced motion
area: landing
severity: P2
risk: low
status: open
effort: S
files:
  - docs/index.html
found: 2026-10-26
fixed_by:
---

## Evidence
`tests/smoke.mjs` (2026-10-26) reports `index.html` axe serious color-contrast x1. Reproduced with axe at 390px, reduced motion: selector `.d2` (the "Escalate" pill in the `.decide` block, `docs/index.html:483`), message "contrast of 1.63 (foreground #f5f7fb, background #3ddca7, 15px bold). Expected 4.5:1".
Cause: for mobile and reduced-motion the script sets the scroll progress to 1 (`docs/index.html:626`, `ap = (reduce || !wide) ? 1 : ...`), so the background at line 266 reaches full mint while the text colour stays `var(--td)` (#F5F7FB). It is the single remaining axe hit on the landing page and is already in `tests/baseline.json` (index.html axe: 1).

## Why it matters
The first page a visitor sees fails contrast for exactly the users (mobile, reduced motion) who get the static state. Fixing it also lowers the ratchet baseline.

## Proposed fix
Make the `.d2` text colour follow the background: use `var(--ink)` (dark) once the mint background is opaque, e.g. add inside the `prefers-reduced-motion` block and the narrow-screen path `.decide .d2{color:var(--ink)}`, or drive colour with the same `--ap` clamp as the background. Check the dark-ink on mint ratio is >= 4.5:1.

## How to verify
`cd tests && node smoke.mjs`: `index.html` axe count 0; ratchet `tests/baseline.json` index.html axe from 1 to 0.
