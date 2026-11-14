# RegWatch scraper audit (2026-11-14)

Scope: the pipeline that feeds RegWatch (`regulatory_watch.py`,
`classification_v3.py`, `page_reader.py`, `enrichment_v3.py`,
`intelligence_v4.py`, `dashboard_data.py`, `validate_data.py`,
`.github/workflows/regwatch.yml`) as it is on `main` at commit `74c0b0c`.
Every number below was measured on 2026-11-14 from the repository, its git
history, the public GitHub Actions API, or one local run. Where a number
could not be measured it says "not measured".

## How it was measured

| What | Method |
|---|---|
| Sources, items per source | `docs/data/items.json` (744 items, 2026-06-18 to 2026-11-13) and `meta.json` |
| Failures per source | `meta.json` `sources[].status` in every commit of `meta.json` that carries source health (83 runs) |
| Freshness | for each item id, the commit time of the first `items.json` version that contains it, minus the item's own `date`; 145 commits, items present in the first commit (backfill) excluded; 1,528 items measurable |
| Run time in CI | GitHub Actions API, last 60 runs of `regwatch.yml` (2026-09-16 to 2026-11-13) |
| Local run | one run of `python regulatory_watch.py --maintenant` in a scratch copy (no Groq key, no email credentials), 2026-11-14 01:06 CET |
| Classification precision | 60 items drawn from `items.json` with `random.seed(20261114)`, labelled by hand against their titles (rules below) |
| robots.txt | fetched for every host the pipeline uses or the registry plans to use |

Disclosure: the single local run fetched Google News and EUR-Lex once each
before I had read their robots.txt (see "What breaks"). No later run of the
new engine touches either host.

## Headline numbers

| Metric | Value |
|---|---|
| Sources configured | 36 (18 regulator or official feeds, 18 Google News searches) |
| Items in the archive | 744 (40% Google News: 297 `news` items) |
| CI run time | median 3.3 min, max 15.2 min (60 runs, all `success`) |
| Local run time (no AI) | 48 s wall clock, 722 entries collected, 6 new items kept |
| Scheduled start vs actual start | cron says 06:00 UTC; runs actually start between 10:04 and 15:01 UTC (GitHub delays scheduled jobs) |
| Freshness, all items | median 18.8 h, p90 116 h from publication date to first commit |
| Freshness, regulator feeds | median 12.8 h, p90 233 h |
| Freshness, EUR-Lex OJ L | median 12.5 h, p90 37.9 h (202 items) |
| Freshness, AMLA consultations | median 1,748 h (73 days): items enter late because the 90-day lookback admits them weeks after publication |
| Items with a fake date | 42 (ESMA 35, EUR-Lex proposals 7): feed has no date, so the run time is stored as the publication date, which also makes their measured lag 0 h |
| Duplicates in the archive | 22 extra copies of the same URL; 31 extra copies of the same headline once the "- Outlet" suffix is removed |
| Relevance precision (sample) | 41 of 60 = 68% relevant to a financial-services compliance team |
| In the product's target scope (AML/CFT, payments, e-money, crypto, sanctions) | 19 of 60 = 32% |
| "Critical" (impact 3) precision | 7 of 17 = 41% |
| AML/CFT theme tag precision | 5 of 12 = 42% (7 false positives, e.g. FSMA trading suspensions) |
| Document-type label correct | 54 of 60 = 90% (6 errors: speeches and an ECB legal decision filed as "Publication") |
| Documents stored with text and locators | 0: only a 700-character description per item, no corpus |

## Sources and items

Items in `items.json` per source (top): EUR-Lex OJ L 84, Google News ESMA 68,
ECB 59, Google News EU frameworks 54, FSMA 51, Google News sanctions 47,
Google News EBA 43, EBA 41, ESMA 35, FSB 34, SRB 28, AMLA 18, AMLA
consultations 8, NBB supervision page 17, NBB news 4, NBB publications 1,
EUR-Lex proposals 7. Not followed at all: AMLA regulatory-instruments
tracker, AMLA document library, AMLA public hearings, AMLA FAQs, NBB AML/CFT
guidance pages and NBB AML decisions page, European Commission AML pages,
FATF, CTIF-CFI, any non-Belgian national supervisor.

## Failures per source (83 runs with health data)

- Dead for the whole period (removed later): `esrb_rss` 30/30 error,
  `esma_qa` and `fsma_circulaires` 28/28 empty.
- About one third of runs failed for `bnb_rss` (29 error), `ecb_supervision_rss`
  (28), `eiopa_rss` (28), `eurlex_proposals` (26), `amla_rss` (28 empty):
  these are the URL changes fixed on 2026-09-24, so the failures sit before
  that date.
- `esma_rss` 7 errors; Google News 2 errors each; `eurlex_ojl` 1.
- In the local run, both EUR-Lex feeds returned HTTP 403 with an
  "Azure WAF JS Challenge" page, so locally EUR-Lex yielded 0 items.
  In CI it still returned 100 items on 2026-11-13. Not measured: how
  often CI hits the challenge.

## What breaks or is wrong

1. **robots.txt is not checked, and two sources forbid crawling.**
   `eur-lex.europa.eu/robots.txt` is `User-agent: * / Disallow: /` (last
   modified 2025-10-30) and `news.google.com/robots.txt` disallows all
   agents. The pipeline uses both (2 EUR-Lex feeds, 18 Google News
   searches) with a browser user agent. The Publications Office offers
   the same OJ data through its official CELLAR SPARQL endpoint
   (`publications.europa.eu`, robots allows `/`), which the new engine
   uses instead.
