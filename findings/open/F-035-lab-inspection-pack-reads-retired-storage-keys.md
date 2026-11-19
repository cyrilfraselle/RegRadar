---
id: F-035
title: Inspection-pack lab reads retired storage keys, so it never sees controls, policies or actions people actually enter
area: compliance
severity: P2
risk: medium
status: open
effort: S
files:
  - docs/labs/001-inspection-pack/pack.js
found: 2026-11-19
fixed_by:
---

## Evidence
`docs/labs/001-inspection-pack/pack.js` SECTIONS read `regradar-controls-mine`,
`regradar-policies` and `regradar-actions`. `docs/rr-core.js` (MIGRATED, lines
~260-264) and `docs/controls-data.js:15` state these three modules moved onto the
spine and the old keys are "no longer written". Reproduced with Playwright
(server on `docs/`): open `actions.html`, `policies.html`, `workspace.html?view=controls`
(localStorage then holds only `regradar-spine-entities` 147 KB, `-links`, `-events`,
`-meta`), then open `labs/001-inspection-pack/index.html`. Result: `#srcNote` =
"Nothing found on this device yet, so demo data is shown." The pack falls back
to fictional demo data although the device holds real entries. Same for
Staff training if the key differs from the bridge key `regradar-academy-training`
(rr-core.js line 258 vs pack.js `regradar-academy-progress`; check which one the
Academy writes).

## Why it matters
The idea's whole promise is "what is missing before the supervisor asks".
A reader who has used the modules is told there is nothing, or is shown demo
numbers, so the pack is wrong in exactly the situation it exists for.

## Proposed fix
Read the spine (`regradar-spine-entities`, filter by entity type: policy, issue,
control, as defined in `docs/data/spine/config.json` `entity_types`) for those
three sections, falling back to the old keys only when the spine has none.
Keep the read-only rule (never write) and the "No data" state.

## How to verify
Repeat the reproduction above: the pack shows "Reading this device only", and
Policies, Issues and Controls rows show counts matching the module pages.
