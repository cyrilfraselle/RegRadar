---
id: F-024
title: 13 user-facing pages have no meta description, so shared links and search show nothing
area: shared
severity: P3
risk: low
status: fixed
effort: S
files:
  - docs/actions.html
  - docs/ask.html
  - docs/casefile.html
  - docs/cases.html
  - docs/country-risk.html
  - docs/desk.html
  - docs/glossary.html
  - docs/laundromat.html
  - docs/law.html
  - docs/ownership.html
  - docs/shift.html
  - docs/triage.html
  - docs/workspace.html
found: 2026-11-05
fixed_by: fix/F-024-meta-descriptions
---

## Evidence
`for f in docs/*.html; do grep -q 'name="description"' $f || echo $f; done` lists, besides the three redirect stubs, `workstation.html` (F-023) and the orphans `extractor.html`/`ubo.html` (F-003, F-007), these 13 pages. `customer-risk.html` and `index.html` already have one. The landing page is the only SaaS-facing page with link metadata today.

## Why it matters
Links to the workspace, Ask the law or cases shared with a colleague or a design-partner prospect render with no summary, and search engines invent one.

## Proposed fix
Add one `<meta name="description" content="...">` (max about 155 chars, plain, no claims about customers or certification, mention "prototype, fictional data" where the page uses demo data) after `<title>` in each file.

## How to verify
The shell loop above prints none of the 13 files; smoke stays green.
