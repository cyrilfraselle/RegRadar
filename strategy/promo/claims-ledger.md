# Promo film: claims ledger (script gate, step 2)

Every string a viewer is meant to read, with the claim it makes, the evidence
in the repository (checked on branch `lab/promo-video` from `main`, commit
`045a40b`, 2026-11-14) and a verdict. "ok" = true today as worded. "reword" =
the first idea was not safe; the wording in the String column is already the
safe version and the note says why. An independent reviewer (CHECK stream)
re-runs this table before any build; after the build, the on-screen strings
are re-read against it (SCRIPT_REVIEW step 6).

Law file: `docs/data/laws/32024R1624_EN.json` (AMLR, Regulation (EU)
2024/1624, official CELLAR text). "Verbatim" = string appears in that file.

| Id | String | Claim | Evidence | Verdict | Notes |
|---|---|---|---|---|---|
| C1 | The AMLR has 90 articles. | AMLR has 90 articles | Law file: `articles` has 90 entries, last id "90" | ok | Count of articles, not of obligations. Do not say "90 duties". |
| X1 | AMLR article text as texture | Real law text | Law file | ok | Use real text only, never lorem ipsum. |
| C2 | Which duties are yours? | (question, no claim) | n/a | ok | |
| T1 | Prototype · sample data | The product is a prototype on demo data | `strategy/maturity.md`; page notes "Prototype, not legal advice" (`docs/topics.html`, `home.html`, `board.html`); `docs/data/controls.json` _meta "Demo data" | ok | Required by the brief. |
| X2, K0 | Art. 42(1) text; "obtain senior management approval" | Verbatim law | Law file Art. 42(1)(a) | ok | Typeset exactly, including "(a)", "(b)", "(c)". |
| C3 | Max starts from the law, word for word. | Obligations and topic extracts quote the official text verbatim | `docs/data/obligations.json` _meta.method; `build_obligations.py` `assert_verbatim`; `tests/topics.test.mjs` (114 extracts checked verbatim) | ok | "Word for word" is about quotes only. The register's plain-language "what" lines are editorial and are NOT shown in the film. Do not say "verified" or "checked by lawyers". |
| C4 | AMLR Art. 42(1) · applies from 10 July 2027 (Art. 90) | AMLR applies from 10 July 2027 | Law file Art. 90, second paragraph | ok | Art. 90 has an exception (Art. 3(3)(n) and (o): 10 July 2029); not our audience, but the "(Art. 90)" citation lets a viewer check. Do not write "in force from": it entered into force in 2024. |
| C5 | 1. Each point becomes a duty. | The register breaks an article into its requirements | `docs/data/obligations.json` AMLR-art42 `sub_requirements` (three items); shown as a list by `docs/workspace.html` (`.subs`) | reword | First idea "every article becomes duties" overclaims: the register has 12 obligations, not all 90 articles. The film shows one article; the line is about that mechanism. |
| K1 to K3 | (a) Senior management approval / (b) Source of wealth and source of funds / (c) Enhanced, ongoing monitoring | Key words of each point | Law file Art. 42(1)(a), (b), (c): "senior management approval", "source of wealth and source of funds", "enhanced, ongoing monitoring" | ok | Fragments are verbatim (capitalised first letter only). |
| C6 | 2. Each duty gets a control, an owner and a status. | Controls are mapped to obligations and carry owner and status | `docs/workspace.html` (Link button, owner field, status); `docs/data/spine/config.json` control workflow (Draft, In review, Approved) | ok | In the product the link is one obligation to many controls; the film links per point for clarity. Flag to reviewer: per-point mapping is a simplification (see open question 3). |
| K4, K5 | Four-eyes approval on high-risk onboarding · Sanmi O. · In review | Demo control | `docs/data/controls.json` ctl-06 (status pending_review = "In review") | ok | Fictional demo data. In the demo, ctl-06 is not linked to Art. 42; the film shows the user linking it (a real action in `workspace.html`). |
| K6, K7 | Enhanced ongoing monitoring, PEP book · M. Van Damme · In review | Demo control | `docs/data/controls.json` ctl-07 | ok | Dash in the source name replaced by a comma. Same linking note as K4. |
| K8 | Not tested | Gap marker | `docs/topics.js` controlsLayer: gaps "Not tested"; ctl-07 `last_tested: null` | ok | |
| K9 | No control mapped | Gap marker | `docs/topics.js` controlsLayer: "No control mapped" | ok | |
| X3 | To do · In progress · Waiting for approval · Done | Board columns | `docs/data/spine/config.json` workflows.work; `docs/board.js` | ok | |
| C7 | No control, no test: Max shows the gap. | The product marks missing controls and missing tests | `docs/topics.js` gap markers; `docs/workspace.html` coverage dashboard | reword | First idea "Max finds your gaps" implies analysis of the firm; it only marks gaps in what the user has entered. Also "No owner" and "Not approved" are markers; we show two, without claiming the list is complete. |
| C8 | 3. Log each test, with its evidence. | A test can be logged with a result and an evidence link or reference | `docs/workspace.html` "Log test today", fields "Evidence: link or reference", results Effective / Needs improvement / Failed | ok | Evidence is a link or text reference; no file upload yet (maturity: "Evidence attachments" missing). Never show a file being attached. |
| K10 | Effective · Evidence: link or reference | Test log row | Same as C8 | ok | Illustrative action on sample data; no date shown, no real document named. |
| C9 | Every step links back to the article. | Control to obligation to article link exists | ctl `obligation_ids`; obligation `source_url` = `law.html?celex=32024R1624&art=42`; topics extracts carry locators | ok | Holds for the 12 register obligations and mapped controls. |
| C10 | One topic, four layers: the law, AMLA, supervisors, your controls. | The topic view has these four layers | `docs/data/topics.json` _meta.layers; `docs/topics.html`, `docs/topics.js` | reword | Maturity: AMLA and supervisor layers mostly "not collected yet". The film shows the four layer titles and only law text on them (X5 is a law quote). Never show AMLA or NBB document content. |
| X4 | Layer titles | Real labels | `docs/data/topics.json` _meta.layers | ok | |
| X5 | "By 10 July 2027, AMLA shall issue guidelines" | Verbatim law | Law file Art. 42(2) | ok | Ellipsis after it; shown on the AMLA layer as the mandate quote, as the topics view does. |
| C11 | Deadlines, each with its source. | Each calendar date carries a source | `docs/calendar.html` lead "with the source for every date"; `docs/data/sources/deadlines.json` (each entry has `source`, `url`, `method`); `tests/calendar.test.mjs` | ok | Calendar is on main (commit 045a40b). |
| K11 | 10 July 2027 · AMLR applies · Source: AMLR Art. 90 | Date and source | deadlines.json id 98c1f8791feb ("AMLR (Anti-Money Laundering Regulation) applies", 2027-07-10); law file Art. 90 | reword | The calendar row cites `applicability.json` and links the law page, not "Art. 90" itself. Either show the calendar's own source label, or keep "Source: AMLR Art. 90" as the law fact. Reviewer to choose; see open question 4. |
| C12 | Training, with a record you can print. | Academy gives a print-ready completion record and a register CSV | `docs/academy-certificate.html` / `academy-certificate.js` (print-ready, self-attested, CSV register); `docs/academy-register.html` | reword | First idea "training evidence for your audit" is not safe: the certificate is self-attested and "not an official certificate" (`docs/academy.html` footer). Never say "certified" or "accepted by supervisors". |
| X6 | AMLR Art. 12: "...training programmes ... shall be duly documented." | Verbatim law | Law file Art. 12, second paragraph; `docs/data/academy/curriculum.json` evidence.art12 | ok | Learner name on the sheet is fictional ("A. Sample"). |
| C13 | From the law to the control. In one place. | Law text, obligations, controls, tests, board, topics, calendar and training sit in one product | `docs/index.html` ("Compliance. From the law to the control."); pages listed above, cross-linked via `site-nav.js` | ok (soft) | True for the prototype on one device. Not multi-user, no backend (maturity: Data layer). Do not add "for your whole team" or "replaces your spreadsheets". |
| C14 | Max | Working product name | Brief; the site menu is named "Max" (`docs/site-nav.js`), topics kicker "Max · Topics" (`docs/topics.html`); landing CTA "Try Max" | ok | Do not show "RegRadar" anywhere, including page titles visible in any UI capture (the real pages' `<title>` and kickers say RegRadar: rebuild the UI in the film rather than screenshot it, or mask). |
| C15 | Prototype with sample data. Not legal advice. | Honest status | `VISION.md` principle 6; page notes | ok | |

## Claims deliberately left out

| Idea | Why it is out |
|---|---|
| "AI-powered", the assistant answering | Max assistant 5% (cat animation only, no chat): `strategy/maturity.md` |
| "15 EU texts in three languages" | True (`docs/data/laws/index.json`, EN/FR/NL files) but only 12 obligations are mapped; a big number invites the wrong reading. Could return in a later cut. |
| "40 subtopics, 114 extracts" | True (`docs/data/topics.json`) but adds numbers without adding meaning. |
| "8 of 12 covered" (landing hero) | Sample-data count; reads as a real coverage figure in a film. |
| "Audit-ready", "inspection pack" | Audit pack (E9) is "to build" (`VISION.md`). |
| "Replaces Excel / your GRC" | Vision, not today. |
| Any regulator, customer, partner logo or quote | None exist. |
