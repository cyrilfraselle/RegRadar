# Obligations review, batch 01 (queue ranks 1 to 25, tier 0)

Reviewer: CHECK stream (did not write the drafts). Source: `docs/data/laws/32024R1624_EN.json`, Arts 10, 11, 12. Draft records: `docs/data/obligations-draft.json`. Nothing here is promoted to `obligations.json`; the MAX builder does that from these verdicts.

Verdict key: **yes** = register as an obligation; **merge X** = fold into unit X; **no** = not a register item (reason given). "Verified" = existing register ids (`AMLR-art10`, `AMLR-art11`, `AMLR-art12`) already cover the article, so promotion means refining, not adding, unless the owner wants paragraph-level rows.

## Summary
- 25 units reviewed: **13 yes**, **11 merge**, **1 no**, 0 split.
- `binds` wrong or incomplete: 2 (`art10-p2-s2`, `art12-p1-s2`), 1 doubtful (`art10-p2-s3`).
- Text check: 24 of 25 verbatim at once; `art11-p1-s2` differs only by the apostrophe (law uses ’, draft uses '). Not a content error; normalise in the verbatim test.
- Missing from the draft (extraction gaps, see end): Art. 11(2) group-appointment sentence and removal notification to the management body; Art. 11(7) first and second sentences.
- Suggested register granularity: Art 10 = 2 rows, Art 11 = 7 rows, Art 12 = 1 row (or 2).

## Not a clean "yes" first

| id | locator | verdict | issue | proposed fix |
|---|---|---|---|---|
| AMLR-art10-p2-s2 | Art. 10(2) | no (merge art10-p2) | `binds` says `supervisor`. The sentence ("It shall be made available to supervisors upon request") obliges the obliged entity; the supervisor is the beneficiary, not the bound party. | Merge into art10-p2; binds `obliged_entity`. |
| AMLR-art12-p1-s2 | Art. 12 | merge art12-p1 | `binds` is `unspecified`: rule failed on "The measures referred to in the first paragraph shall include". The duty falls on obliged entities. | binds `obliged_entity`. |
| AMLR-art10-p2-s3 | Art. 10(2) | merge art10-p2 | `binds` lists `supervisor`; the supervisory function of the management body is not the supervisor (authority). Probably a rule hit on the word "supervisory". Depends on art10-p2 ("It" = the assessment). | binds `obliged_entity` only; note the body is internal. |
| AMLR-art11-p2-s3 | Art. 11(2) | merge art11-p2 | Conditional: only entities subject to Art. 6 of Directive (EU) 2024/1640 checks or other Union acts. Depends on Member State law and a directive not in repo. | Keep as condition inside the compliance-officer row. |
| AMLR-art11-p2-s6 | Art. 11(2) | yes (own row) or merge art11-p2 | Sentence is the second of the removal sub-paragraph; the preceding sentence ("may only be removed following prior notification to the management body") is not in the draft. Do not register s6 without it. | One row "Compliance officer removal": notify management body first, then the supervisor, saying whether it relates to AMLR tasks. |
| AMLR-art11-p7-s3 | Art. 11(7) | merge, and add missing sentences | Reads out of context: "that person" refers to the single-person entity. Depends on the missing first two sentences. | See "Missing units". |

## All units

| id | locator | register? | binds ok? | topic tags | proposed plain-language "what to do" | suggested register title | dependencies |
|---|---|---|---|---|---|---|---|
| AMLR-art10-p1 | Art. 10(1) | yes | ok | gov ok | Identify and assess your ML/TF risks, and the risk of not implementing or evading targeted financial sanctions, using at least the listed sources (Annex I to III, EU and national risk assessments, customer base). | Business-wide risk assessment | Annexes I to III; Directive (EU) 2024/1640 Arts 7 and 8 (not in repo) |
| AMLR-art10-p1-s2 | Art. 10(1) | yes (own row) | ok | gov ok | Before launching a new product, service, channel, technology or entering a new customer segment or geography, assess the ML/TF risks and put in place measures to manage them. | Risk assessment before new products and markets | none |
| AMLR-art10-p2 | Art. 10(2) | yes | ok | gov ok | Document the business-wide risk assessment, keep it up to date and review it regularly, including after events that significantly change risk. Provide it to the supervisor on request. | Keep the risk assessment current | refers to art10-p1 |
| AMLR-art10-p2-s2 | Art. 10(2) | merge art10-p2 | wrong (see above) | gov ok | (in art10-p2) | | art10-p2 |
| AMLR-art10-p2-s3 | Art. 10(2) | merge art10-p2 | doubtful | gov ok | Have the compliance officer draw it up and the management body (management function) approve it; tell the supervisory function where one exists. | (in art10-p2, or separate "Approval of the assessment") | art10-p2, art11 |
| AMLR-art11-p1 | Art. 11(1) | yes | ok | gov ok | Appoint one member of the management body as compliance manager, responsible for compliance with the AMLR, Regulation (EU) 2023/1113 and supervisory acts. | Compliance manager | Reg. (EU) 2023/1113 |
| AMLR-art11-p1-s2 | Art. 11(1) | merge art11-p1 | ok | gov ok | Make sure internal policies, procedures and controls fit your risk exposure and are implemented. | (in Compliance manager) | none |
| AMLR-art11-p1-s3 | Art. 11(1) | merge art11-p1 | ok | gov ok | Make sure enough people and means are allocated to that. | (in Compliance manager) | art11-p1-s2 ("to that end") |
| AMLR-art11-p1-s4 | Art. 11(1) | merge art11-p1 | ok | gov ok | Receive information on significant weaknesses in the policies, procedures and controls. | (in Compliance manager) | art11-p1-s2 |
| AMLR-art11-p1-s5 | Art. 11(1) | merge art11-p1 | ok | gov ok | Where the management body decides collectively, assist and advise it and prepare its decisions. | (in Compliance manager) | conditional on collective body |
| AMLR-art11-p2 | Art. 11(2) | yes | ok | gov ok | Have a compliance officer, appointed by the management body, senior enough, responsible for day-to-day AML/CFT policies, procedures and controls (including targeted financial sanctions) and contact point for authorities. | Compliance officer | none |
| AMLR-art11-p2-s2 | Art. 11(2) | merge art11-p2 | ok | gov, str suggested | The compliance officer reports suspicious transactions to the FIU (Art. 69(6)). | (in Compliance officer; cross-link to the suspicious-transaction reporting row) | Art. 69(6) |
| AMLR-art11-p2-s3 | Art. 11(2) | merge art11-p2 | ok | gov ok | If you are subject to fit-and-proper style checks under Art. 6 of Directive (EU) 2024/1640 or other Union acts, the compliance officer is checked too. | (in Compliance officer) | Directive (EU) 2024/1640 Art. 6, not in repo; applicability depends on those acts |
| AMLR-art11-p2-s6 | Art. 11(2) | yes (own row) | ok | gov ok | If you remove the compliance officer, tell the management body beforehand and notify the supervisor, saying whether it relates to AMLR tasks. | Removal of the compliance officer | missing preceding sentence (see end) |
| AMLR-art11-p3 | Art. 11(3) | yes | ok | gov ok | Give the compliance functions adequate staff and technology, proportionate to size, nature and risk, and the power to propose any measures needed. | Resources and powers of compliance functions | none |
| AMLR-art11-p4 | Art. 11(4) | yes | ok | gov ok | Protect the compliance officer from retaliation, discrimination and unfair treatment, and keep their decisions free of undue commercial influence. | Protection of the compliance officer | none |
| AMLR-art11-p5 | Art. 11(5) | yes | ok | gov ok | Make sure the compliance officer and the head of audit can report directly and independently to the management body and warn it of specific risk developments. | Direct reporting line | Art. 9(2)(b) audit function |
| AMLR-art11-p5-s2 | Art. 11(5) | merge art11-p5 or own row | ok | gov ok | Make sure everyone involved in implementing the AMLR has access to the information and data they need. | Access to information | none. Distinct duty; own row is defensible |
| AMLR-art11-p6 | Art. 11(6) | yes | ok | gov ok | The compliance manager reports regularly to the management body on how the policies, procedures and controls are implemented. | Reporting to the management body | none |
| AMLR-art11-p6-s2 | Art. 11(6) | merge art11-p6 | ok | gov ok | At least once a year (more often where appropriate) submit the officer's implementation report and keep the body informed of review outcomes. | (in Reporting to the management body) | art11-p6. "Once a year" is the text, not a teaching assumption |
| AMLR-art11-p6-s3 | Art. 11(6) | merge art11-p6 | ok | gov ok | Fix identified deficiencies in good time. | (in Reporting to the management body) | art11-p6 |
| AMLR-art11-p7-s3 | Art. 11(7) | yes (own row, with the two missing sentences) | ok | gov ok | If you are a natural person or your activities are carried out by one person only, that person does the compliance tasks. | Single-person obliged entities | depends on missing sentences |
| AMLR-art12-p1 | Art. 12 | yes | ok | train ok | Make sure staff (incl. agents and distributors) whose role requires it know the AMLR, Regulation (EU) 2023/1113, supervisory acts, your risk assessment and your policies, including personal data processing. | Awareness of requirements | Reg. (EU) 2023/1113 |
| AMLR-art12-p1-s2 | Art. 12 | merge art12-p1 | wrong (`unspecified`) | train ok | Include ongoing training to recognise operations possibly linked to ML/TF and how to act. | (in Awareness of requirements) | art12-p1 |
| AMLR-art12-p1-s3 | Art. 12 | merge art12-p1 | ok | train ok | Training must fit the role and the entity's risks and be documented. | (in Awareness of requirements) | art12-p1 |

Counting: yes = art10-p1, art10-p1-s2, art10-p2, art11-p1, art11-p2, art11-p2-s6, art11-p3, art11-p4, art11-p5, art11-p6, art11-p7-s3, art12-p1, art11-p5-s2 (own row) = 13. no (folded: binds error) = art10-p2-s2. Merge = remaining 11.

## Missing units (not in the draft, in the law text)
- Art. 11(2): "Where justified by the size of the obliged entity and the low risk of its activities, an obliged entity that is part of a group may appoint as its compliance officer an individual who performs that function in another entity within that group." A permission with conditions, not a duty; mention in the compliance officer row.
- Art. 11(2): "The compliance officer may only be removed following prior notification to the management body in its management function."
- Art. 11(7) s1: compliance manager and officer may be the same natural person where nature, risk, complexity and size justify it; functions may be cumulated with other functions. A permission with a condition; mention with the single-person row.
- Art. 11(1) is cited in the draft only through `AMLR Art. 10(1)` style locators; sentences 11(2) s4 and s5 and 11(7) s1, s2 have gaps in the numbering. Suggest the extractor be re-run to look for permission clauses ("may") that qualify obligations.

## Other notes
- Tags: Art. 10 and 11 `gov` fits `topics.json`. Art. 11(2) s2 could also carry `str`. No tag from the topics list is missing for Art. 12 (`train`).
- Art. 10(1) includes "risks of non-implementation and evasion of targeted financial sanctions": link with the `sanctions` topic only as context; the duty here is part of the AMLR risk assessment.
- Wording caution for plain-language lines: "at least once a year" is in Art. 11(6); do not turn the review frequency of the assessment (Art. 10(2): "regularly reviewed") into a fixed interval; the text sets none.
- Wording caution: the compliance manager is a member of the management body in its management function; the compliance officer is a separate role (may be the same person only where Art. 11(7) allows).

## What I could not verify
- Directive (EU) 2024/1640 Arts 6, 7, 8 and 37(4) and Art. 9(2)(b), Art. 69(6) content: only their citation was checked, not their text (Directive not in repo; no external fetch made).
- Whether the existing verified ids' summaries match these paragraph-level rows (not compared).
- Binds and topic rules were reviewed by reading the text, not by re-running the extractor.

## Repository checks run (on main at 2ae6f5f, before this commit)
`node academy/verify.mjs` ok; `node tests/topics.test.mjs` 12/12; `python3 build_obligations.py` wrote 21 obligations (output not committed); `node tests/spine.test.mjs` 38/38.
