# RegRadar Compliance Dashboard — architecture requirements

Status: draft, written 2026-09-29 alongside the static demo on
`feat/compliance-dashboard-demo`. Not yet built beyond that demo.
Backend direction (Supabase) to be confirmed.

## 1. Product scope

**Target segment first: PSPs, EMIs, CASPs — not classic banks.** Banks
already run AuditBoard/ServiceNow GRC/Archer with dedicated GRC teams
and Big 4 advisors; displacing that is slow and expensive. PSPs, EMIs
and CASPs are underserved (often 1-3 person compliance teams), have no
legacy GRC contract, and buy faster. Keep the product multi-entity
(bank/PI/EMI/CASP/investment firm/fund/insurer, per
`docs/data/applicability.json`) — that span is the differentiator, not
a reason to narrow.

**Personas:**
- **1LOD** (engineering/business owner) — drafts control descriptions,
  runs the control day to day.
- **2LOD** (compliance officer) — reviews/approves controls, maps them
  to obligations, sets testing cadence, judges effectiveness.
- **3LOD** (audit) — read-only, needs the evidence trail, not edit
  access.
- **Admin** — org/user management, integrations, billing.

## 2. Core functional requirements

1. **Obligations registry** — done today (`docs/data/obligations.json`),
   article-level, verbatim-verified against source text.
2. **Controls library** — CRUD on controls (name, owner, frequency,
   type, status, last test date/result). Demo version: `docs/controls.html`.
3. **Obligation ↔ control mapping** — many-to-many linking, with a
   visible gap list (obligations with zero controls). Demo version:
   built into `docs/obligations.html`'s detail view.
4. **Coverage dashboard** — KPI summary, topic-level heat-map, gaps
   list, upcoming/overdue tests. Demo version: `docs/dashboard.html`.
5. **Assessment/testing workflow** — record a test event (date, tester,
   result, evidence), not built yet even in the demo (data model only
   has `last_tested`/`effectiveness` fields, no history).
6. **Approval workflow** — draft → pending 2LOD review → approved, with
   an audit log of who approved what and when. Sketched visually in the
   mockup's provenance strip; not implemented.
7. **Reporting/export** — CSV export exists for obligations; needs the
   same for controls and for a combined coverage report (board-ready
   PDF/CSV).
8. **Notifications** — nothing yet. Needed once there's a backend: test
   due soon, gap opened by a new obligation, approval pending too long.

## 3. Data model (target — Postgres via Supabase)

```
orgs                 id, name, entity_type, created_at
users                id, org_id, email, role (1lod|2lod|3lod|admin)
obligations          id, legal_basis, topic, what, verbatim, who[],
                      criticality, deadline, source_url   -- centrally
                      maintained by RegRadar, not per-org
controls             id, org_id, name, owner_user_id, frequency, type,
                      status (draft|pending_review|approved),
                      source (manual|confluence|github),
                      source_ref (external url/id), created_at
control_obligation_map  control_id, obligation_id            -- the
                      coverage engine: coverage % is
                      count(distinct obligation_id) / count(obligations)
                      per org, grouped by topic for the heat-map
control_tests        id, control_id, tested_at, tester_user_id,
                      result (effective|needs_improvement|failed),
                      evidence_url
approvals             id, control_id, from_status, to_status,
                      actor_user_id, at            -- immutable audit log
```

`obligations` stays centrally maintained (RegRadar's own content
pipeline, same verbatim-checked discipline as `build_obligations.py`)
— it is not per-org editable. Everything else is org-scoped and
protected by Row-Level-Security keyed on `org_id` + `role`.

## 4. Backend & infrastructure

- **Supabase**: Postgres + Auth + Row-Level Security + Storage
  (evidence files) + Edge Functions (sync workers, scheduled digest).
  Managed, no server to run, RLS maps directly onto the 1LOD/2LOD/3LOD
  split without a custom authz layer.
- **RLS shape**: 1LOD can insert/update controls they own while
  `status='draft'`; only 2LOD/admin can transition
  `pending_review → approved`; 3LOD is read-only across the org;
  `obligations` table is read-only for everyone except a RegRadar
  service role.
- **Hosting**: frontend stays static (GitHub Pages or similar) and
  talks to Supabase directly from the browser via its JS client —
  no separate app server needed for v1.
- **Environments**: separate Supabase projects for dev/staging/prod at
  minimum; never share a prod project with test data.
- **Backups**: Supabase's built-in point-in-time recovery; verify the
  retention window matches what a compliance-tool customer would
  expect to ask about in due diligence.

