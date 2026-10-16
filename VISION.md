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


## Replace the stack (owner notes, 2026-10-16)

The ambition is not one more tool beside the others. It is to replace the
set of tools a compliance team juggles today: spreadsheets (Excel), GRC
suites (AuditBoard class), ticketing and boards (Jira/Atlassian class, but
built for compliance work), wikis for policies, horizon-scanning services,
training platforms and e-mail chasing.

Four ideas that shape everything:

1. **Jarvis for compliance teams.** The product opens on a briefing, not a
   menu: here is what is up for your team, what changes in the next X months,
   which files need review, what is overdue, what the regulator will ask next.
   Role-aware (MLRO, analyst, board), with outstanding dashboards.
2. **Work management built in.** Kanban boards, tickets, owners, SLAs and
   calendars for compliance work (control tests, reviews, remediation,
   regulatory-change tasks, customer reviews, training), linked to the
   obligations and evidence they serve.
3. **Horizon scanning as a core loop.** New and coming obligations, consultations
   and effective dates, mapped to the firm's own controls, policies and
   customers, with a forward calendar.
4. **Natively connected.** It connects to the tools and databases that banks,
   payment firms and fintechs already run (ticketing and wikis, identity,
   KYC and screening vendors, transaction monitoring, data warehouses,
   documents, chat), pulls evidence automatically and pushes work out.

See ROADMAP.md for the plan, the dependencies and the decisions.

## AI-native, not AI-decorated

AI is how the product thinks, not a chat window bolted on. In compliance an
unverifiable answer is worse than no answer, so these principles are fixed:

1. **Grounded.** The model sees only retrieved passages (verbatim law plus
   the firm's own register) and answers only from them. No passage, no answer.
2. **Verifiable.** Every quote an AI output contains is machine-checked
   against its source text. Unverified quotes are flagged and cannot be
   exported as "checked".
3. **Human decides.** AI drafts, flags and suggests; a person signs. Every AI
   output is labelled, carries its sources and is logged with who accepted it.
4. **Private by design.** Bring-your-own-key first (nothing stored on our
   side), personal data redacted before any model call, no training on user
   data, and a clear notice of what leaves the device.
5. **Model-agnostic.** One provider interface; the model is a setting.
6. **Measured.** Retrieval accuracy and citation faithfulness have golden
   test sets that run in CI; a change that makes them worse does not merge.

Where AI shows up (each is an epic slice, built on the shared `docs/ai.js`):

| Slice | What it does |
|---|---|
| A1 Ask the law | Question in plain language, answer with verified citations; works as pure retrieval with no key |
| A2 Drafting with sources | Policy sections, STR narratives, BWRA scenarios and control descriptions drafted from cited text |
| A3 Regulatory impact | A RegWatch item becomes affected obligations, controls, policies and suggested actions |
| A4 Reviewer | Checks a policy, control or customer file against the obligation text and lists gaps |
| A5 Always-on watch | Agents that monitor regulators and open issues, already running for development |

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