2. **`seen.json` forgets at random.** `sauvegarder_vus` keeps
   `list(set)[-2000:]`; a set has no order, so once the file reached its
   2,000 cap (it is at 2,000 now) each run drops arbitrary ids, letting old
   items back in. This is one source of the duplicates above.
3. **No conditional requests or content hashing**: every run downloads
   every feed in full; a changed document (new version of a consultation
   paper, corrigendum) is not detected unless its URL or title changes.
4. **Freshness is capped by the scheduler**: one run a day that GitHub
   starts 4 to 9 hours late. A document published at 07:00 UTC is typically
   seen around 13:00 UTC the same day or the next day.
5. **Fake dates**: feeds without dates get `datetime.now()`.
6. **Email step runs without credentials** and fails with "Connection
   unexpectedly closed" (harmless, logged as an error every local run).
7. **Precision**: one in three kept items is outside the compliance scope
   (macro speeches, trading suspensions, statistics, Commission daily
   news), and "Critical" is right less than half the time (also noted in
   `NEXT_STEPS.md` A).
8. **Page reading stops at 700 characters**, so nothing can be cited by
   page or paragraph, and PDFs are read only for their first 3 pages.

## What is missing (against `strategy/requirements-platform.md` sections 1, 2, 4)

- Source registry with health and last success: partly (per-run health in
  `meta.json`, no history, no last-success date, no polling frequency).
- Change detection by hash and withdrawal detection: missing.
- PDF and HTML text with page and paragraph locators: missing.
- Consultation deadlines with source links: missing as structured data
  (only AI-extracted dates for the timeline).
- Metrics (coverage, freshness, precision, false-alert rate): not tracked.
- Proposal stubs for new or changed obligations: missing.
- National coverage beyond Belgium: none; CTIF-CFI not followed.

## Classification sample: how I labelled

For each of the 60 sampled items I read the title (and source) only, as a
compliance analyst at an EU or Belgian financial firm would, and set:
- **Relevant** = a regulatory, supervisory or legislative publication,
  or enforcement or licensing news, that bears on financial-services
  compliance. Not relevant: macro-economic speeches, market statistics,
  trading suspensions, institutional notices, non-financial EU acts,
  marketing blogs.
- **In target scope** = relevant and about AML/CFT, sanctions, payments,
  e-money or crypto-assets.
- **Critical justified** (for impact 3 items) = a binding or
  supervisory instrument, or a sanctions-list change, that requires action.
- **Document type correct** = the label is not misleading (a generic
  "Publication" for an ordinary news release counts as correct; a speech or
  a binding ECB decision labelled "Publication" does not).
- **AML/CFT tag correct** = the title is about money laundering, terrorist
  financing or AML supervision.

Sample indexes and labels are reproducible from the seed; the not relevant
ones were 0, 3, 4, 15, 16, 17, 25, 30, 31, 33, 34, 37, 38, 39, 41, 45, 52,
54, 56. One labeller, no second reader: treat the percentages as
indicative (plus or minus about 12 points at n = 60).

## After the upgrade (engine v2, same day)

Measured on local runs, 2026-11-14 (first clean run, then incremental
runs). `docs/data/sources/metrics.json` is rewritten by every run.

| Metric | Legacy pipeline | Engine v2 |
|---|---|---|
| Sources respecting robots.txt | 16 of 36 (EUR-Lex and Google News forbid crawling) | 19 of 19 working (checked before every request; crawl-delay honoured) |
| AML-dedicated primary sources | 3 (AMLA feeds) | 14 (CELLAR AML family and OJ L, 8 AMLA, NBB guidance, decisions and supervision news, Commission AML pages) |
| Corrigenda of AML / payments / crypto acts | not detected | detected through CELLAR (8 in the last 400 days; English text often absent because a corrigendum may concern other language versions) |
| Documents with text and locators | 0 | 124 (8,798 numbered paragraphs, 2.7 MB of JSON; 74 more queued, extracted at up to 24 per run) |
| Recall against the authorities' own listing pages | not measured | EBA 9/9, ESMA 10/10, AMLA consultations 10/10 (coverage.json) |
| Deadlines with a source link | AI-extracted only | 92 (77 from structured fields, 15 from stated text patterns with the quoted sentence) |
| Topic tagging (golden / held-out) | not measured | precision 1.00 / 1.00, recall 0.99 / 0.79 (golden set was in view while the rules were written; held-out was not) |
| Duplicate detection (85 labelled real pairs) | exact title only | precision 1.00, recall 0.89 (thresholds tuned on the same pairs) |
| "Critical" on the 744-item archive (F-028) | 245 (32.9%), 124 informational, 232 distinct stories | 3 (0.4%) on the legacy archive; 64 of 400 cards in the v2 feed |
| Run time | 3.3 min median in CI | 127 s first run, 153 s incremental (mostly polite waiting: EBA 10 s, FSMA 30 s crawl-delays); weekly NBB guidance crawl 267 s |
| Requests per run | about 40 feeds plus about 15 pages | 49 to 62 daily, about 90 more once a week; budget 220 |

Not measured yet: freshness of the new engine (needs several CI runs; a
first run only backfills) and false-alert rate (needs reviewer verdicts on
proposals).
