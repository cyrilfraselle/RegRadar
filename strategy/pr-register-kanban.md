# Register board: obligations as a Kanban (max/register-kanban)

## Decision card
- **Decision needed:** None to merge. One small choice: keep the board at its own page `register.html`, or later make it the default view of the existing Register entry.
- **Context:** The owner asked for a simple, phone-first board of the obligations. Each card is one verified obligation. Columns show how the firm handles it: Not assessed, Applicable, Owned, Controlled and tested, Not applicable. "Controlled and tested" fills itself from the controls (approved, owner, recorded test), exactly like the gap assessment.
- **Options:** A) keep as a separate menu entry "Register board" (now; nothing else changes). B) replace the Register menu target (workspace.html) with this page once the owner likes it. C) merge the list view into workspace.html later.
- **My recommendation:** A now, B after a week of use. No answer needed: A stays.

## What it does
- `docs/register.html`, `register.js`, `register.css`: board (default) and list. Cards show title, article and topic, applies-to, priority, owner, number of mapped controls. Filters: topic, applies-to, priority, owner.
- Move a card by dragging the handle (touch) or the card (mouse), or with the "Move to" menu on each card. Moving to Owned asks for an owner. Controlled and tested cannot be set by hand: it needs a control (the message says so).
- Card opens a detail with the verbatim excerpt from `obligations.json`, link to the article, owner edit, controls and linked issues. No legal text is written or changed.
- Saved through `rr-core.js`: one spine setting per obligation (`register.status.<id>`), so each move is an event in the append-only log. Same adapter as the other pages (localStorage, memory fallback).
- Gap view stays consistent: shared logic moved to `docs/gap-logic.js` (no fork); `gaps.js` now also treats a register "Not applicable" as not applicable. `gaps.html` loads two extra scripts.
- Menu: one line in `docs/site-nav.js` (plus `register.html` in its page-group map so Max stays highlighted; system-owned file, please check).
- Counts are read from `docs/data/obligations.json` at load; nothing hardcoded (PR #62 will add obligations automatically).

## Tests
- `tests/register.test.mjs` (14): columns vs gap logic, grouping, filters, allowed and refused moves, event log, persistence (memory and localStorage), gap view consistency. Added to `.github/workflows/smoke.yml` (rule 6 normally forbids editing `.github/`: two lines, flagged for the lead).
- Existing: spine 38/38, topics, regwatch, calendar, films, academy checks run.
- Browser check on a phone-width pane: no console errors, move menu, drag from handle, owner dialog, detail, gap view shows the moved card as Not applicable.

## Not verified
- Real finger drag on a physical phone; desktop wide layout visually; dark theme contrast and axe (smoke job will tell); Playwright smoke not run locally.
