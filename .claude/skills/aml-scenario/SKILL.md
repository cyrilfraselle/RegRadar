---
name: aml-scenario
description: Author or validate a new AML training case for RegRadar Academy (Ownership structures, Desk alerts, or Onboarding files) — enforces schema, one-trap-per-case, real AMLR citations, difficulty placement, and a mandatory blind playtest before anything is considered done.
---

# Writing an AML training scenario for RegRadar Academy

This skill is a checklist and format enforcer, not a source of AML domain
truth. It makes sure a new case fits the product's existing conventions and
gets verified before it ships. It does **not** replace a human (or a fresh
review pass) checking the scenario's legal and factual accuracy — treat that
review as a required step, not optional polish.

## Before you write anything

Identify which module the case belongs to — the schema is different for
each, and content must conform to whichever one it targets rather than
inventing a new shape:

- **Ownership structures** → `docs/data/academy/ownership.json`, rendered by
  the workstation's Case Workbench (`renderActiveCase`/`INV` in
  `docs/workstation.html`) and by the classic `docs/ownership.html`.
- **Desk alerts / investigations** → `docs/data/academy/casebook.json`,
  rendered by `DK` in `docs/workstation.html` and by `docs/desk.html` /
  `docs/casefile.html`.
- **Onboarding queue** → `docs/data/academy/onboarding.json`, rendered by
  `DK`'s onboarding day type.

## The five rules

1. **One named typology, one hard trap per case.** Every case earns its
   difficulty from a single identifiable trap — a fact structure that makes
   the wrong answer *tempting*, not just wrong. Example: OWN-01's Bram sits
   at exactly 80%×30%=24%, one point under the 25% threshold — the trap is
   the temptation to round up. Stacking two or three traps in one case makes
   it confusing rather than harder. If you have two good traps, that's two
   cases.

2. **Schema conformance over freelancing.** Match the existing field shape
   exactly (see reference below). A renderer that has to special-case one
   scenario is a maintenance liability the next person inherits.

3. **Cite a real AMLR article, not a plausible-sounding one.** This is a
   compliance-training product — a fabricated citation is a trust problem,
   not a typo. Use the article numbers already established in the corpus
   where the topic matches (e.g. Art. 22 for beneficial-owner identification
   thresholds, Art. 25/26 for purpose-of-relationship and ongoing
   monitoring, Art. 51/52 for beneficial-owner identification in layered
   structures) and verify any new citation against the actual regulation
   text before shipping — don't rely on a confident-sounding guess.

4. **Place it deliberately on the difficulty curve.** Within a track, cases
   should get harder — more entities, more jurisdictions, thinner evidence,
   subtler traps. Check where the new case's trap-density actually sits
   against its neighbors (e.g. `tier`/`tier_name` in `ownership.json`,
   `difficulty`/`depth` in `casebook.json`/`onboarding.json`) rather than
   appending it at the end by default.

5. **Playtest it blind before calling it done.** Pick the answer that looks
   obviously correct on a first read and check it against the case's
   `answer`/`decision`/`best_action` field. Then check that picking *every*
   plausible wrong answer produces a coherent, specific "why you're wrong"
   — via `why`/`trap`/`consequences` — not a generic rejection. Every real
   bug found while building the workstation this cycle (Laundromat not
   writing to shared progress, a module mislabeled in its own header, a
   dead-end CTA) was caught this way, not by reading the JSON.

## Schema reference

### Ownership structures (`ownership.json` → `cases[]`)

```json
{
  "id": "OWN-01",
  "tier": 1, "tier_name": "Two tiers",
  "family": "chaine-simple",
  "title": "A holding company and two partners",
  "subject": "Kortrijk Textiles NV · corporate client · 25% threshold",
  "threshold": 25,
  "brief": "One or two sentences setting up what's visible and what's being asked.",
  "budget": 3,
  "entities": [
    {"id": "cible", "name": "Kortrijk Textiles NV", "type": "company", "juris": "BE", "customer": true},
    {"id": "holding", "name": "KT Holding BV", "type": "company", "juris": "NL"},
    {"id": "mina", "name": "Mina Vanhoutte", "type": "person", "juris": "BE"}
  ],
  "edges": [
    {"from": "holding", "to": "cible", "pct": 80, "doc": "d1"},
    {"from": "mina", "to": "holding", "pct": 70, "doc": "d2"}
  ],
  "documents": [
    {"id": "d1", "name": "Shareholder register — Kortrijk Textiles", "body": "..."}
  ],
  "requests": [],
  "answer": {"ubos": ["mina"], "cannot_determine": false},
  "computed": {"mina": 56.0, "bram": 24.0},
  "why": "Mina holds 80% × 70% = 56%... Bram reaches 80% × 30% = 24% — one point short.",
  "trap": "What's tempting to get wrong, and why it's tempting.",
  "law": "AMLR Art. 22 — identification of beneficial owners; indicative threshold of 25% + one share.",
  "lesson": "The one-sentence takeaway, stated plainly."
}
```

