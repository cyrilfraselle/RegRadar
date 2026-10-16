# Vision: the compliance operating system

**One place where a compliance officer at an EU payment, e-money or crypto
firm runs the whole function, and walks into an inspection with everything
already linked, dated and evidenced.**

Today compliance teams of 1 to 10 people live in spreadsheets, Confluence,
email and a GRC tool they cannot afford or cannot stand. They answer the
same questions every time: What applies to us? What changed? Are we covered?
Where is the evidence? What is open? What do I tell the board and the
regulator on Friday?

RegRadar answers those questions in one workspace, grounded in the verbatim
law, with everything traceable from the regulation to the control to the
test to the evidence.

## Principles

1. **Grounded.** Every obligation and answer traces to verified legal text.
   Never invented. When unsure, say so.
2. **Evidence-first.** A control without a test, an owner and evidence is a
   gap, and the product says so plainly.
3. **One place.** Fewer tools, shared data, one trail. Risk assessment,
   customer files, cases, policies, actions and reports reference each other.
4. **Opinionated defaults, fully configurable.** Works on day one with sane
   EU defaults; every threshold and weight is the firm's own.
5. **Exportable.** Everything leaves as CSV, print-ready PDF or an audit pack.
6. **Honest about what it is.** Not legal advice, not an audit opinion.

## The suite (epics)

| # | Module | What it does | Status |
|---|---|---|---|
| E0 | Compliance workspace | Obligations, law text, controls, coverage dashboard, test log | built (12 AMLR obligations) |
| E1 | Regulatory change to impact | A RegWatch item becomes: which obligations, controls, policies and tasks are affected, with deadlines | to build |
| E2 | Verified content engine | 100+ obligations across AMLR, AMLD6, TFR, DORA, MiCA, PSD2, with change tracking | in progress (daily) |
| E3 | Business-wide risk assessment (BWRA) | Inherent risk by customer, product, channel and geography, control effectiveness, residual risk heat map, annual refresh, board report | to build |
| E4 | Customer risk assessment (CRA) and onboarding | Configurable scoring model, CDD/EDD checklists per risk tier, review scheduler, decision log | to build |
| E5 | Monitoring, cases and STR/SAR | Alert queue, case file, narrative builder, filing log and deadlines | to build |
| E6 | Policies and procedures | Library, ownership, versions, review cycle, attestations, linked to obligations | to build |
| E7 | Issues and actions | Findings from audits, regulators and tests; remediation tracker; root cause; escalation | to build |
| E8 | Training and awareness | Academy plus assignments, completion and evidence | partly built |
| E9 | Audit and board reporting | Audit pack, inspection readiness binder, MLRO annual report, board dashboard | to build |
| E10 | Governance and multi-user | Roles (1LOD/2LOD/3LOD), approvals, audit trail, notifications | needs the backend decision |
| E11 | Grounded AI copilot | Answers only from the law and the firm's own register, always with citations; drafts policies and STR narratives | needs the backend and model decision |

## How to build it

- Phase A (no backend): each module is a static page with its own
  device-local data layer, shared design tokens and cross-links to the
  obligations and controls. Prove usefulness with real compliance users.
- Phase B: backend and accounts (decision brief in `decisions/`), then
  E10 and a one-tenant pilot.
- Phase C: grounded AI and integrations (Jira, Confluence, screening vendors).

Every epic ships as thin vertical slices: a working page first, then depth.
Each slice must be usable end to end by a compliance officer in under ten
minutes, cite its sources, export something useful, and pass the smoke
ratchet.
