# Findings

One file per concrete problem the auditor finds, so the developer agent can
fix them one at a time. Open ones live in `open/`, fixed or dismissed ones
move to `done/`.

- Name: `open/F-NNN-short-name.md` (next free number, never reused).
- Fill `TEMPLATE.md`. Keep it small enough to fix in one PR.
- **`files:` is mandatory and enforced by CI**: a fix may only change the
  files listed there (plus `findings/` and `tests/baseline.json`).
- `risk: low` = accessibility, contrast, copy that overclaims, dead code,
  error handling, broken links, tiny layout fixes. Only these may be
  merged by an agent. `medium` (behaviour or design changes, data logic)
  and `high` (anything touching legal claims, scoring rules, data model)
  always wait for the owner.
- Evidence must be measured (selector, number, URL), not impressions.
- Do not duplicate: search `open/` and `done/` first.
- A fix PR (branch `fix/F-NNN-short-name`) moves the file to `done/` and
  sets `status: fixed` and `fixed_by:`.