## 5. Integrations

Meet customers where they already work — do not ask them to
re-type control descriptions into a new portal.

- **Pull**: sync control descriptions from Confluence/Notion, or a
  policy-as-code GitHub repo, via API on a schedule (Supabase Edge
  Function on cron). Writes into `controls` with `source`/`source_ref`
  set; diff on re-sync rather than blind overwrite.
- **Push**: open a Jira/Linear/Asana ticket automatically when a gap
  is found or a test comes due — 1LOD engineers live in those tools,
  not in a compliance dashboard.
- **SSO**: Google/Microsoft/Okta via Supabase Auth — needed before any
  enterprise (bank-tier) sale, less urgent for the PSP/EMI/CASP wedge.
- **Notifications**: Slack/email for approval-pending and test-overdue
  alerts.

Defer all of this past the first backend slice — none of it can be
tested meaningfully without a real design-partner account and API
tokens.

## 6. Security & compliance-of-the-tool-itself

Ironic but load-bearing: a compliance tool's own security posture is
part of what a 2LOD buyer will diligence before purchase.

- Encryption at rest and in transit (Supabase defaults cover this;
  confirm before claiming it in a sales conversation).
- Immutable audit log (`approvals` table, append-only, no update/delete
  grants even for admins) — this doubles as a real sales feature, not
  just internal hygiene.
- RBAC enforced at the database layer (RLS), not just in the frontend.
- Data residency: EU-region Supabase hosting, relevant for the "EU
  regtech" positioning and for customers who can't have compliance
  data leave the EU.
- Plan for a pen test and a SOC 2 roadmap before any GA claim to
  regulated-industry customers — not needed for a design-partner demo,
  but budget the lead time (SOC 2 Type II alone is a ~6-12 month
  process once started).

## 7. Non-functional requirements

- Multi-tenant isolation verified by RLS tests, not just code review —
  a leaked cross-org row is an existential bug for this category of
  product.
- Observability: basic error tracking + Supabase's own query/perf
  dashboards are enough pre-launch; revisit once there are paying
  customers.
- No hard uptime SLA needed pre-GA; document it once sold as SLA-bound.

## 8. Commercial/packaging

- **Tiering**: a free, static, no-signup tier (today's
  localStorage-only obligations register + personalization) as the
  top-of-funnel; a paid "Team" tier unlocks the backend-based controls
  library, mapping, multi-user and integrations.
- **Billing**: Stripe, metered or seat-based — decide once pricing
  research happens; not urgent now.
- **Onboarding**: CSV import of an org's existing controls, since
  nobody starts from zero — this matters more than any single
  integration for early adoption.
- **Org/admin management**: invite users, assign roles, see who's
  active — minimum viable admin panel, not a big build.

## 9. Legal/content governance

- Keep the obligations registry's existing discipline: every
  obligation's `verbatim`/`legal_basis` checked directly against the
  source CELLAR JSON before publishing (as `build_obligations.py`
  already enforces via its title assertion) — this is the actual moat,
  don't let it erode as scope grows.
- **Change management**: when a regulation amends, obligations need a
  delta/versioning story (the schema in `scaffold_obligations.py`
  already sketches a `delta` field for this) so a control that was
  mapped to "Art. 42 v1" doesn't silently go stale when the article
  changes. Not built; needed before claiming "always up to date."

## 10. Phasing

- **Phase 0 (done)** — static obligations register + device-local
  personalization (pin/dismiss/note). No account needed.
- **Phase 1 (done, this branch)** — static controls library + coverage
  dashboard + obligation↔control mapping, still device-local
  (`regradar-controls-mine`), still no backend, no accounts.
- **Phase 2 (next, pending Supabase decision)** — real backend: orgs,
  auth, the schema in §3, single-org RLS. Migration path: Phase 1's
  localStorage shape maps almost directly onto the `controls` /
  `control_obligation_map` tables, so the frontend swap is mostly
  "read from Supabase instead of localStorage," not a rewrite.
- **Phase 3** — multi-tenant hardening, integrations (§5), SSO.
- **Phase 4** — compliance certifications (SOC 2), billing, enterprise
  sale readiness.

## Open decisions (yours)

- Supabase vs. another backend — deferred to tomorrow per your note.
- Which integration to build first once backend work starts
  (Confluence pull vs. Jira push) — depends on which design partner
  you land first and what they actually use.
- Pricing/packaging — not urgent, but shapes how hard to gate Phase 1
  features behind Phase 2's login.
