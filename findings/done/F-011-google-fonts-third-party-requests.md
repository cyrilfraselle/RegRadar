---
id: F-011
title: RegWatch and the Analyst workstation load Google Fonts, a third-party request the project forbids
area: shared
severity: P2
risk: low
status: fixed
effort: S
files:
  - docs/regwatch.html
  - docs/workstation.html
found: 2026-10-26
fixed_by:
---

## Evidence
`grep -l "fonts.googleapis\|fonts.gstatic" docs/*.html docs/*.css docs/*.js` returns exactly two files: `docs/regwatch.html:9-11` (Inter, IBM Plex Mono) and `docs/workstation.html:7-9` (IBM Plex Sans/Mono). NEXT_STEPS.md working rule 3 says "no third-party requests (fonts, analytics)". Every other page uses system fonts. Both CSS stacks already have fallbacks (`--sans:'Inter',-apple-system,...` at `regwatch.html:32`, `workstation.html:29`).
The smoke test does not catch it because it only counts failed requests, and the offline runner just fails them silently.

## Why it matters
Each visit sends the visitor's IP and user agent to Google. For an EU compliance product pitched at regulated firms, that is a data-protection talking point against us (and RegWatch is the flagship page), and contradicts "nothing is sent anywhere" claims in the tools.

## Proposed fix
Remove the three `<link>` lines from each page (preconnect x2, stylesheet). Keep the existing fallback stacks. Optionally add `Segoe UI`/`system-ui` ahead of `sans-serif` in the stack. Visually check both pages at 390 and 1280px for layout shifts (the mono column widths in RegWatch's `.row .src`/`.when`).

## How to verify
`grep -c "googleapis\|gstatic" docs/regwatch.html docs/workstation.html` returns 0; smoke still green with no new overflow.
