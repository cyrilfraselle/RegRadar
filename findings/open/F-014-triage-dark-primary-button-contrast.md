---
id: F-014
title: Triage "Start the shift" button fails contrast in dark theme
area: academy
severity: P2
risk: low
status: open
effort: S
files:
  - docs/triage.html
found: 2026-10-29
fixed_by:
---

## Evidence
`docs/triage.html:57` sets `.btn.pri{background:var(--accent);...;color:#fff}`. In dark theme `--accent` is
`#4D8DFF` (line 23), so white text on it is about 3.2:1, below the 4.5:1 required for normal text.
Measured with axe (wcag2aa, 1280px, `localStorage regradar-theme=dark`): `color-contrast` serious x3 on
`#intro > .btns > .pri.btn[onclick="startShift()"]` (same class also on line 321 "Work another shift").
Light theme is clean (smoke report: triage.html axe 0). Other pages use `color:var(--on-accent)` instead.

## Why it matters
The main call to action of the Triage training is hard to read for low-vision users in dark mode, and the
smoke ratchet cannot see it (see F-017).

## Proposed fix
Define `--on-accent` in both theme blocks of triage.html (light `#fff`, dark `#08090B`) and use it in
`.btn.pri` and `.btn.pri:hover` instead of `#fff`.

## How to verify
Run axe with dark theme on triage.html: 0 serious/critical. Light theme unchanged.
