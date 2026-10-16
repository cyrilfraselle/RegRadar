# Connection map

Every system a compliance team at an EU payment, e-money, crypto or bank
touches, what could flow between it and RegRadar, and when. This is a map to
plan from, not a promise: before building any connector we verify the vendor's
current API, terms and data-protection position.

Directions: IN = data flows into RegRadar, OUT = RegRadar writes to it, TWO =
both. Phase: 1 = no backend (files, links, feeds), 2 = needs the backend,
3 = later / with a design partner.

## Connector principles

1. **Read first.** Start read-only, add write-back only after trust.
2. **Least privilege.** Narrowest scopes; per-tenant secrets in a vault.
3. **Mapping is configuration.** Each connector ships a default mapping to
   RegRadar objects (obligation, control, test, evidence, task, person), and
   the team edits it in a UI with a dry run before anything syncs.
4. **Everything leaves a trail.** Every sync is in the event log.
5. **Evidence, not just data.** A connector's main job is to turn system data
   into dated control evidence and to push work out where people already are.
6. **Always an exit.** Every connector has a file-based fallback (CSV/JSON).

## Work and knowledge

| System | Flow | What moves | Phase |
|---|---|---|---|
| Jira, Linear, Asana, Monday, ClickUp, Trello | TWO | tasks and status, linked to obligation or control | 2 |
| ServiceNow (ITSM/GRC) | TWO | tickets, incidents, change records as evidence | 3 |
| Confluence, Notion, SharePoint wikis | IN | policy documents and versions, owner, review date | 2 |
| Excel, Google Sheets | IN/OUT | registers (risks, controls, issues) by import and export | 1 |
| AuditBoard, Archer, OneTrust, MetricStream exports | IN | controls, risks, issues via CSV/XLSX migration | 1 |

## Communication

| System | Flow | What moves | Phase |
|---|---|---|---|
| Slack, Microsoft Teams | OUT/IN | daily briefing, alerts, approvals; ask "what is due Friday?" | 2 |
| Email (Gmail, Outlook) | OUT/IN | digests, reminders; email-to-task | 1 (links) / 2 |
| Calendar (Google, Outlook) | OUT | deadlines and reviews as events (.ics first) | 1 |

## People and identity

| System | Flow | What moves | Phase |
|---|---|---|---|
| Okta, Microsoft Entra ID, Google Workspace | IN | SSO, groups to roles, joiners/leavers | 2 |
| HR (Personio, BambooHR, Workday) | IN | roster, role, start date for training and attestations | 3 |
| E-signature (DocuSign, Adobe Sign) | OUT/IN | policy sign-off and attestations | 3 |

## Documents

| System | Flow | What moves | Phase |
|---|---|---|---|
| Google Drive, SharePoint/OneDrive, Box, Dropbox | IN | evidence files (link, hash, date) | 2 |

## Customer lifecycle and screening

| System | Flow | What moves | Phase |
|---|---|---|---|
| KYC/KYB providers (identity verification, company data) | IN | verification result, UBO data, check dates | 3 |
| Sanctions, PEP, adverse-media screening vendors; official lists (EU consolidated list, UN, OFAC) | IN | hits, list changes, screening runs as evidence | 3 |
| UBO and company registers | IN | register extracts for UBO verification | 3 |
| Blockchain analytics (for crypto firms) | IN | wallet risk, alerts | 3 |

## Monitoring and operations

| System | Flow | What moves | Phase |
|---|---|---|---|
| Transaction-monitoring and fraud systems | IN | alerts into the case queue, rule changes as evidence | 3 |
| Core banking, ledgers, PSP and card platforms | IN | volumes and exports for risk assessment and sampling | 3 |
| Data warehouses and databases (Snowflake, BigQuery, Databricks, Postgres, MySQL) | IN | scheduled read-only queries become automatic control-test evidence | 2/3 |
| BI (Power BI, Looker, Tableau) | OUT | governed metrics into the firm's dashboards | 3 |

## Security and operational resilience (DORA)

| System | Flow | What moves | Phase |
|---|---|---|---|
| Cloud accounts (AWS, Azure, GCP) | IN | inventory of ICT third-party services | 3 |
| Change and delivery (GitHub, GitLab) | IN | change records and approvals as evidence | 3 |
| Monitoring and incidents (PagerDuty, Datadog, status tools) | IN | incident timelines for incident reporting clocks | 3 |
| Vendor/third-party risk tools | TWO | register of ICT third-party arrangements | 3 |

## Regulators and sources

| Source | Flow | What moves | Phase |
|---|---|---|---|
| EUR-Lex, EBA, ESMA, EIOPA, AMLA, ECB, SRB, FSB, NBB, FSMA, FATF | IN | already collected daily; add effective dates and consultations | 1 |
| FIU and supervisor reporting portals | OUT | structured report exports first (file), submission only if an API is offered | 3 |
| Official gazettes and national transposition trackers | IN | transposition status per directive | 1/2 |

## What we build first

Phase 1 (no backend): CSV/XLSX import for registers and exports, `.ics`
calendar export, email-ready digests, outbound webhooks. Phase 2: Slack and
Teams, Jira and Confluence, Google and Microsoft identity and documents. Then
read-only database evidence, because it replaces the most manual work, and the
vendor imports once a design partner names the systems.
