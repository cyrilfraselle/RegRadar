# Film 05 · Report, do not tell (module `suspicious-transaction-reports`)

Script v1, 2026-11-19. **Phase 1 of the script review gate** (`academy/SCRIPT_REVIEW.md`): brief,
storyboard and claim ledger. **Nothing is built.** Still to do: the independent check (gate step 3)
and the owner's written approval recorded in `academy/films/SIGNOFF.md` (gate step 5).

Status: self-checked by the author against `docs/data/laws/32024R1624_EN.json` (AMLR) and
`docs/data/laws/32024L1640_EN.json` (AMLD6). Independent check: **pending**. Owner sign-off: **pending**.
Every verdict below is the author's own and must be re-run by someone else.

## Brief

| | |
|---|---|
| Module | `suspicious-transaction-reports` (explainer, questions and games already on the path) |
| Length | 60 s |
| Audience | A new analyst at a payment, e-money or crypto firm who will see alerts and may have to escalate one. |
| One message | **A suspicion is enough to report: you do not need proof. The compliance officer reports to the FIU, the firm holds the transaction while it does, and nobody tells the customer.** |
| Situation shown | **One example scenario**, named in the first caption: a fictional customer account at Orrin (fictional crypto-asset service provider, same firm as film 04) that receives many small deposits from unrelated senders and sends everything to a new address within hours. Typology: worded as "a pattern commonly linked to laundering, a warning sign, not proof". |
| Teaching models | The internal route (analyst escalates to the compliance officer) is one common set-up, not a statutory step; it is worded "in this example". |
| Fictional | Orrin, the customer ("Customer K"), the deposits, every amount and address. HUD and end card say "Fictional example". |
| Not covered | Reporting by lawyers and other professionals through self-regulatory bodies (Art. 70), the 5-working-day reply deadline to FIU requests (Art. 69(1)), partnerships for information sharing (Art. 69(8)), the exceptions to the no-tipping-off rule other than a pointer (Art. 73(3) to (6)), the status and content of AMLA's implementing standards on the reporting format (Art. 69(3)). |
| Caption load | About 330 words in 60 s (about 5.5 words a second, below films 02 to 04). No voice-over. |
| Chapters | Hook 0:00 · When to report 0:06 · What builds a suspicion 0:14 · Who reports 0:22 · Hold the transaction 0:30 · Do not tell 0:40 · Protection 0:47 · What goes wrong 0:52 · End card 0:57 |

## Storyboard

Same world, palette and camera grammar as films 01 to 04 (`academy/films/README.md`), always a dark
film, captions in the DOM, sound off by default, reduced-motion stills. Central object: **the alert**,
a card that becomes a report, with a padlock on the customer's transfer and a closed door between
the firm and the customer.

### S1 · Hook · 0:00 to 0:06
- **Visual**: a ledger of small deposit comets from many different senders into one account card `Customer K · fictional`; they merge and leave to a new address card. A warm `!` on the account.
- **Kinetic type**: `Suspicion` / `is enough.`
- **Caption C1**: One example scenario: at Orrin, a fictional crypto-asset service provider, Customer K receives many small deposits from unrelated senders and sends everything to a new address within hours. A pattern commonly linked to laundering. A warning sign, not proof.

### S2 · When to report · 0:06 to 0:14
- **Visual**: the alert card opens into three tiles: `Knows` · `Suspects` · `Reasonable grounds to suspect`, then two tags: `Any amount` · `Attempts count`, and a third `Could not finish due diligence`.
- **Kinetic type**: `01 · WHEN` / `No proof needed.`
- **Caption C2**: The firm reports to the Financial Intelligence Unit, the FIU, when it knows, suspects or has reasonable grounds to suspect that funds or activities are the proceeds of criminal activity or related to terrorist financing, whatever the amount. Attempted transactions and suspicions arising from the inability to complete due diligence are included.

### S3 · What builds a suspicion · 0:14 to 0:22
- **Visual**: six small boxes around the account: `Customer and counterparts` · `Size and nature` · `Methods and patterns` · `Links between transactions` · `Origin, destination or use of funds` · `Fit with what we know`; they converge into one box `Reasoned suspicion`.
- **Kinetic type**: `02 · WHAT BUILDS IT` / `Facts, not a feeling.`
- **Caption C3**: A suspicion rests on facts: the customer and its counterparts, the size and nature of the activity, its methods and patterns, links between transactions, where funds come from, go and are used, and whether it fits what the firm knows of the customer, including the risk profile.