Notes:
- `type` is `"company"`, `"person"`, or (for nominee/trust cases) whatever
  the chart-drawing code in `workstation.html` already recognises — check
  `drawChart()` before introducing a new entity type.
- A "cannot determine" case (like OWN-06) sets `answer.ubos: []` and
  `answer.cannot_determine: true` — the correct player move is to select
  nothing and flag it, not to guess.
- `computed` should hold every person's actual resolved percentage, not
  just the UBOs' — it's used to grade near-misses, not just exact matches.

### Desk alerts / investigations (`casebook.json` → `cases[]`)

```json
{
  "id": "A-4471",
  "kind": "alert",
  "depth": "shallow",
  "family": "structuring",
  "rule": "Threshold — cash deposits",
  "title": "Six cash deposits in eleven days",
  "customer": "Retail · Ms L. Peeters · customer since 2011 · low risk",
  "facts": {"Profile": "...", "Expected activity": "...", "Alert amount": "...", "Jurisdictions": "..."},
  "narrative": "What the alert actually shows, in plain prose.",
  "transactions": [["02 Mar", "Cash deposit", "9,600", "Antwerp Centraal"]],
  "on_file": "What's already on record — or explicitly nothing.",
  "is_real_case": true,
  "best_action": "rfi",
  "flags": [{"text": "Amounts consistently below the €10,000 reporting threshold", "present": true}],
  "law": "...",
  "why": "...",
  "consequences": {"close": "...", "rfi": "...", "escalate": "...", "sar": "..."},
  "typologies": ["structuring"],
  "difficulty": 2,
  "sector": "retail"
}
```

`depth: "deep"` cases add:

```json
{
  "actions": [
    {"id": "tx", "name": "Pull 24-month transaction history", "cost": 1, "reveals": "e_tx",
     "hint": "Establish what normal looks like before deciding what abnormal means."}
  ],
  "evidence": {
    "e_tx": {"title": "24 months of history", "weight": "supporting", "body": "..."}
  },
  "decisive": ["e_tx", "e_source"]
}
```

Notes:
- `best_action` is one of `close`/`rfi`/`escalate`/`sar` — the desk's
  scoring (`deskDecide` in `workstation.html`) grades against it, plus
  against `decisive` evidence actually gathered for deep cases.
- `is_real_case: true` means dismissing it without cause is scored as
  `harm` and can resurface later in the journal (`S.harm` in `DK`) — only
  set this when the underlying facts genuinely warrant that consequence.
- `weight: "noise"` evidence should look relevant but not actually move the
  decision — every deep case needs at least one, or "gather everything" is
  always the correct strategy.

### Onboarding (`onboarding.json` → `cases[]`)

```json
{
  "id": "ONB-01",
  "family": "retail-simple",
  "title": "A nurse opening a current account",
  "applicant": "Ms F. Bakayoko · individual · Belgian resident",
  "difficulty": 1,
  "intro": "One or two sentences of framing.",
  "facts": {"Applicant": "...", "Occupation": "...", "Product": "...", "Declared income": "...", "Initial deposit": "..."},
  "documents": [{"n": "Belgian eID", "s": "Verified electronically. Name, DOB and address match."}],
  "screening": "No sanctions match. No PEP match. No adverse media.",
  "decision": "standard",
  "outcomes": {"standard": "...", "edd": "...", "more": "...", "decline": "..."},
  "why": "...",
  "law": "...",
  "lesson": "..."
}
```

`decision` is one of `standard`/`edd`/`more`/`decline` — matches the
choices `onbDecide` in `workstation.html` scores against.

## Authoring checklist

1. Pick the module and confirm the trap is genuinely singular (rule 1).
2. Write the case in the exact schema above — no new top-level fields
   without checking whether the renderer would need updating too.
3. Verify every percentage/threshold computation by hand — ownership math
   in particular is exactly the kind of thing that's easy to get subtly
   wrong while writing prose around it.
4. Verify the law citation against the real AMLR text (rule 3).
5. Place the case's difficulty/tier field relative to its neighbors, not by
   default at the end of the list (rule 4).
6. **Play it blind.** Load the case in the actual page (`ownership.html` /
   `desk.html` / `workstation.html` locally), pick the tempting-wrong
   answer, and confirm the feedback is specific to *this* case's trap, not
   generic boilerplate. Then pick the correct answer and confirm it grades
   as correct.
7. Only then is the case done — not before.
