# Bulk obligation extraction (draft layer)

Status: draft, not reviewed. Owner stream: MAX. Needs legal fact-check by the CHECK stream.

## What it is
`extract_obligations_draft.py` (Python, stdlib only) reads the stored official texts in
`docs/data/laws/<celex>_EN.json` and writes:
- `docs/data/obligations-draft.json`: one record per candidate obligation unit, status `draft`.
- `docs/data/obligations-review-queue.json`: the same ids in promotion order, in batches of 25.

It never reads or writes `docs/data/obligations.json` beyond looking up verified ids, and the draft
layer is never merged into it. Nothing here is shown as verified.

## Method (all rules are in the script header and are deterministic)
1. Per article, split into numbered paragraphs, plain lines and lettered/numbered points.
2. A unit is a sentence with an obligation marker (shall, must, is/are prohibited|required|obliged,
   be required to). If that sentence is a lead-in to a list, the unit is the lead-in plus its points
   (verbatim). If the lead-in has no marker, each point with its own marker is a unit (`-pt<x>`).
3. Carve-outs that are not duties: scope ("shall apply", "shall not apply"), clarifications
   ("shall not prohibit/affect"), deeming rules ("shall be considered", "shall be the natural person"),
   permissions ("shall be permitted/able to"), `may` sentences (no marker).
4. Skipped by rule and counted in `_meta.per_law`: Art. 1 to 3 of the AMLR (subject, definitions, list
   of obliged entities), articles with procedural or final-provision titles (delegation, committee,
   review, entry into force...), rulemaking mandates (AMLA or Commission RTS, ITS, guidelines,
   delegated and implementing acts, designation by the Commission), committee procedure.
5. `binds`: the actor term nearest before the marker, else any actor term in the sentence, else the lead-in
   context, else `unspecified` (`binds_basis` says which). Actors: obliged_entity, member_state,
   supervisor (including self-regulatory bodies), fiu, amla, commission, legal_entity, register,
   law_enforcement.
6. `topics`/`subtopics`: ids from `docs/data/topics.json` where the article is mapped there
   (`topic_source: topics.json`, article-level, so a subtopic tag means "this article is cited
   there", not "this paragraph is"); otherwise a keyword rule on the article title, then the chapter
   (`topic_source: rule`).
7. `applies_to_hint`: entity ids of `applicability.json` only when the unit text names the entity type
   (credit institutions, CASPs, payment service providers, ...). Empty means "not stated in the unit",
   not "applies to all". No guessing from Art. 3.
8. For TFR and AMLD6 only units that bind obliged entities (including payment service providers and
   CASPs) are kept; the rest are counted in `filtered_out_by_binds`.

## Counts (2026-11-14)
| Law | Articles | With units | Draft units | Mandate sentences skipped |
|---|---|---|---|---|
| AMLR (2024/1624) | 90 | 67 | 330 | 50 |
| TFR (2023/1113) | 40 | 23 | 58 | 1 |
| AMLD6 (2024/1640) | 80 | 21 | 29 | 36 |

Queue tiers: 181 units in articles already mapped in topics.json (first), 102 binding obliged
entities elsewhere, 134 binding other actors.

## Limits
- A unit is not always one obligation. Many obligations span paragraphs ("the measures referred to in
  paragraph 1"), and one sentence can hold several duties. Promotion may merge or split units.
- `binds` is `unspecified` for sentences whose subject is a noun phrase ("The measures ...") (about 13 percent).
- Only sentences with a marker are found. Duties phrased with `may only`, `are to`, `has to`, or by a
  noun phrase without a verb marker are missed (see the golden sample, false negative).
- Topic tags are article-level. Applicability hints are literal mentions only.
- Verbatim is guaranteed (checked); correctness of the classification is not. The golden samples are
  labelled by the builder (an AI), not a lawyer.

## Tests
`python3 tests/obligations_draft.test.py` checks: structure and disclaimer, unique stable ids, no collision
with verified ids, verbatim text and article/paragraph/point locators (own code, not the extractor's),
queue completeness and order, determinism, coverage numbers, and precision and recall on a hand-labelled
held-out sample of 40 (seed 123). Two earlier samples (seeds 7 and 99) were used to tune rules and are
reported separately. First held-out attempt before the second round of fixes: precision 0.84.
Held-out result: precision 1.00, recall 1.00 on n=40 (22 positives), which is a small sample: treat as
"no obvious systematic error", not as proof.

## Promotion to verified
1. Take the next batch from the review queue. The CHECK stream reads each unit against the law text and
   decides: promote, merge with neighbours, split, or reject (not a duty).
2. For a promoted unit, MAX adds an entry to the `OBLIGATIONS` list in `scaffold_obligations.py` /
   `build_obligations.py` (id `<LAW>-art<N>`, who, what, deadline, verbatim excerpt, sub-requirements),
   copying the verbatim `text` from the draft record. The build asserts the excerpt is verbatim
   (`assert_verbatim`) and the title matches the law.
3. Run `python3 build_obligations.py`; the record then lives in `docs/data/obligations.json`.
   Mark the queue entry `review: promoted`.
4. Re-running the extractor keeps ids stable as long as the law text is unchanged; if the law JSON
   changes, tests fail and the queue is regenerated.
