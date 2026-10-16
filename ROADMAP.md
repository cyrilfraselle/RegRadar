# Roadmap: from modules to a compliance operating system

Status date: 2026-10-16. Read VISION.md first. This is a plan to discuss and
revise with the owner, not a promise.

## What exists

Eight working modules (Compliance workspace, business risk, customer risk,
cases and STR, policies, issues and actions, RegWatch, Country risk) plus the
Academy, all static and device-local, with a green browser-test safety net and
an agent team (developer, auditor, ideation, prototyper). AI core and
regulatory impact are being built.

## The structural problem to solve first

Each module keeps its own device-local data under its own key. That cannot
become "one trail from law to evidence", a Jarvis briefing, a Kanban over all
work, or a connector target. **Before more modules: one entity graph.**

### Foundation F1: the data spine
A shared `docs/rr-core.js`: typed entities (obligation, control, test,
evidence, risk, policy, customer file, alert, case, issue/task, regulatory
item, person, board) with stable ids, typed links between them, an append-only
event log (who/what/when, the future audit trail), schema versions and
migrations, and a storage adapter (localStorage today, a backend later behind
the same interface). Modules are migrated onto it one at a time.

## Phases

### Phase 1: prove the loop, no backend (next ~4 to 6 weeks)
1. **F1 data spine** (above) and migrate controls, actions, policies first.
2. **Home / Jarvis v1** (`home.html`): "Today, this week, next 90 days",
   generated from local data deterministically: due tests, overdue actions,
   reviews due, case clocks, new regulatory items that match the firm, upcoming
   effective dates; role views; dashboards (coverage, risk, workload,
   regulatory pipeline). AI narrative on top when a key is present.
3. **Work board v1:** Kanban and list over issues/actions and all task types;
   swimlanes by owner, due date, linked obligation; WIP and SLA.
4. **Horizon calendar v1:** effective dates, consultation deadlines, AMLA/EBA
   timelines, forward view by firm type, .ics export.
5. **Import wizards ("replace Excel"):** CSV/XLSX in for controls, risks,
   policies, issues, customers; column mapping, validation, dry run.
6. **AI**: Ask the law (in progress), regulatory impact (in progress), then
   drafting with sources and the reviewer.
7. **Get 3 to 5 real compliance reviewers on it** and let their reactions
   steer Phase 2.

### Phase 2: backend and connectivity (1 to 3 months after the decision)
1. Accounts, organisations, roles (1LOD/2LOD/3LOD), audit log, notifications
   and e-mail digests, shared data (decision brief needed).
2. Connector framework: a manifest per connector (auth, scopes, sync, mapping
   to the entity graph), read-only first, with a secrets vault and per-tenant
   isolation.
3. First connectors, chosen with design partners: ticketing and wiki
   (Jira, Confluence), chat (Slack, Teams), identity (Google, Entra, Okta),
   documents (Drive, SharePoint), plus read-only database/warehouse access for
   control evidence (scheduled queries become test evidence).
4. KYC, screening and transaction-monitoring vendor imports.
5. AI through a managed, EU-region proxy with redaction and logging.

### Phase 3: scale and trust
SSO, SOC 2 path, pen test, billing, multi-entity groups, regulator report
exports (for example FIU formats), mobile companion for approvals, connector
marketplace.

## Principles for the plan

- Replace by import, then by doing it better: nobody leaves a spreadsheet
  until the data is already in the new tool.
- Integrate before reinventing where a customer already lives (Jira,
  Confluence), but own the compliance-specific objects and the trail.
- Every screen answers "what do I do next?", not just "what is the status?".
- Verified content and grounded AI stay the moat; everything else is plumbing.

## Owner decisions so far (2026-10-16)

1. **First buyer: a team.** The MLRO or managers dispatch work and need a
   clear overview: dispatch, workload, status per person, what is at risk.
2. **Wedge:** horizon scanning plus the obligation register plus evidence
   tracking, with next-level features (below).
3. **Prototype for free until the first contract, then upgrade.** Design for
   portability (see decisions/002-free-prototype-stack.md).
4. **Tickets: both.** Own board by default, two-way link to Jira-class tools
   for firms that already use them. Everything is configurable by the team
   (fields, workflows, templates, dashboards, thresholds, roles).
5. **Weekly strategy brief** (Friday), logged in strategy/LOG.md.

## Everything configurable ("configuration over code")

Entity types, custom fields, statuses and workflows, task templates, scoring
models, SLAs, dashboards and saved views, roles and permissions, notification
rules, connector mappings: all stored as data per organisation, editable in a
settings area, versioned, with a reset to sensible EU defaults.

## Next-level features (beyond replacing the stack)

Ranked by how much a compliance team would feel them:

1. **Launch readiness check ("what-if").** Describe a new product, market or
   customer segment; the system lists the obligations that apply, the controls
   and policies you lack, the risk-assessment changes and a sign-off checklist.
2. **Evidence autopilot.** Controls collect their own evidence from connected
   systems (database query results, ticket histories, screening run logs),
   dated and hashed, so a test is a click, not a week.
3. **Inspection simulator.** Generates the questions a supervisor would ask
   from your own register, scores how well your files answer them, and builds
   the document binder. Practise before the real one.
4. **Regulatory change redlines.** When a text changes, show the exact diff and
   the controls, policies and customers it touches, with draft updates.
5. **Capacity and workload forecast.** Alerts, reviews and tests coming due
   turned into hours per person per week; flags overload before it becomes a
   breach (the dispatcher's best friend).
6. **QA sampling engine.** Second-line sampling of cases and customer files
   with scoring, trends and coaching notes.
7. **Precedent library.** How did we decide similar cases before? Searchable,
   anonymised decisions with rationale.
8. **Incident clocks.** For operational incidents and reportable events, the
   reporting deadlines and templates start automatically.
9. **Third-party register.** The ICT third-party and outsourcing register with
   due diligence status and concentration view.
10. **Regulator correspondence tracker.** Letters, requests and answers with
    deadlines and owners.
11. **Slack/Teams Jarvis.** Ask "what is overdue for my team?" where people work.
12. **Peer benchmark** (needs customers): anonymised control-coverage benchmarks.

## Decisions that belong to the owner

1. First buyer and size (1-person MLRO at an EMI, a 5 to 20 person team, or a
   bank) which sets UX, pricing and connectors.
2. Backend and hosting (EU data residency), and when.
3. The wedge: which painful workflow we replace first.
4. Which connectors first (needs design partners).
5. AI path (decisions/001-ai-architecture.md).

## Strategy conversations

Standing agenda: what we learned, what the metrics say (metrics/history.jsonl),
what to build next, what to cut, one decision. Notes live in strategy/LOG.md.
