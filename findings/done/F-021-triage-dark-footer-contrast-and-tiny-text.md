---
id: F-021
title: Triage page text is 9-11px and its dark-theme footer fails contrast (3.85:1)
area: academy
severity: P2
risk: low
status: fixed
effort: S
files:
  - docs/triage.html
found: 2026-11-05
fixed_by: fix/F-021-triage-contrast
---

## Evidence
- Axe (wcag2a/aa) on `docs/triage.html` with `localStorage regradar-theme=dark`, 1280px: 2 serious `color-contrast` nodes, `footer > span:nth-child(1)`, "insufficient color contrast of 3.85" (foreground #666e78, from `--text-3` in the dark block, `triage.html:22`). The smoke test never sets the dark theme, so the baseline of 0 hides this (see open F-017).
- 17 CSS declarations with `font-size` below 12px in this file, e.g. `.hud .l` 9px (line 76), `.metrics .l` 9.5px (163), `.fl`, `.kv .k`, `.pl`, `.metrics .sub`, `footer` 10px (168), `.opt .oc` 10.5px (121). NEXT_STEPS quality floor: text >= 12px and 4.5:1 in light AND dark.
- Reproduce: serve `docs/`, open `triage.html` with theme dark, run axe; `grep -nE "font-size: ?(9|10|11)(\.5)?px" docs/triage.html`.

## Why it matters
The Academy "Triage" module is a nav-linked training page; small low-contrast uppercase labels (HUD, metrics, footer) are unreadable for low-vision users and on phones.

## Proposed fix
In `docs/triage.html` raise every sub-12px `font-size` to 12px (keep letter-spacing; drop the 9px/9.5px HUD labels to 12px and allow wrapping), and darken dark-theme `--text-3` from `#666E78` to a value with >= 4.5:1 on the dark surface (e.g. `#8D95A0`; check against the actual background). Verify the light theme still passes and no overflow appears at 390px.

## How to verify
Axe in dark theme on `triage.html` returns 0 serious/critical; the grep above returns no declaration below 12px; smoke run shows overflow still `[]` for `triage.html`.
