---
id: F-030
title: Ask the law says "Found 8 articles in 9 instruments" when it only means 9 were searched
area: shared
severity: P3
risk: low
status: fixed
effort: S
files:
  - docs/ask.html
found: 2026-11-12
fixed_by: fix/F-030-ask-status-count
---

## Evidence
`docs/ask.html:319`: `'Found '+r.hits.length+' articles in '+SCOPE.filter(c=>ix.laws[c]).length+' instruments.'`. The number
is the count of loaded instruments in scope, not instruments that produced a hit. Measured with Playwright on
2026-11-12: question "When must CDD be applied to an occasional transaction?" returns 8 articles that are all AMLR
(Arts 19, 20, 22, 23, 25, 28, 29, 33) and the status still reads "in 9 instruments". Four different questions all
printed "Found 8 articles in 9 instruments."

## Why it matters
It reads as "the answer spans 9 laws", which overstates breadth in a tool whose principle is that nothing is
overclaimed. A reader may think PSD2, MiCA and DORA were consulted and found consistent.

## Proposed fix
Count distinct instruments among `r.hits` and word it "Found N articles in M of K instruments searched."

## How to verify
Same question: status shows "8 articles in 1 of 9 instruments searched".
