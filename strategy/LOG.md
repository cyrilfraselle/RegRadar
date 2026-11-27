# Strategy log

Dated notes from strategy conversations between the owner and the assistant.
Newest first. Each entry: context, what we decided, what we deferred, next.

## 2026-10-16 (later): answers to the four strategy questions

1. First buyer: a team; MLRO and managers dispatch work and need a clear
   overview (dispatch, workload, status per person).
2. Wedge confirmed: horizon scanning + obligation register + evidence.
   Owner asked for next-level features: ten proposed in ROADMAP.md.
3. Build a fully working prototype free until the first contract, then
   upgrade; see decisions/002-free-prototype-stack.md.
4. Tickets: own board plus two-way link to Jira-class tools; everything
   configurable by the team. Connection map in CONNECTIONS.md.
5. Weekly strategy brief on Fridays (routine created).

Next: data spine (F1) designed for a Postgres adapter, Home/Jarvis, work
board with dispatch and workload view, horizon calendar, import wizards.

## 2026-10-16: the "replace the stack" vision

Context: after the first eight modules and the autonomous build loop, the owner
set the ambition: replace the whole tool set a compliance team uses (Excel,
GRC suites, ticketing, wikis, horizon scanning), feel like "Jarvis for
compliance teams" (a daily briefing and outstanding dashboards), include
Kanban and ticketing built for compliance work, and connect natively to the
tools and databases of banks and fintechs.

Decided: capture it in VISION.md and ROADMAP.md; make the shared entity graph
(F1) the first foundation; build Home/Jarvis v1, a work board, a horizon
calendar and import wizards in Phase 1.

Deferred (owner): first buyer and size, backend and hosting, first connectors.

## 2026-11-14: scraper v2 (max/scraper-v2)
Audit in strategy/scraper-audit.md. New registry-driven source engine (collect_sources.py, regwatch_sources/) writing docs/data/sources/: CELLAR instead of EUR-Lex RSS (robots.txt), AMLA tracker and consultations with deadlines, NBB AML guidance corpus with page and paragraph locators, proposal stubs, coverage check, story-clustered feed. Legacy RegWatch untouched except the seen.json eviction fix.
- 2026-11-14 (MAX): Topic view `docs/topics.html`: 10 themes, 40 subtopics, 114 verbatim AMLR/TFR extracts checked by `tests/topics.test.mjs`; AMLA mandates quoted; NBB/EBA/FATF layers marked not collected yet; controls with gap markers; deterministic highlights; AI summariser hook (no AI code).
- 2026-11-14 (MAX): RegWatch v2 (max/regwatch-v2): legacy pipeline drops EUR-Lex RSS and the 18 Google News searches (robots.txt) and checks robots.txt before each remaining source; `docs/regwatch.html` rebuilt on the source engine feed (story cards, primary first, news collapsed), deadlines strip with .ics export, filters by authority/topic/type/status/jurisdiction, topic tags linked to the Topics view, legacy archive as fallback.
- 2026-11-14 ACADEMY (academy/path-v2): Academy rebuilt as one AMLR programme page in three levels; new topic 'Who is covered' (Art. 2, 3, 70(2)); practice rooms folded into the path; evidence as last step; programme summary from data; rr-ui.css. Needs legal fact-check.

- 2026-11-14 (academy/films-02-04): films 02 to 04 built on a shared data-driven engine (docs/academy-film-engine.js); gate step 6 automated by tests/films.test.mjs; films registered in docs/data/academy/films.json. Needs legal fact-check.
- 2026-11-14 MAX (max/obligations-bulk): bulk extraction started: extract_obligations_draft.py, docs/data/obligations-draft.json (AMLR 330, TFR 58, AMLD6 29 draft units, not reviewed), review queue, tests/obligations_draft.test.py, strategy/obligations-bulk.md. Verified register untouched. Needs legal fact-check.
- 2026-11-22 (digest): recorded owner replies of 21 Nov (D1=A film 05 script, D2=A Cases next) in strategy/decisions-log.md.
- 2026-11-16 MAX (max/amlr-chapter2): 9 verified AMLR Chapter II obligations added (Arts 8 to 14, 16, 18: internal policies, business-wide risk assessment, compliance functions, training, integrity, whistleblowing, group, outsourcing); register now 21. Verbatim excerpts checked by build_obligations.py. Needs legal fact-check.
- 2026-11-17 ACADEMY (academy/governance): topic 'Governance' (Arts 9 to 13) built: explainer, 4 questions, Spot it (Who does what?), Decide, 5 verbatim law excerpts; removed from coming soon; content 1.2.0. Film script not started. Needs legal fact-check.
- 2026-11-19 ACADEMY (academy/film-05-str-script): film 05 "Report, do not tell" script, storyboard and 23-row claim ledger for the reporting-suspicions topic (`academy/films/suspicious-transaction-reports.script.md`); quotes checked verbatim by script; independent check and owner approval pending, nothing built. Slice (b) paused: open PR #48 changes the same academy data files. Needs legal fact-check.
- 2026-11-18 MAX (max/gap-view): Gap assessment page `docs/gaps.html`: coverage map by topic (covered and tested, covered untested, partly, not covered, not applicable; configurable definition), list, dated snapshots with compare, real .xlsx export written in the browser, print. No legal text added. Menu entry left to SYSTEM.
- 2026-11-20 MAX (max/migrate-impact): Change impact assessments moved onto the data layer (docs/impact-store.js): one reg_change record per assessment, one-time idempotent import of 'regradar-impact' (old key kept as backup), page falls back to the old key if the spine cannot open; bridge no longer mirrors impact; 4 new tests (spine 38/38). Register growth skipped: Chapter II is in open PR #45 on the same files.
- 2026-11-23 (OWNER): decisions D1 A (Chapter V next), D2 A, D3 A recorded; PRs #60 #59 #56 #52 #49 #44 merged; Kanban register page started.
- 2026-11-25 MAX (max/migrate-cases): Cases module moved onto the data layer (docs/cases-store.js): alerts, cases, FIU reports and requests are spine records (cases and alerts have owner, status and due date so the board sees them); case content is stored without audit events so the hashed log never holds what a case says; one-time idempotent import of 'regradar-cases' (old key kept as backup, page falls back to it if the spine cannot open); bridge no longer mirrors cases; 5 new tests (spine 43/43). Register growth skipped: Chapter II/IV is in open PR #62 on the same data file.
