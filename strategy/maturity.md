# Maturity of each part (honest estimates, 2026-11-14)

How to read this: "Working" is the share of the defined scope that works end to
end today on demo data and device storage. "Sellable" says whether a real firm
could use it for real work today. Percentages are estimates by the project
lead (Claude), not measurements, and move when the scope moves. Update this
file whenever a stream merges a slice.

| Part | Working | Sellable today? | What works | What is prototype | What is missing |
|---|---|---|---|---|---|
| Landing page | 90% | Yes | Story, CTA, scroll scene | Copy and proof points | Contact capture, domain, legal pages |
| Register (obligations) | 45% | No | 12 verified AMLR obligations with law text and mapping | Controls kept on the device | The rest of the obligations, multi-user, owners per obligation |
| Topics view | 60% | Partly | 40 subtopics, 114 verbatim extracts, 4 layers, highlights | AMLA and supervisor layers empty | Collected sources, legal fact-check, AI summary |
| Controls | 50% | No | Library, mapping, test log, backup and restore | Browser storage | Evidence attachments, owners and reminders, import |
| Policies | 35% | No | Library, versions, approval flow, attestations, templates | Policy writing inside the tool (not what users want) | Link to external documents, approval tickets, comparison, status from documents |
| Cases and STR | 40% | No | Alerts, case file, narrative builder | Demo data | Real workflow, integration, audit trail |
| Risk (business and customer) | 40% | Partly | Scoring models, outputs | Default weights | Firm calibration, review dates, export packs |
| Issues and actions | 55% | Partly | Findings and actions, SLA, backup | Browser storage | Shared tickets model, approvals, notifications |
| Work board and Briefing | 50% | No | Kanban, dispatch, due and overdue views | Demo data | One ticket model, saved views, real data |
| Change impact | 50% | Partly | Matches regulatory items to obligations | Rules-based | Fed by the new source engine |
| Ask the law | 40% | Partly | Cited answers, verbatim quote check, evals | Needs the user's own API key | Server-side AI, broader corpus |
| RegWatch | 55% | Partly | Feed, deadlines, data bot | Legacy sources breach robots.txt | Switch to the new source engine, visual rebuild |
| Source engine (scraper v2) | 60% | Yes (internal) | 19 sources, documents with locators, deadlines, dedupe | Runs alongside legacy | CTIF-CFI, FATF, other national supervisors, freshness measurement |
| Academy | 70% | Partly | AMLR path with games, certificates, team register, 1 film | Content gaps at advanced levels | Films 02 to 04, one coherent path, sector-neutral copy |
| Max assistant | 5% | No | Cat animation only | No chat | Model choice, server-side AI, mapping |
| Data layer | 55% | No | Records, links, event log, migrations | Browser storage | Database, auth, roles, multi-user |
| Gap assessment | 5% | No | Design only | | Everything |

Sellable-today criteria: works with real (non-sensitive) data, no loss of data
on refresh, explainable to a buyer in two minutes, no embarrassing defects.