### S4 · Who reports · 0:22 to 0:30
- **Visual**: the alert card moves from `Analyst` to `Compliance officer` (labelled `this example`), who stamps it and sends it to a card `FIU of the Member State where the firm is established`.
- **Kinetic type**: `03 · WHO` / `The compliance officer sends it.`
- **Caption C4**: In this example the analyst escalates to the compliance officer. The compliance officer is responsible for reporting suspicious transactions and transmits the report to the FIU of the Member State where the firm is established.

### S5 · Hold the transaction · 0:30 to 0:40
- **Visual**: Customer K's transfer button gets a padlock; a clock shows `3 working days` starting at `Report sent`. Two exits: `FIU instructions → follow them` and `No instruction in 3 working days → may proceed after assessing the risks`. A thin side strip: `Cannot hold it? Tell the FIU immediately after`.
- **Kinetic type**: `04 · HOLD` / `Report first, then move.`
- **Caption C5**: The firm refrains from carrying out transactions it knows or suspects to be related to proceeds of criminal activity or terrorist financing until it has reported and followed any specific instructions. If the FIU has not instructed otherwise within 3 working days of the report, it may proceed after assessing the risks. If holding the transaction is not possible, or would likely frustrate efforts to pursue the beneficiaries, it informs the FIU immediately afterwards.

### S6 · Do not tell · 0:40 to 0:47
- **Visual**: a closed door between the firm and Customer K; three speech bubbles bounce off it: `We assessed your activity` · `We sent a report` · `An analysis may be under way`. An open side door to `Competent authorities` with the tag `disclosure to authorities is not covered by the ban`.
- **Kinetic type**: `05 · DO NOT TELL` / `Not the customer. Not anyone else.`
- **Caption C6**: The firm and its staff must not tell the customer or other third persons that the activity is being assessed, that information is being, will be or has been sent to the FIU, or that a money laundering or terrorist financing analysis is or may be carried out. The ban does not apply to disclosures to competent authorities, and limited other exceptions exist.

### S7 · Protection · 0:47 to 0:52
- **Visual**: a shield over the report card and over the compliance officer and analyst silhouettes.
- **Kinetic type**: `06 · PROTECTED` / `Good faith is covered.`
- **Caption C7**: A report made to the FIU in good faith does not breach confidentiality restrictions and does not bring liability of any kind, even if illegal activity did not actually occur. The compliance officer and staff involved in these tasks must be protected against retaliation, discrimination and other unfair treatment.

### S8 · What goes wrong · 0:52 to 0:57
- **Visual**: warm chips under `ONE WAY IT GOES WRONG`: `Waiting for proof` · `Telling the customer`. A thin rule: `Serious, repeated or systematic breaches → fines`.
- **Kinetic type**: `WHAT GOES WRONG` / `Waiting. Telling.`
- **Caption C8**: Two ways it goes wrong: waiting for proof before reporting, and telling the customer. Serious, repeated or systematic breaches of the reporting rules can be fined.

### S9 · End card · 0:57 to 1:00
- **Kinetic type**: `Report. Hold. Do not tell.` RegRadar mark. Footers: `AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027` and `Fictional example. Not legal advice.`
- **Caption C9**: Report on suspicion, hold the transaction, do not tell. The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027.

### Stills (reduced motion)

| t | Heading | Still caption |
|---|---|---|
| 0:04 | One example | Customer K, a fictional account at Orrin, receives many small deposits and empties them within hours. A warning sign, not proof. |
| 0:11 | When to report | Knows, suspects or has reasonable grounds to suspect: any amount, attempts included. |
| 0:27 | Who reports | In this example the compliance officer sends the report to the FIU. |
| 0:36 | Hold the transaction | Refrain until reported and any FIU instructions are followed; 3 working days. |
| 0:44 | Do not tell | Not the customer, not other third persons. |
| 1:00 | Report. Hold. Do not tell. | The AMLR applies from 10 July 2027. |

## Claim ledger

AMLR = Regulation (EU) 2024/1624, `docs/data/laws/32024R1624_EN.json`; AMLD6 = Directive (EU) 2024/1640,
`docs/data/laws/32024L1640_EN.json`. Text in “curly quotes” in the Source column is quoted from the JSON.
Verdicts are the author's self-check, to be replaced by the independent reviewer's.

