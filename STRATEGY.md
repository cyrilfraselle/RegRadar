# How RegRadar builds itself

The owner sets direction and makes the decisions only a human should make.
A small team of scheduled agents finds problems, fixes them, proposes
ideas and prototypes the ones the owner approves. Everything flows through
pull requests, and CI decides what an agent may merge by itself.

Goal: become a credible, sellable compliance SaaS for EU payment, e-money
and crypto firms, by compounding quality and verified content every day.

## The loop

```
         +----------------- metrics/history.jsonl, findings/ ----------------+
         v                                                                   |
 AUDITOR (Mon, Thu) --> findings/open/F-NNN-*.md --> DEVELOPER (daily) ------+
   measures + reads          one problem per file       fixes one finding or
   the product               with files + risk          a backlog item
                                                          |
 IDEATION (Mon) --> ideas/NNN.md + mockup --> OWNER taps merge = approve
                                                          |
                                         PROTOTYPER (Tue, Thu) --> docs/labs/<id>/
```

| Role | When | Produces | Merges itself? |
|---|---|---|---|
| Auditor | Mon + Thu | `audit/<date>` PR: new findings, metrics, readiness | yes, if guard + smoke green (paths limited to `findings/`, `metrics/`, `decisions/`, `tests/baseline.json`) |
| Developer | weekdays | `fix/F-NNN-name` PR for one finding, or `auto/<topic>` for a backlog item | fixes: yes only if the finding says `risk: low`, guard + smoke green, <= 300 lines. Backlog items: never, owner taps |
| Ideation | Mon | `idea/NNN-name` PR: idea + SVG mockup | no: owner merge = approval |
| Prototyper | Tue, Thu | `lab/<id>` PR under `docs/labs/<id>/` | yes, if guard green (isolated folder) |

## Gates (what makes autonomy safe)

1. **`guard` check** (`tests/guard.py`, read from `main`): confines each PR
   type to its own paths (see the script). A fix may touch only the files
   its finding declares.
2. **`smoke` check** (`tests/smoke.mjs`): every page at 390/768/1280px;
   console errors, failed requests, overflow and serious/critical axe
   violations may never get worse than `tests/baseline.json` on `main`
   (a ratchet: quality only goes up). New pages must be clean.
3. **Size cap**: fixes are at most 300 changed lines.
4. **Human gates**: ideas (merge = approve), anything with `risk: medium`
   or `high`, backlog features, decisions in `decisions/`, and any change
   to `.github/`, `tests/` (except the baseline) or `STRATEGY.md`.
5. **Honesty rules**: no invented customers, prices, certifications or
   legal claims; legal text verbatim from `docs/data/laws/`.

Recommended GitHub settings (owner): branch protection on `main` requiring
a pull request and the `guard` and `smoke` checks (exempt the data-update
bot), and CODEOWNERS giving the owner `/.github/`, `/tests/`,
`/STRATEGY.md` so agents cannot weaken their own gates.

## Kill switches

Pause any routine at https://claude.ai/code/routines. If an agent misbehaves,
revert its merge commit on GitHub (one tap) and pause that routine.

## Metrics

`metrics/history.jsonl` gets one line per audit: open findings by severity,
axe violations, pages with overflow or console errors, verified obligations,
controls coverage in the demo, readiness score. `metrics/readiness.md` is
the SaaS-readiness scorecard the auditor refreshes monthly.

## SaaS readiness (the honest picture, refreshed monthly in metrics/readiness.md)

| Dimension | Today | Next milestone |
|---|---|---|
| Verified content | 12 AMLR obligations | 100+ across AMLR, AMLD6, DORA, MiCA, PSD2 |
| Accuracy and trust | audited, dates fixed | automated change tracking on obligations |
| Product depth | static, device-local | multi-user workspace with roles |
| Backend, auth, tenancy | none (owner decision pending) | decision brief, then one-tenant pilot |
| Security and compliance of the tool | none | threat model, then pen test before any paid use |
| Integrations | none | Jira/Confluence pull-push, needs a design partner |
| Packaging and billing | none | owner decision |
| Feedback from real users | none | 3-5 compliance reviewers |

## Decisions that stay with the owner

Backend/auth vendor, pricing, design-partner outreach and contact details,
any claim about customers or certifications, merging anything marked
`risk: medium|high`.
