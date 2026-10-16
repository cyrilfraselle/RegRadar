# Academy audit (before the rebuild)

Scope: `docs/academy.html`, `workstation.html`, `laundromat.html`, `ownership.html`,
`desk.html`, `glossary.html`, `academy-engine.js/css`, `academy-shell.js`, `academy.css`,
`docs/data/academy/`. Checked in a browser at 390 and 1280 px, plus source review.
Not on the site; this file is for the owner and for the next developer session.

## 1. What was confusing

| # | Finding | Where | Effect on a new analyst |
|---|---------|-------|-------------------------|
| 1 | The hub (`academy.html`) was a marketing page: hero, "how it's different", a three-item path, a skill chart. Its main button opened the Workstation, a draggable desktop with four overlapping windows. | academy.html | The first thing a learner meets is the hardest thing in the product. No explanation of AML comes before it. |
| 2 | Nothing teaches a concept before it asks you to use it. The Laundromat is a game about laundering, Ownership starts with four principle cards, the Desk drops you into alerts. There is no place that says what AML, CDD, monitoring, sanctions or an STR are. | all | Learners guess the vocabulary. |
| 3 | The "path" exists in three places with different wording: the hub (Laundromat, Ownership, Desk, Filing, Inspection), the shell tabs (`MODULES` in academy-shell.js, with lock counts) and the Workstation "Training Path" window (same list again). | academy.html, academy-shell.js, workstation.html | Three versions of "what do I do next". |
| 4 | The order was hard-locked: a direct visit to `ownership.html` or `desk.html` showed a gate card telling you to play the Laundromat first, and "complete 2 modules" counted `done > 0` per module. | academy-shell.js | A reviewer or a returning user is blocked from the thing they came for. |
| 5 | "Path" in the shell strip linked to `workstation.html`, and the Laundromat's close button and "Back to the Academy" went there too. | academy-shell.js, laundromat.html | "Back" lands in the desktop simulation, not an overview. |
| 6 | At 390 px the shell stacks the site nav, the Academy strip, the CF Bank title bar, the tab row and a status bar: about 170 px of chrome before content. | academy.css / shell | On a phone a quarter of the screen is frame. |
| 7 | The Workstation is blocked on phones ("built for a bigger screen"). The Academy had no phone-friendly way to learn at all. | workstation.html | Half the audience gets a dead end. |
| 8 | No time guidance. The Laundromat run, a Desk day and an ownership case take very different times and nothing says how long. | all | Cannot plan a 15 or 30 minute slot. |
| 9 | After finishing a case there is no "next step" button. The Desk says what comes next in the journal only. | desk.html, workstation.html | The learner has to decide where to go. |
| 10 | Rank, XP and skills exist (good) but were not visible on the hub, and nothing recorded *what was completed and when*. | shell | Nothing usable as training evidence (AMLR Art. 12 asks for ongoing training programmes). |

## 2. Broken or stubbed

- **"Filing" and "Inspection"** were tabs and path rows labelled "In development" (`MODULES` ids
  `filing`, `inspection`, `file: null`). The Desk end screens and the Workstation said
  "Filing and Inspection come next". The STR content did not exist anywhere. Now: the STR is
  taught in module 8; the stubs are gone; end-of-journal text is honest ("More days are still
  being written"). A hands-on STR drafting simulation and an inspection simulation remain **not
  built** (listed in the hub under "What is not built yet").
- Workstation desktop icon "Transaction Monitoring" is a `data-open="soon"` placeholder.
  Left as is (Workstation internals are out of scope); monitoring is now module 6.
- No console errors, request failures or horizontal overflow on any Academy page at 390/768/1280
  in the existing smoke baseline (all zero). Axe baseline for the Academy pages is zero.
- Small things seen: the docked "RegRadar" link in the shell strip is 24 px high on phones
  (below the 36 px target); the old hub's decorative mock-up used 7 to 10 px text (aria-hidden,
  removed with the page).

## 3. Data accuracy (this one matters)

The Academy cites AMLR article numbers. Checked against `docs/data/laws/32024R1624_EN.json`:

| Said in the cases | What the text actually says | Fixed |
|---|---|---|
| "Art. 69 — occasional transactions above €10,000" | Art. 69 is *Reporting of suspicions*. The occasional-transaction trigger is Art. 19(1)(b) (EUR 10 000) and Art. 19(2) (EUR 1 000 for transfers of funds by credit and financial institutions other than CASPs). | yes |
| "Art. 25 — ongoing monitoring" (5 cases) | Art. 25 is *purpose and intended nature*. Ongoing monitoring is Art. 26. | yes |
| "Art. 22 — beneficial ownership" (many) | Art. 22 is *identification and verification of identity*. Beneficial owners are defined in Arts 51 to 58; Art. 22(2) is the senior-managing-officials fallback. | yes |
| "indicative threshold of 25% + one share" (OWN-01 and the principle card) | Art. 52(1): "25 % or more". No case sits exactly on 25%, so scoring is unchanged. | yes |
| OWN-03: "trustee holds title, not economic interest" (so not a beneficial owner) | Art. 58(1) lists the trustees of an express trust among the beneficial owners. The case models a nominee (fiduciary) company, which is different, but the sentence reads as a general rule. | reworked: settlor, trustee's own beneficial owner and beneficiary now count (Arts 55, 58(1), 58(3)) |
| A-4478: "TFR Art. 14 — missing originator information" | TFR Art. 14 is the information that must *accompany* crypto-asset transfers; detection of missing information is Art. 16. | yes |
| INV-403: "Art. 22 — source of funds for the specific transaction" | Source and destination of funds sit in Art. 25; Art. 34(4)(c) for higher risk. | yes |

Not verifiable from the repo (left, flagged): references to EU Regulations 269/2014 and 2580/2001
(sanctions) are not in `docs/data/laws/`. They are real instruments but unchecked here.

## 4. Duplicated

- **The Desk exists twice.** `desk.html` (about 700 lines of logic) and the `DK` block inside
  `workstation.html` carry the same `DAYS`, `pickAlerts`, verdict and XP rules, onboarding rules
  and end-of-day text. They had already drifted: only the Workstation awarded skill XP, marked
  articles as seen, counted STR filings (`regradar-desk-stats`) and checked badges; only
  `desk.html` wrote the event log (`regradar-events`). Same case, different progress depending on
  which door you used. Now: the shared model lives in `AcademyEngine.Desk`
  (see section 6).
- The Laundromat and Ownership already share `academy-engine.js` for rules; each still has its own
  screen. Acceptable: different skins, one rule set.
- Three "path" views (finding 3) and two progress "dashboards" (Workstation Progression window,
  old hub skill chart). Now one hub.

## 5. Missing

- Concept teaching, motion explainers, risks per topic, the law text next to the practice,
  PEPs, sanctions, STR and transaction monitoring as topics, a DORA/MiCA primer.
- A time-budget picker (it was an open backlog item in NEXT_STEPS.md, C).
- A clear next-step button and per-module progress.
- Training evidence: a record of completions and an export.
- Dark theme on the Academy pages (the simulations are light only; only the hub is themed now).
- Links from training to the Compliance register (which obligations a module trains on).

## 6. Not changed (and why)

- The simulations' internals (Laundromat rules, Ownership solver, Workstation windows, glossary
  tooltips). They work, pass the smoke baseline and keep their progress.
- `docs/site-nav.js` and `docs/index.html` (owner wires navigation). The Academy menu entry
  "Overview: How the training works" should become "Learning path".
- Legacy pages `casefile.html`, `triage.html`, `shift.html`: orphaned from the menu, still in the
  site map, axe baseline 16, 2 and 12. They share `regradar-events`, `regradar-progress` and
  `regradar-cases`. Candidates for retirement; the owner decides.

## 7. localStorage keys (kept; learners keep their progress)

| Key | Owner | Holds |
|---|---|---|
| `regradar-academy-progress` | academy-shell.js | XP, per-module `{done, started}`, user, `migrated` |
| `regradar-skills-progress` | academy-shell.js | nine skill XP counters, badges, streak, daily case, articles seen |
| `regradar-academy` | laundromat.html, academy-engine.js | Laundromat plays, best score, runs |
| `regradar-lb-stats` | academy-engine.js | catches, clean runs (badges) |
| `regradar-ownership` | ownership.html, academy-engine.js | per-case results (`done` map) |
| `regradar-desk` | desk.html, workstation.html | day, `done`, `harm`, `seen`, `tutorialDone` |
| `regradar-desk-stats` | workstation.html | STR filings count (badge) |
| `regradar-tab-stats` | workstation.html | sanctions/news lookups (badges) |
| `regradar-events` | desk.html, laundromat.html, legacy pages | decision log, capped at 2000 |
| `regradar-snd` | laundromat.html, desk.html | sound on/off |
| `meridiaan-wm-v1`, `meridiaan-alex-onboard-v1` | workstation.html | window layout, mentor onboarding |
| `regradar-progress`, `regradar-cases` | legacy pages | migrated once into the shell key, otherwise unused |
| `regradar-theme` | all themed tools | `light` or `dark` |
| **new** `regradar-academy-training` | `AcademyProgress` (academy-engine.js) | learning-path completions: module id, date, score, steps (shape documented in the file) |
| **new** `regradar-ex-static` | academy-explainer.js | learner chose static frames instead of animation |

No existing key changes shape. The shell key only gains a `learn` module entry.