| # | Wording on screen | Where | Source checked | Verdict (self) | Notes |
|---|---|---|---|---|---|
| 1 | One example scenario: at Orrin, a fictional crypto-asset service provider, Customer K receives many small deposits from unrelated senders and sends everything to a new address within hours. | C1, S1 | Invented. Orrin's scope as in film 04, row 1: AMLR Art. 2(1), point (6)(i) and Art. 3(2) | ok, fictional | Check that the scope reference in film 04 still stands. |
| 2 | A pattern commonly linked to laundering. A warning sign, not proof. | C1 | Typology, not law (practice wording) | ok, typology | Worded "commonly" and "not proof". Source for the typology to be named by the reviewer or cut. |
| 3 | The firm reports to the Financial Intelligence Unit, the FIU, | C2 | AMLR Art. 69(1)(a): “reporting to the FIU, on their own initiative” | ok | |
| 4 | when it knows, suspects or has reasonable grounds to suspect that funds or activities are the proceeds of criminal activity or related to terrorist financing, | C2, tiles | AMLR Art. 69(1)(a): “knows, suspects or has reasonable grounds to suspect that funds or activities, regardless of the amount involved, are the proceeds of criminal activity or are related to terrorist financing or criminal activity” | ok after reword | The article also says "or criminal activity" after terrorist financing; the caption shortens. Reviewer: is the shortening acceptable? |
| 5 | whatever the amount. / `Any amount` | C2, tag | Art. 69(1)(a): “regardless of the amount involved” | ok | |
| 6 | Attempted transactions and suspicions arising from the inability to complete due diligence are included. / `Attempts count` · `Could not finish due diligence` | C2, tags | Art. 69(1), second subparagraph: “All suspicious transactions, including attempted transactions and suspicions arising from the inability to conduct customer due diligence shall be reported” | ok | |
| 7 | No proof needed. / `Suspicion is enough.` | S1, S2 headlines | Art. 69(1)(a) (suspicion or reasonable grounds as the test); Art. 72 (“regardless of whether illegal activity actually occurred”) | ok, summary | Slogan; the test is stated precisely in row 4. |
| 8 | A suspicion rests on facts: the customer and its counterparts, the size and nature of the activity, its methods and patterns, links between transactions, where funds come from, go and are used, and whether it fits what the firm knows of the customer, including the risk profile. / six boxes | C3, S3 | Art. 69(2), second subparagraph: “based on the characteristics of the customer and their counterparts, the size and nature of the transaction or activity or the methods and patterns thereof, the link between several transactions or activities, the origin, destination or use of funds, or any other circumstance known to the obliged entity, including the consistency of the transaction or activity with the information obtained pursuant to Chapter III including the risk profile of the client” | ok after reword | The article ends "or any other circumstance"; the caption shows six listed factors, not a closed list. Reviewer: add "or any other circumstance"? |
| 9 | Facts, not a feeling. | S3 headline | Summary of row 8 | ok, slogan | |
| 10 | In this example the analyst escalates to the compliance officer. | C4, S4 `this example` | Not law. Art. 11(2) sets the compliance officer; the internal route for analysts is not prescribed in the cited provisions | ok, teaching model | Worded "in this example". |
| 11 | The compliance officer is responsible for reporting suspicious transactions and transmits the report to the FIU of the Member State where the firm is established. | C4, S4 | Art. 11(2): “The compliance officer shall also be responsible for reporting suspicious transactions to the FIU in accordance with Article 69(6)”; Art. 69(6): “shall transmit ... to the FIU of the Member State in whose territory the obliged entity transmitting the information is established” | ok | |
| 12 | The firm refrains from carrying out transactions it knows or suspects to be related to proceeds of criminal activity or terrorist financing until it has reported and followed any specific instructions. | C5, S5 | Art. 71(1): “shall refrain from carrying out transactions which they know or suspect to be related to proceeds of criminal activity or to terrorist financing until they have submitted a report ... and have complied with any further specific instructions from the FIU or other competent authority” | ok | Note: the test here is "know or suspect", narrower than the "reasonable grounds" in Art. 69(1)(a). Caption follows Art. 71. |
| 13 | If the FIU has not instructed otherwise within 3 working days of the report, it may proceed after assessing the risks. / `3 working days` | C5, S5 | Art. 71(1): “may carry out the transaction concerned after having assessed the risks of proceeding with the transaction if they have not received instructions to the contrary from the FIU within 3 working days of submitting the report” | ok | |
| 14 | If holding the transaction is not possible, or would likely frustrate efforts to pursue the beneficiaries, it informs the FIU immediately afterwards. / `Cannot hold it? Tell the FIU immediately after` | C5, S5 | Art. 71(2): “Where it is not possible ... to refrain ... or where refraining would be likely to frustrate efforts to pursue the beneficiaries of a suspected transaction, the obliged entity shall inform the FIU immediately after carrying out the transaction” | ok | |
| 15 | The firm and its staff must not tell the customer or other third persons that the activity is being assessed, that information is being, will be or has been sent to the FIU, or that a money laundering or terrorist financing analysis is or may be carried out. / three bubbles | C6, S6 | Art. 73(1): “shall not disclose to the customer concerned or to other third persons the fact that transactions or activities are being or have been assessed in accordance with Article 69, that information is being, will be or has been transmitted in accordance with Article 69 or 70 or that a money laundering or terrorist financing analysis is being, or may be, carried out” | ok | The article names “Obliged entities and their directors, employees, or persons in comparable positions, including agents and distributors”; "the firm and its staff" shortens. |
| 16 | The ban does not apply to disclosures to competent authorities, and limited other exceptions exist. / `disclosure to authorities is not covered by the ban` | C6, S6 | Art. 73(2): not applicable to “disclosures to competent authorities and to self-regulatory bodies where they perform supervisory functions, or to disclosure for the purposes of investigating and prosecuting”; Art. 73(3) to (6) other derogations | ok after reword | Caption names only competent authorities; the article adds supervising self-regulatory bodies and investigation or prosecution. |
| 17 | A report made to the FIU in good faith does not breach confidentiality restrictions and does not bring liability of any kind, even if illegal activity did not actually occur. | C7, S7 | Art. 72: “shall not constitute a breach of any restriction on disclosure of information imposed by contract or by any legislative, regulatory or administrative provision, and shall not involve the obliged entity or its directors or employees in liability of any kind even in circumstances where they were not precisely aware of the underlying criminal activity and regardless of whether illegal activity actually occurred” | ok after reword | Reviewer: "of any kind" is the article's wording; keep. The caption omits that Art. 72 applies to reports under Arts 69 and 70. |
| 18 | The compliance officer and staff involved in these tasks must be protected against retaliation, discrimination and other unfair treatment. | C7, S7 | Art. 69(7): “protected against retaliation, discrimination and any other unfair treatment” for the compliance officer and “any employee or person in a comparable position, including agents and distributors, involved in the performance of the tasks” | ok | |
| 19 | Two ways it goes wrong: waiting for proof before reporting, and telling the customer. | C8, chips | Judgement, contrasts with Art. 69(1)(a) and Art. 73(1) | ok, judgement | "Two ways", not "the usual ways": no frequency claim. |
| 20 | Serious, repeated or systematic breaches of the reporting rules can be fined. / `Serious, repeated or systematic breaches → fines` | C8 | AMLD6 Art. 55(1)(c): pecuniary sanctions for “serious, repeated or systematic breaches” of “Chapter V (Reporting obligations)” of the AMLR | ok | Art. 73 is tagged “Chapter V — REPORTING OBLIGATIONS” in the stored text (checked by the author). |
| 21 | Report on suspicion, hold the transaction, do not tell. / `Report. Hold. Do not tell.` | C9, S9 | Summary of rows 3 to 16 | ok, slogan | "Hold" is the Art. 71 duty, which is conditional (rows 13, 14). |
| 22 | The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027. | C9, footer | AMLR Art. 90: “It shall apply from 10 July 2027” (10 July 2029 for the entities in Art. 3(3)(n) and (o)) | ok | |
| 23 | Customer K · Orrin · small deposits · new address | S1 canvas | Invented | ok, fictional | No amount appears and none is a threshold. |

## Open points for the independent check and the owner

1. Row 4 and row 8: shortenings of the "criminal activity" limb and of the "any other circumstance" limb.
2. Row 12: the Art. 71 hold applies where the firm "knows or suspects", which is narrower than the Art. 69 reporting test. Is one caption enough, or should the film say so?
3. Row 20: Art. 73 carries the Chapter V tag in the stored text; the reviewer re-checks.
4. The AMLA implementing standards on the reporting format (Art. 69(3), due 10 July 2026) and guidelines on indicators of suspicious activity (Art. 69(5), due 10 July 2027): their status is not in this repo, so the film does not mention them.
5. Owner: approve, change or stop this script in `academy/films/SIGNOFF.md` before anything is built.
