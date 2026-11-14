# Work streams (how the agents and the owner work together)

Read this first. It tells every scheduled agent which stream it serves, which
files it owns, and the rules every pull request follows. The owner reads on a
phone and decides; agents propose, build slices and never merge.

## Streams
| Stream | Goal | Owns (may edit) |
|---|---|---|
| **MAX** | The central tool: law, obligation, control, owner, status, review, dashboard and Kanban. Verified obligations grow from 12 toward the full AMLR, then TFR, DORA, MiCA. | `docs/workspace.html`, `controls*`, `obligations*`, `home*`, `board*`, `rr-core.js`, `actions*`, `policies*`, `cases*`, `risk-assessment*`, `customer-risk*`, `impact*`, `docs/data/obligations.json`, `docs/data/controls.json`, `docs/data/spine/`, `build_obligations.py`, `scaffold_obligations.py` |
| **ACADEMY** | One complete AMLR learning path: topic by topic, each topic mixing film, questions, games and the law text. | `docs/academy*`, `docs/data/academy/`, `academy/`, `desk.html`, `laundromat.html`, `ownership.html`, `workstation.html`, `glossary*`, film pages |
| **SYSTEM** (lead only) | Shared design system and navigation, matching the landing page. | `docs/rr-ui.css`, `docs/site-nav.js`, page shells |
| **CHECK** | Independent legal fact-check of every content PR. Never builds. | read-only, writes review comments and `academy/reviews/`, `findings/` |
| **INTEGRATE** | Keeps `main` mergeable, resolves conflicts, reports. | merge branches only |

Two stream builders never touch the same file in the same week. If a change
needs a file you do not own, write it as a follow-up in the PR.

## Rules for every pull request
1. Branch `max/<topic>` or `academy/<topic>`; open a PR against `main`; never
   push to `main`; never merge, including your own PR.
2. One topic, about 500 changed lines at most; ship the first usable slice.
3. Facts only from `docs/data/laws/` (verbatim, checked by script) or named
   official guidance cited as further reading. Never invent claims, numbers,
   customers or prices. Every new obligation passes the build assertions.
4. Videos and teaching content follow `academy/SCRIPT_REVIEW.md`: script and
   claim ledger first, independent check, owner approval, then build.
5. Keep the smoke ratchet green (`tests/`), no console errors, no new axe
   serious/critical, text >= 12 px, contrast 4.5:1 in light and dark.
6. Do not edit `.github/`, `tests/guard.py`, `tests/smoke.mjs`, `STRATEGY.md`.
7. Update the stream log: append one dated line to `strategy/LOG.md`.

## Decision card (put it at the top of every PR description)
Write it as if briefing the CEO on a phone, no jargon without a line of
explanation:
- **Decision needed:** one sentence, or "none".
- **Context:** 3 lines.
- **Options:** A, B, C, each with one line of upside and downside.
- **My recommendation** and what happens if there is no answer by a date.
The owner answers by commenting "A", "B" or "C" on the PR (or in the morning
digest); the next run reads the answer and acts.

## Target structure of the site (for page shells)
- **Max** (menu): Briefing, Work board, Register (obligations), Controls,
  Policies, Risk, Cases, Issues and actions, Change impact, Ask the law.
- **Academy**: one page, "AMLR path": topics in order; each topic is one flow
  (Watch, Questions, Spot it, Decide, Read the law). Practice rooms are inside
  the path, not separate pages. Evidence (certificate, register) sits at the end.
- **RegWatch**, **Country risk**, **Read the law**.
- Landing page style everywhere (see `docs/index.html`, `docs/rr-ui.css` once it
  exists on `main`; until then do content and logic, not page styling).

## AMLR path: topics to cover (Regulation (EU) 2024/1624)
1. Why AML exists and the EU framework (AMLR, AMLD6, AMLA).
2. Who is covered (obliged entities, financial institutions, CASPs).
3. Internal policies, risk assessment and controls (Chapter II).
4. Customer due diligence: when, what, simplified and enhanced (Chapter III).
5. PEPs and high-risk situations.
6. Beneficial ownership (Chapter IV).
7. Reporting suspicions, tipping off, the FIU (Chapter V).
8. Sharing information, data protection and record keeping (Chapters VI, VII).
9. Crypto-assets, anonymous instruments and cash (Chapter VIII and related).
10. Sanctions context (targeted financial sanctions are outside the AMLR: say so).
Each topic: a 45 to 60 s film (script gate), 4 questions, one Spot it game, one
Decide scenario, the law excerpt, related obligations in Max.

## Priority queue (owner, 2026-11-14)
MAX builder, in this order after the register growth already under way:
1. **Gap assessment view** (law, obligation, control, evidence): a very visual
   view over the data layer, not a table first. Idea: a coverage map by topic
   (treemap or radial) where each block is an obligation group coloured by gap
   status (covered and tested, covered untested, partly covered, not covered,
   not applicable); click a block to see its obligations, mapped controls,
   owner, last test and the gap; a matrix view (obligations by controls) and a
   list view; filters by topic, owner, firm type; a 'what to do next' list per
   gap that can create actions in the tracker; snapshot dated assessments that
   can be compared over time; export to Excel (a real .xlsx written in the
   browser without libraries) and print. Status definitions are configurable
   (see finding F-004: 'covered' should mean owned and tested). Later the same
   view compares a policy document against the law and guidance (AI mapping).
2. Topic view (see branch max/topics-view) integration with the gap view.
3. Everything else in the MAX list.
ACADEMY builder: the programme and path rebuild (branch academy/path-v2) and the
films 02 to 04 (branch academy/films-02-04) are in progress; do not duplicate
them; continue with topics and scripts after they are merged.
Public tools (no data layer, no client data) to build as small pages once
the above is underway: UBO calculator (Art. 52 to 54, runs in the browser),
regulatory deadlines calendar (from docs/data/sources/deadlines.json, with .ics
export), applicability checker ('which laws apply to my firm').
