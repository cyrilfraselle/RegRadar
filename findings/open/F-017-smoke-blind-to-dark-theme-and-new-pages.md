---
id: F-017
title: Smoke ratchet never tests dark theme; ask.html and impact.html are not in the baseline
area: shared
severity: P2
risk: medium
status: open
effort: S
files:
  - tests/smoke.mjs
found: 2026-10-29
fixed_by:
---

## Evidence
`tests/smoke.mjs` loads every page once per width with default (light) colour scheme and no stored theme.
An ad-hoc dark run (same axe tags, `colorScheme: dark`, `regradar-theme=dark`, 1280px) found serious
contrast failures the ratchet cannot see: triage.html 3 nodes (F-014) and extractor.html 12 nodes
(`.logo-sub`). Also `tests/out/report.json` lists `ask.html` and `impact.html` but `tests/baseline.json`
has no entry for them, so a regression there is only caught by the "new pages must be clean" rule once.

## Why it matters
Half the audience uses dark mode; accessibility regressions there merge unnoticed, and NEXT_STEPS.md
already lists "extend smoke to dark theme" as remaining.

## Proposed fix
Run axe a second time at 1280px with dark scheme and the theme key set, store the count as `axeDark` per
page, compare against baseline like `axe` (missing baseline key = must be 0). Owner then lets the
auditor write the baseline.

## How to verify
`node smoke.mjs` reports `axeDark` per page; reverting F-014 makes it fail on triage.html.
