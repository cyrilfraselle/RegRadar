# Build notes · films 02 to 04

Build of the signed-off scripts v2 (`SIGNOFF.md`, approved 2026-11-12), branch
`academy/films-02-04`, 2026-11-14.

## What was built

- `docs/academy-film-engine.js` + `docs/academy-film.css`: one engine for films 02 onwards, driven
  by a data file per film in `docs/data/academy/films/<id>.json` (format: `README.md`, "Proposal").
  The renderer, easing, comet, kinetic type, grain, camera maths, sounds and player come from
  film 01. Film 01 (`docs/film-follow-the-money.html`) keeps its own inline engine, unchanged:
  porting it is the later "engine is complete" test the README describes, and leaving it alone
  means it cannot regress.
- `docs/film-effort-follows-risk.html`, `docs/film-know-who-know-why.html`,
  `docs/film-look-through.html`.
- `academy/films/src/<id>.mjs`: authoring helpers that write the JSON (the JSON ships; the
  helpers keep positions and timings readable). Run `node academy/films/src/<id>.mjs`.
- `tests/films.test.mjs`: gate step 6, automatic. Every caption must equal the script's final
  caption and the signed-off caption (same timecodes) and be made only of ledger wording; every
  other string the engine can show must be in a ledger row. Fails otherwise.

## Wording

No wording problem was found that needed a change of meaning. Every caption, canvas string and
still caption is the approved wording (checked by `tests/films.test.mjs`: 296 strings). Points
for the reviewer, none of which adds a claim:

1. **Chapter names** (`Hook`, `Four habits` ...) come from each script's brief ("Chapters" row),
   not from a ledger row. They carry no claim.
2. **Glyph `?`** (film 03 on the beneficial owner block, film 04 on the fogged owner) is not in the
   on-canvas index. It is decoration (no letters); the test treats strings with no letters or
   digits as decoration.
3. **Names used on their own** (`Mira`, `Jonas`, `Elif`, `Tom`, `Victor` under markers, meter bars
   and portraits; `Mira` in the register extract) come from film 04's fictional row 26, used item
   by item. No percentage appears on its own: every number on canvas is inside an indexed string
   (`Mira · 30 %`, `45 % × 40 % = 18 %` ...).
4. **Reused strings**: film 04's dashed 25 % line is labelled with the headline `25 % or more.`;
   `BENEFICIAL OWNER` appears on the meter bar and beside the marker (both indexed for Mira and
   Jonas).
5. **Film 03 dial**: the storyboard says "the dial from film 02", but film 03's index has only
   `this example`. The ends are left unlabelled (colour only) rather than adding film 02's labels.
6. **Film 02 dial needles** have no labels (the index has none); the customer cards say who is who.
7. **Page text outside the film** (intro paragraph, fine print for films 02 and 03, the canvas
   description for screen readers) is written from each brief and caption wording; film 04's fine
   print is the brief's text verbatim. These are not scene data, so the test does not cover them.
   Worth a read by CHECK.

## Layout departures from the storyboards (no wording change)

- Film 04, S4: the three products and the sum type on in a calculation panel beside the chart
  (and the Kappa line types on the Kappa card) instead of beside each path; beside the paths they
  collided with the edge labels. Camera z 0.8 instead of 1.3 so the meter stays in frame.
- Film 03, S2: the `e.g. EUR 1 000 ...` footnote sits inside tile 2.
- Film 02, S2: the KNOW / WATCH / REPORT / KEEP cards draw the first word large; each card's
  string is the indexed one (`KNOW the customer` ...).
- Stills are sampled a fraction after the script time when a line is still typing (for example
  0:24.5 for "Your own risks"); the time shown is the script's.

## Gate step 2 note

`SCRIPT_REVIEW.md` says the ledger moves next to the film as `FACTCHECK.md`. The ledgers stay in
`<id>.script.md` (the test reads them there) to avoid two copies drifting apart.

## Not verified

- Sound was checked for errors only (WebAudio, off by default), not listened to.
- Legal fact-check of the built films (gate step 6 by an independent reviewer) is pending.
