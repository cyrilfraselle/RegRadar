# Platform requirements to keep in mind (owner, 2026-11-12)

Status: requirements and parked topics, not decisions. To be discussed when we
talk about the structure and the database (Postgres/Supabase per
`decisions/002-free-prototype-stack.md`, Firebase as an alternative the owner
mentioned). Nothing here is built yet.

## Reminders for the owner (parked, bring them up)
1. **Make the scraper (RegWatch pipeline) hyper efficient.** Wider and faster
   source coverage, reliable change detection, PDF and consultation parsing,
   de-duplication, source health monitoring. Needs its own audit first: today
   its coverage and precision are not measured.
2. **Grow the obligation register toward "all compliance obligations".**
   Currently 12 verified AMLR obligations.
3. **Backend and database choice** (Firebase vs Postgres/Supabase), with the
   confidentiality requirements below as the selection criteria.
4. **Max mapping agent** (documents to obligations to controls).

## 1. Obligation register: from 12 to "all of compliance"
Goal: the register covers the obligations of the compliance world relevant to
our firm types (payment, e-money, crypto first, banks later), kept current.

Pipeline we want (living register):
1. **Sources**: official texts and regulators (EU legislation, EBA, ESMA, AMLA,
   FATF, national supervisors), starting from the sources RegWatch already
   follows.
2. **Detect**: a new document or a changed document is found by the scraper.
3. **Extract**: the text is parsed, structured and stored with its source URL,
   date, language and version.
4. **Propose**: AI suggests (a) new obligations, (b) changes to existing
   obligations, (c) obligations that are repealed or superseded, each with the
   exact quoted passage.
5. **Verify**: scripted checks (quote is verbatim in the source, article and
   title exist) plus a human reviewer; nothing is published unverified.
6. **Publish and propagate**: new version of the obligation; every control,
   policy and mapping linked to a changed obligation is flagged "needs review";
   firms are told what changed (feeds the Briefing and impact analysis).
Requirements: obligation versioning with effective dates, jurisdiction and
firm-type applicability, language (EN, FR, NL), a review queue, provenance on
every statement, and a public changelog.

## 2. Scraper requirements (for the later deep-dive)
- Source registry with health status and last successful fetch per source.
- Change detection (hash and semantic diff), PDF and HTML parsing, consultation
  deadlines extracted with source links.
- Politeness, retries, legal terms of use of each source respected.
- Metrics: coverage (sources monitored), freshness (time from publication to
  ingestion), precision of classification, false-alert rate.
- Output feeds the proposal pipeline above and RegWatch.

## 3. Max: AI-assisted mapping (quiet, on demand)
- Firm selects applicable laws and obligations, uploads documents (AML policy,
  procedures, control lists); Max proposes links from passages to obligations
  and controls with the exact quoted excerpt.
- A human accepts or rejects each link; accepted links store excerpt, document,
  version, location, reviewer and date. Suggested links are marked "AI
  suggested" until confirmed.
- Same engine serves gap assessment (policy vs regulation, guidance or other
  policy) and import wizards.
- Not proactive: suggestions on demand or a quiet count of pending suggestions.
- Quality: a golden set of document-to-obligation mappings, precision and recall
  tracked in CI, an "I cannot find this" behaviour.

## 4. Document reading
Formats: PDF (text and scanned, OCR), Word, Excel and CSV (control matrices),
plain text. Requirements: text extraction with page and paragraph locations (so
excerpts can be cited and re-found), chunking, language detection, versioning
of every uploaded document, virus and size checks, and a way to re-run mapping
when the obligation text changes.

## 5. Confidentiality and security (non-negotiable for real client documents)
- **Tenant isolation**: each firm's data is separated (row-level security by
  organisation or equivalent), roles (MLRO, manager, analyst, board, read-only).
- **EU hosting region**; encryption in transit and at rest; backups with tested
  restore; per-tenant export and deletion.
- **AI calls only from the server**: a proxy holds provider keys (never in the
  browser), logs metadata not content, applies redaction where possible and
  enforces per-tenant limits. Bring-your-own-key stays only for the prototype
  with fictional data.
- **AI provider terms**: data processing agreement, no training on customer
  data, retention settings, region options (to verify with the provider).
- **Audit log** of access and changes (append-only), secrets in a secret
  store, least-privilege access, dependency and vulnerability scanning.
- **Legal and compliance of ourselves**: legal entity and data controller
  identified, privacy policy, records of processing, breach procedure,
  supplier (ICT third-party) documentation that customers under DORA will ask
  for, security questionnaire answers, penetration test before real data.
- **Rule until all of this exists**: prototype data is fictional or public only.

## 6. Questions for the backend and database discussion
- Firebase (Google, document database, security rules) vs Postgres/Supabase
  (SQL, row-level security, portable): which fits relational data (obligation to
  control to owner to status) and audit needs? Current recommendation in
  decisions/002 is Postgres for portability; Firebase to be weighed honestly.
- EU region availability, free-tier limits and inactivity pauses (to verify),
  upgrade path and cost at first customer, auth and SSO, file storage, background
  jobs for scraping and AI processing, vendor lock-in and export.
- Where the scraper and AI jobs run (scheduled server jobs rather than the
  current repository workflows), and how the static site talks to the backend.
- Landing page lead capture: free EU tool vs own table, consent and retention.

## 7. Cost to estimate later (placeholders, no numbers yet)
Domain, hosting, database, storage, AI tokens per document and per question,
OCR, email, monitoring, security review, legal set-up. To be filled with
current provider prices at the time of the discussion.
