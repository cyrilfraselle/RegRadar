# Fact-check ledger: Academy rounds (Spot it games and Decide scenarios)

Data: `docs/data/academy/rounds.json`. Gate: `academy/SCRIPT_REVIEW.md` (applied to games as well as films).
Every card reason and every Decide consequence below is the exact wording shown on screen (this table is
generated from the data, so the words checked are the words shown). Sources are AMLR, Regulation (EU)
2024/1624, as held in `docs/data/laws/32024R1624_EN.json`, unless stated. Law quotes in the round
summaries are checked verbatim by `node academy/verify.mjs`, which also fails if a card or option is
missing from this ledger.

Wording rules applied: typology and teaching-model statements say "commonly", "one example" or
"a teaching example"; practice that is not law says "common practice" or names the firm's procedure;
no "always" or "never" unless the text says so; no thresholds or numbers without a source. All people,
companies, list entries, banks (CF Bank) and amounts are fictional and labelled as such on screen.

**Status:** self-checked by the author (2026-10-16). Independent check (step 3 of the gate) done
on 2026-10-17 by a reviewer who did not write the content: 1 wrong (g-ubo-pick/c2), 2 disputable
(d-pep/b, g-sanctions-match/c5), the rest rewordings. Every finding was re-checked against
`docs/data/laws/` and applied; rows changed by the review say "after review", "CORRECTED" or "CHANGED".
Owner sign-off (step 5): **pending**.

The AMLR applies from 10 July 2027 (Art. 90; 10 July 2029 for the entities in Art. 3, points (3)(n) and
(o)). The rounds say so in the Spot it and Decide beats and in the Context game's law box.

Verdicts: `ok` = matches the source in meaning (or verbatim where quoted); `ok, teaching model` or
`ok, practice wording` = not law, worded as such; `interpretation` = a reasonable reading the owner
should confirm. The two earlier interpretation rows are resolved: alert closures are now worded
conditionally (`g-tm-triage/p`, `d-tm/a`, `d-tm/b`), and refusing a PEP relative by category is
scored `poor` (`d-pep/b`).


## Game `g-context-stages`: Three stages (sort, lesson `context`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-context-stages/p` | Cash entering the financial system is what the model calls placement. One example: a cash-heavy business used as cover. | none shown | Teaching model (placement, layering, integration); FATF typologies as further reading | ok, teaching model, worded "what the model calls" and "one example" |
| `g-context-stages/c1` | Getting cash into accounts is placement. Splitting it into small amounts is often called structuring: one common example. Monitoring looks at the pattern, and for occasional transactions the due diligence threshold counts linked transactions together. | Art. 19 para. 1(b) | AMLR Art. 34(2)(c) (pattern) and Art. 19(1)(b): occasional transactions counted 'in a single operation or through linked transactions'. 'Structuring' is a common typology term | ok after review (now names monitoring for accounts and limits the threshold point to occasional transactions) |
| `g-context-stages/c2` | Moving money through layers of companies and countries to blur the trail is commonly called layering. Transactions that are complex, or that have no apparent economic or lawful purpose, must be examined. | Art. 34 para. 2 | Teaching model; AMLR Art. 34(2)(a) and (d) are alternatives ('at least one') | ok after review (was readable as a cumulative test) |
| `g-context-stages/c3` | Integration is the stage where the money returns looking legitimate, here as a loan that buys property. Asking about the source of funds, where necessary, is one way this gets noticed. | Art. 20 para. 1(f) | Teaching model; AMLR Art. 20(1)(f): ongoing monitoring 'including where necessary the source of funds' | ok after review (cite moved from Art. 25(c), which applies before the relationship) |
| `g-context-stages/c4` | Fast movement with no business behind it is a common layering pattern. The law asks for a closer look at transactions in an unusual pattern. | Art. 34 para. 2(c) | Teaching model; AMLR Art. 34(2)(c): transaction conducted in an unusual pattern | ok, teaching model worded "a common layering pattern" |
| `g-context-stages/c5` | The money now reaches the person as ordinary-looking income. One example of integration. | none shown | Teaching model only; no legal claim, no citation shown (the card says "a teaching example, not a legal rule") | ok, teaching model |
| `g-context-stages/c6` | Still about turning cash into something easier to move or deposit: one example of placement. Real cases often mix stages. | none shown | Teaching model only; "real cases often mix stages" is a judgement, hedged | ok, teaching model |

Summary text (What to remember):

- Placement, layering and integration is a common teaching model, not a legal definition.
- Real cases mix the stages. Due diligence, monitoring and reporting work across all of them.
- For occasional transactions, linked transactions are added together, so cutting one transaction into pieces does not avoid the threshold.
- The rules quoted here are the AMLR, which applies from 10 July 2027.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 19 para. 1(b); AMLR Art. 90.
Further reading named, not quoted: FATF publications on money laundering methods and trends (typologies).

## Game `g-basics-flags`: Fine or escalate? (flag, lesson `aml-basics`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-basics-flags/p` | It matches what the bank knows about the customer. Ongoing monitoring checks exactly that: are transactions consistent with the bank's knowledge of the customer? | Art. 26 para. 1 | AMLR Art. 26(1): transactions consistent with the knowledge of the customer | ok |
| `g-basics-flags/c1` | Unusually large against the profile. The law asks firms to examine the origin, destination and purpose of unusually large transactions. | Art. 34 para. 2(b) | AMLR Art. 34(2)(b): unusually large; examine origin, destination and purpose | ok; amounts fictional |
| `g-basics-flags/c2` | Consistent with the business the customer declared at onboarding. That consistency is what ongoing monitoring looks for. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-basics-flags/c3` | Several small amounts can be one pattern. Transactions conducted in an unusual pattern must be examined. | Art. 34 para. 2(c) | AMLR Art. 34(2)(c): unusual pattern. "Several small amounts can be one pattern" is a judgement, hedged with "can" | ok |
| `g-basics-flags/c4` | Complex, and no apparent economic purpose: each one is a condition for a closer look under the law. | Art. 34 para. 2(a), (d) | AMLR Art. 34(2)(a) and (d): complex nature; no apparent economic or lawful purpose | ok |
| `g-basics-flags/c5` | A regular, explained pattern that the bank already knows. Consistent with the customer's profile. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-basics-flags/c6` | Doubt about whether you are dealing with the customer at all is one of the situations where due diligence must be applied. | Art. 19 para. 1(f) | AMLR Art. 19(1)(f): doubts whether the person is the customer or authorised to act for the customer | ok |

Summary text (What to remember):

- Looks fine means consistent with what the bank knows about the customer.
- Complex, unusually large, unusual pattern, or no apparent purpose: examine where the money comes from, where it goes and why.
- Escalating is not accusing. It is asking a question the file cannot answer.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 34 para. 2.
Further reading named, not quoted: EBA Guidelines on ML/TF risk factors (EBA/GL/2021/02).

## Game `g-kyc-docs`: Spot the mismatch (doc, lesson `cdd-kyc`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-kyc-docs/p` | The year of birth on the card is 1984, the form says 1994. Place and full date of birth are core identification data. Ask before you accept. | Art. 22 para. 1(a) | AMLR Art. 22(1)(a)(ii): place and full date of birth. "Ask before you accept" is practice guidance consistent with Art. 19(1)(e) | ok |
| `g-kyc-docs/c1` | Ghent on the form, Liège on the card. Place of birth is part of the identification data. Ask, record the answer, and do not accept until it is resolved. | Art. 22 para. 1(a) | AMLR Art. 22(1)(a)(ii). "Do not accept until resolved" is practice guidance consistent with Arts 19(1)(e) and 21(1) | ok |
| `g-kyc-docs/c2` | A different first name may mean a different person. All names must be identified, and doubt about who you are dealing with is a reason to apply due diligence. | Art. 19 para. 1(f) | AMLR Art. 22(1)(a)(i): all names and surnames; Art. 19(1)(f): doubts about who you interact with | ok |
| `g-kyc-docs/c3` | The person who signed is not among the legal representatives on the extract. The bank must verify that anyone acting for the customer is authorised, and identify them. | Art. 20 para. 1(i) | AMLR Art. 20(1)(i): verify that any person acting on behalf of the customer is authorised; Art. 22(1)(b)(iii): names of legal representatives | ok |
| `g-kyc-docs/c4` | The form says Belgium, the extract says Cyprus. The country of creation is part of the identification data for a legal entity. Ask why before going further. | Art. 22 para. 1(b) | AMLR Art. 22(1)(b)(ii): country of creation of a legal entity | ok |
| `g-kyc-docs/c5` | It may simply be a second nationality, and the law asks for nationalities (plural). So this mismatch is a question: ask, and record both. | Art. 22 para. 1(a) | AMLR Art. 22(1)(a)(iii): 'nationalities' (plural) | ok after review (was 'all nationalities', not the text's word) |

Summary text (What to remember):

- Check what the customer told you against an identity document, passport or equivalent (or qualifying electronic identification) and, where relevant, reliable and independent sources.
- For a person: all names, place and full date of birth, nationalities, address. For a company: name, legal form, office, country, representatives.
- A mismatch is a question, not a verdict: ask, record the answer, and where doubts remain apply due diligence again.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 22 para. 1(a); AMLR Art. 19 para. 1(e).
Further reading named, not quoted: FATF Recommendation 10 (customer due diligence).

## Game `g-ubo-pick`: Find the owner (pick, lesson `beneficial-ownership`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-ubo-pick/p` | Lotte holds 60%, which is 25% or more. None of the small shareholders comes close. | Art. 52 para. 1 | AMLR Art. 52(1): 25 % or more | ok |
| `g-ubo-pick/c1` | Ines holds 30% directly. Hugo holds 50% indirectly (100% of the holding × 50%). Pieter's 20% is under 25%, and nothing here shows control by other means. | Art. 52 para. 1 | AMLR Art. 52(1): indirect ownership calculated by multiplying along the chain. Hugo: 100% x 50% = 50%. Also consistent with Art. 54 | ok, arithmetic checked |
| `g-ubo-pick/c2` | Solace Holding owns 60% of Solace Travel, so it controls it (50% plus one). When a company in the chain controls the next one, the people with 25% or more of that controlling company are beneficial owners: Mark (60%) and Rania (40%). Multiplying would give Rania only 24%; this is the exception to the multiplication rule. | Art. 54 para. (b) | AMLR Art. 52(1) ends 'unless Article 54 applies'; Art. 53(2)(c): control through ownership = 50 % plus one; Art. 54(b): persons with an ownership interest (25 % or more, Art. 52(1)) in the entity that controls the customer. Solace Holding holds 60 % of the customer, so it controls it; Mark (60 %) and Rania (40 %) of the holding are both beneficial owners | CORRECTED after independent review: answer key was Mark only (wrong); now Mark and Rania |
| `g-ubo-pick/c3` | No one reaches 25%, but the right to appoint or remove a majority of the board is control via other means. Control is checked in parallel to ownership. | Art. 53 para. 3(b) | AMLR Art. 53(3)(b): right to appoint or remove a majority of the board; Art. 51, second paragraph: control identified in parallel to ownership | ok |
| `g-ubo-pick/c4` | After exhausting all possible means, no natural person qualifies. Record that no beneficial owner was identified, and identify (and verify) the senior managing officials. They are not recorded as beneficial owners. | Art. 22 para. 2 | AMLR Art. 22(2): after exhausting all possible means, record that no beneficial owner was identified, identify and verify the senior managing officials | ok |

Summary text (What to remember):

- Look through companies to the natural person who ultimately owns or controls.
- 25% or more, direct or indirect. Multiply along the chain and add the chains together, unless Article 54 applies: when a company in the chain controls the next one, the people with 25% or more of that controlling company count too.
- Control by other means counts in parallel, for example the right to appoint or remove a majority of the board.
- No one found after all means? Record it and identify the senior managing officials.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 52 para. 1; AMLR Art. 53 para. 3(b); AMLR Art. 54 para. (b).
Further reading named, not quoted: FATF Recommendations 24 and 25 (transparency of legal persons and arrangements).

## Game `g-pep-sort`: Who counts? (sort, lesson `peps`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-pep-sort/p` | Ministers are named in the definition of a politically exposed person. | Art. 2 para. 34(a)(i) | AMLR Art. 2(34)(a)(i): ministers | ok |
| `g-pep-sort/c1` | A spouse of a PEP is a family member. Members of parliament are PEPs. | Art. 2 para. 35(a) | AMLR Art. 2(35)(a): spouse; Art. 2(34)(a)(ii): members of parliament | ok |
| `g-pep-sort/c2` | Members of supreme and constitutional courts are named in the definition. | Art. 2 para. 34(a)(iv) | AMLR Art. 2(34)(a)(iv): members of supreme courts, of constitutional courts | ok |
| `g-pep-sort/c3` | Siblings count only for heads of State or government, ministers and deputy or assistant ministers, and equivalent functions at Union level or in a third country. A parliament member's brother is not a family member under the EU definition. Your firm may still rate him higher risk. | Art. 2 para. 35(d) | AMLR Art. 2(35)(d): siblings for functions in point (34)(a)(i) and equivalent functions at Union level or in a third country | ok after review (equivalent-functions wording completed) |
| `g-pep-sort/c4` | A natural person known to have joint beneficial ownership of a legal entity with a PEP is a person known to be a close associate. Ambassadors are PEPs. | Art. 2 para. 36(a) | AMLR Art. 2(36)(a): a natural person 'known to have joint beneficial ownership of legal entities' with a PEP; Art. 2(34)(a)(vi): ambassadors | ok after review (card now says 'known to be a joint beneficial owner', not 'co-owns') |
| `g-pep-sort/c5` | The EU definition covers heads of local authorities with at least 50 000 inhabitants. A Member State can add other functions, so check your national list too. | Art. 2 para. 34(a)(viii) | AMLR Art. 2(34)(a)(viii): heads of local authorities with at least 50 000 inhabitants; (ix): other functions provided for by Member States | ok |
| `g-pep-sort/c6` | The definition covers someone who is or has been entrusted with a prominent function. For at least 12 months after someone leaves office, firms apply one or more of the enhanced measures in Art. 34(4), and longer while the risk remains. | Art. 45 para. 2 | AMLR Art. 2(34): 'is or has been entrusted'; Art. 45(2): one or more of the Art. 34(4) measures for not less than 12 months, until the risk no longer exists | ok after review (was 'measures continue', implying the full Art. 42 set) |

Summary text (What to remember):

- A PEP is a natural person who is or has been entrusted with a prominent public function.
- Family members and close associates get the same measures.
- Measures: senior management approval, source of wealth and funds, enhanced ongoing monitoring.
- Check the national list of prominent functions as well as the EU definition.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 42 para. 1; AMLR Art. 46.
Further reading named, not quoted: FATF Recommendation 12 (politically exposed persons).

## Game `g-tm-triage`: Alert triage (flag, lesson `transaction-monitoring`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-tm-triage/p` | A seasonal rise from the usual source fits the business. Close it, and write down what you looked at and what you concluded: when an alert is assessed against the facts, the assessment and what was considered are recorded. | Art. 77 para. 1(b) | AMLR Art. 26(1) (detection), Art. 69(2) (assessment), Art. 77(1)(b): record of the assessment incl. information and circumstances considered and the results | ok after review: worded conditionally ('when an alert is assessed against the facts'); no claim that every closure is an Art. 69(2) assessment |
| `g-tm-triage/c1` | Many different payers and fast pass-through do not fit a consultant's business. A suspicion can rest on the link between transactions and on where the funds come from and go. | Art. 69 para. 2 | AMLR Art. 69(2), second subparagraph: link between several transactions; origin, destination or use of funds | ok after review ('unrelated' was not in the card; now 'different') |
| `g-tm-triage/c2` | Same payee, same amount, same reference as every month. Consistent with what the bank knows. Close, with that reason. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-tm-triage/c3` | Expected and documented: the customer told the bank and the deed is on file. That knowledge is what monitoring compares against. Note it in the closure. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-tm-triage/c4` | More than four times the salon's total monthly takings, while it was half closed. Unusually large and inconsistent with what the bank knows. | Art. 34 para. 2(b) | AMLR Art. 34(2)(b) and Art. 26(1). EUR 61 000 against total takings of about EUR 15 000 | ok after review (comparison now against total takings) |
| `g-tm-triage/c5` | No apparent economic purpose: a textile importer paid for consulting by an unrelated sector, with no contract. One example of a pattern that needs a closer look. | Art. 34 para. 2(d) | AMLR Art. 34(2)(d): no apparent economic or lawful purpose. Worded "one example of a pattern" | ok |
| `g-tm-triage/c6` | It fits the change she told the bank about. Update her profile: a change in a customer's circumstances is a reason to review the information held. | Art. 26 para. 3(a) | AMLR Art. 26(3)(a): review and update customer information where there is a change in the relevant circumstances | ok |

Summary text (What to remember):

- Compare each alert with what the bank knows: profile, business, origin and destination of funds.
- Close only with a reason you can write down: what you looked at and what you concluded. When an alert is assessed against the facts, that assessment and what was considered are kept on record.
- Escalate when facts do not fit: patterns, links between transactions, or where the money comes from and goes.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 26 para. 1.
Further reading named, not quoted: EBA Guidelines on ML/TF risk factors (EBA/GL/2021/02).

## Game `g-sanctions-match`: True match or false positive? (match, lesson `sanctions-screening`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-sanctions-match/p` | A similar name, but date of birth, nationality and place of birth all differ. Comparing identifiers before clearing a name is common practice; record what you compared. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d) (the duty to verify). Comparing identifiers is common practice, worded as such; further reading: EU Best Practices for the effective implementation of restrictive measures (not quoted) | ok, practice wording |
| `g-sanctions-match/c1` | Name, date of birth, nationality and place of birth all agree. Escalate to your compliance officer at once and follow the firm's sanctions procedure. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d); Art. 11(2): the compliance officer is responsible incl. the implementation of targeted financial sanctions. "Follow the firm's sanctions procedure": no freezing duty is claimed (the sanctions regulations are not in the RegRadar law library) | ok |
| `g-sanctions-match/c2` | Different spelling, same person: every identifier agrees and the entry lists the variant. Spelling variants and transliterations are a common way a match hides. | Art. 20 para. 1(d) | Spelling variants and transliterations: common screening practice, worded "a common way"; list entry invented | ok, practice wording |
| `g-sanctions-match/c3` | A common name, and every identifier differs. Clear it, and record which identifiers you compared. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d); identifier comparison as common practice | ok |
| `g-sanctions-match/c4` | The customer's name is not on the list, but a designated entity holds more than 50% of it, and the AMLR check covers owners and controllers. Escalate: what must be frozen or reported is decided under the sanctions rules themselves, which are not quoted here. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d): legal persons subject to targeted financial sanctions with more than 50 % of the proprietary rights; Art. 26(4), last subparagraph: does not replace the obligation to apply targeted financial sanctions. Freezing and reporting come from the sanctions rules (not in the library), and are not described | ok after review (AMLR check separated from sanctions-regime duties) |
| `g-sanctions-match/c5` | Same name and nationality, but a different date and place of birth, and our customer's details are verified from her identity card. Clear it, and record the identifiers you compared. | Art. 20 para. 1(d) | Practice: identifier comparison; the customer's birth details are stated as verified from ID, and the list entry's date of birth now differs in day, month and year | ok after review (data changed so the case is clear-cut) |

Summary text (What to remember):

- A name alone is not enough to confirm or clear a hit: compare date of birth, nationality, place of birth and other identifiers (common practice).
- Spelling variants and transliterations can still be the same person.
- Check owners and controllers too: whether a legal entity is controlled by, or more than 50% owned by, designated persons is part of the AMLR check. What follows (freezing, reporting) is set by the sanctions rules.
- Banks and financial institutions re-check on every new designation.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 20 para. 1(d); AMLR Art. 26 para. 4.
Further reading named, not quoted: EU Best Practices for the effective implementation of restrictive measures (Council of the EU); FATF Recommendations 6 and 7 (targeted financial sanctions); The EU consolidated list of financial sanctions, at the source.

## Game `g-str-facts`: What goes in the report? (pick, lesson `suspicious-transaction-reports`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-str-facts/p` | Dates, amounts, links between transactions and where the money went are facts. A feeling is not. | Art. 69 para. 2 | AMLR Art. 69(2), second subparagraph: suspicion based on characteristics, size, patterns, links, origin and destination of funds | ok |
| `g-str-facts/c1` | The profile, the pattern and the destination of the funds support the suspicion. A conclusion drawn from tone of voice, and irrelevant personal details, do not. | Art. 69 para. 2 | AMLR Art. 69(2). That tone of voice and personal trivia do not support a suspicion is a teaching judgement | ok |
| `g-str-facts/c2` | The pattern, the total and the mismatch with the business are facts. A client's importance does not support a suspicion, and a list of guesses is not a fact. | Art. 69 para. 2 | AMLR Art. 69(2). That a client's importance does not support a suspicion is a teaching judgement, now worded as such | ok after review (was worded as a rule: 'has no place in the report') |
| `g-str-facts/c3` | Attempted transactions are reported too, and so are suspicions arising from not being able to complete due diligence. 'Nothing happened' is not a reason to stay silent. | Art. 69 para. 1 | AMLR Art. 69(1), second subparagraph: attempted transactions and suspicions arising from the inability to conduct due diligence are reported | ok |

Summary text (What to remember):

- Facts, not feelings. A common way to write it: who, what, when, how much, and why it does not fit.
- A suspicion rests on facts such as the customer and counterparts, size and pattern, links between transactions, and where funds come from and go.
- Attempted transactions are reported too. Do not tell the customer, or others, that a transaction is being assessed or has been reported.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 69 para. 2; AMLR Art. 69 para. 1.
Further reading named, not quoted: FATF Recommendation 20 (reporting of suspicious transactions); Your national FIU's guidance on writing reports.

## Decide scenarios


### `d-context`: Something looks odd (lesson `context`)

Situation (fictional): Day three at CF Bank (fictional). A payment on a customer account looks odd to you. Nobody has told you yet who handles this. What do you do?

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-context/a` | Find out who the compliance officer is and raise it with them today | best | The right channel. The compliance officer is the person who reports suspicious transactions to the FIU, and you raised it promptly. | Art. 11 para. 2 | AMLR Art. 11(2): the compliance officer reports suspicious transactions to the FIU (Art. 69(6)); Art. 69(1): promptly | ok |
| `d-context/b` | Wait a few weeks to see whether it happens again | poor | Reports are made promptly when there is a suspicion or reasonable grounds to suspect. Waiting for certainty is not the test. | Art. 69 para. 1(a) | AMLR Art. 69(1)(a): "knows, suspects or has reasonable grounds to suspect", reported promptly | ok |
| `d-context/c` | Let it go: the amount is small | poor | The reporting duty applies regardless of the amount involved. | Art. 69 para. 1(a) | AMLR Art. 69(1)(a): "regardless of the amount involved" | ok |

### `d-basics`: A launch next month (lesson `aml-basics`)

Situation (fictional): The product team at CF Bank (fictional) wants to launch crypto-asset top-ups in a new country next month. Nobody has looked at the money laundering risks yet.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-basics/a` | Assess the risks before launch and set the controls to match | best | Exactly what the law asks: before launching a new product or entering a new area, identify and assess the risks and take measures to manage them. | Art. 10 para. 1 | AMLR Art. 10(1), second subparagraph: prior to the launch of new products or in a new geographical area | ok |
| `d-basics/b` | Launch now and cover it at the annual review | poor | The assessment comes before the launch, not after. A supervisor would ask why it was skipped. | Art. 10 para. 1 | AMLR Art. 10(1), second subparagraph. "A supervisor would ask why" is a judgement | ok |
| `d-basics/c` | Launch, but put every customer through the heaviest checks | poor | Heavy checks for everyone do not replace the launch assessment, and the extent of measures should follow an individual risk analysis. | Art. 20 para. 2 | AMLR Art. 20(2): extent of measures from an individual risk analysis; Art. 10(1) | ok |

### `d-kyc`: Open it today (lesson `cdd-kyc`)

Situation (fictional): A new business customer's director wants the account opened today: 'Documents next week. A €40,000 payment is waiting.' Nothing in the file suggests lower risk.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-kyc/a` | Verify identity and owners first, and explain why to the director | best | Verification takes place before the business relationship starts. The payment waits a few days; the bank does not take an unknown customer. | Art. 23 para. 1 | AMLR Art. 23(1): verification before the business relationship is established | ok |
| `d-kyc/b` | Open the account with every transaction blocked until the checks are complete | ok | Also acceptable for a bank or financial institution, if safeguards stop any transaction until the customer and the beneficial owners are identified and verified. The €40,000 still waits. | Art. 23 para. 3 | AMLR Art. 23(3): safeguards until full compliance with Art. 20(1), points (a) and (b): identifying and verifying the customer and the beneficial owners | ok after review (was 'until due diligence is complete'; verdict 'also acceptable' kept) |
| `d-kyc/c` | Open it and let the payment through; collect the documents later | poor | Money moves through an account whose owner nobody has verified. The exceptions for later verification need lower or little risk, and this file shows neither. | Art. 23 para. 1 | AMLR Art. 23(1) and (2): later verification only for lower risk / little risk, which the case excludes | ok |

### `d-ubo`: 'Nobody owns us' (lesson `beneficial-ownership`)

Situation (fictional): A company customer's register entry lists no one with 25% or more. The director says: 'Nobody owns us, it is complicated.' You have the register entry and the articles, nothing else.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-ubo/a` | Ask for the shareholder list and any agreements; only if still no one, record it and identify the senior managing officials | best | Right order. The fallback to senior managing officials comes only after all possible means of identification are exhausted. | Art. 22 para. 2 | AMLR Art. 22(2): "after having exhausted all possible means of identification" | ok |
| `d-ubo/b` | Record 'no beneficial owner' and onboard | poor | Too early. You have not exhausted the means of identification, and control by other means has not been checked. | Art. 51 | AMLR Art. 22(2) and Art. 51 (control by other means, in parallel) | ok |
| `d-ubo/c` | Name the director as beneficial owner to close the file | poor | Senior managing officials are identified as a fallback and recorded as such, not named as beneficial owners. | Art. 22 para. 2 | AMLR Art. 22(2): record that no beneficial owner was identified and identify the senior managing officials | ok |

### `d-pep`: A minister's son (lesson `peps`)

Situation (fictional): Screening shows that a new customer's mother is a serving minister in another Member State. He wants a premium account at CF Bank (fictional).

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-pep/a` | Apply the PEP measures: senior management approval, source of wealth and funds, enhanced monitoring | best | Correct. A child of a PEP is a family member, and the PEP measures apply to family members too. After assessing him, the firm may still decline, with a documented reason. | Art. 46 | AMLR Art. 2(35)(b), Art. 46, Art. 42(1); declining after an individual assessment is a firm decision, no legal duty claimed | ok |
| `d-pep/b` | Decline: family members of PEPs are too risky | poor | The law sets extra measures for PEPs and their families, not a ban, and the extent of measures follows an individual analysis of this customer. Refusing a whole category without looking at the person skips that analysis. Declining after assessing him, with a documented reason, is a different decision. | Art. 20 para. 2 | AMLR Art. 20(2): extent of measures from an individual analysis; Art. 42(1) and 46 set measures, not a ban; Art. 42(2)(b): AMLA guidelines on the risk of each category (risk differs within a category). Art. 21(4) not cited: it only mandates guidelines on de-risking under Directive 2014/92/EU | CHANGED after independent review: verdict 'also acceptable' became 'poor' (category refusal without individual assessment) |
| `d-pep/c` | Standard checks: he is not the minister himself | poor | The measures for PEPs also apply to family members. Standard checks would miss the approval, source of wealth and monitoring the law requires. | Art. 46 | AMLR Art. 46 | ok |

### `d-tm`: 400 alerts a week (lesson `transaction-monitoring`)

Situation (fictional): One rule produces 400 alerts a week and nearly all are closed as false. A manager suggests closing them in bulk with the note 'no concern'.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-tm/a` | Keep assessing alerts one by one, noting what was considered and concluded, and propose tuning the rule with the evidence | best | When an alert is assessed against the facts, the assessment, what was considered and the result are recorded. The rule gets tuned with evidence, through the firm's change process, instead of being ignored. | Art. 77 para. 1(b) | AMLR Art. 77(1)(b), with Art. 26(1) and 69(2). Tuning through a change process is practice guidance | ok after review ('short written reason' dropped; conditional wording) |
| `d-tm/b` | Bulk-close them with 'no concern' | poor | One identical line says nothing about what was considered, so it does not show that an assessment took place. A bulk closure can also hide the one alert that mattered. | Art. 77 para. 1(b) | AMLR Art. 77(1)(b): the record covers the information and circumstances considered. 'Can also hide' is a judgement, hedged | ok after review |
| `d-tm/c` | Switch the rule off | poor | Monitoring still has to detect the transactions that need a closer look. Changing a rule is a decision to document, not a quick fix. | Art. 26 para. 1 | AMLR Art. 26(1): monitoring to detect transactions that need a more thorough assessment | ok |

### `d-sanctions`: A new designation (lesson `sanctions-screening`)

Situation (fictional): This morning a new designation (fictional) names Harbor Line Holdings Ltd, which owns 55% of your customer Lindqvist Shipping AB (fictional). A payment from the customer is queued.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-sanctions/a` | Escalate to the compliance officer now and hold the payment while the sanctions procedure runs | best | Right. The AMLR check covers owners with more than 50%, and banks re-check on every new designation. Holding the payment is the firm's procedure; freezing and notification duties come from the sanctions rules, not from the AMLR. | Art. 26 para. 4 | AMLR Art. 26(4), second subparagraph; Art. 20(1)(d); Art. 11(2). Holding the payment is labelled firm procedure; freezing and notification duties attributed to the sanctions rules, not the AMLR | ok after review (no longer says the AMLR check is 'exactly what the sanctions check covers') |
| `d-sanctions/b` | Wait for the monthly screening run | poor | For banks and financial institutions the check is also done upon any new designation, not on the next scheduled run. | Art. 26 para. 4 | AMLR Art. 26(4), second subparagraph | ok |
| `d-sanctions/c` | Check the customer's name only: it is not on the list | poor | The check covers who owns and controls a legal entity, not only its name. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d) | ok |

### `d-str`: 'Let me ask him at lunch' (lesson `suspicious-transaction-reports`)

Situation (fictional): You are about to report a suspicion on a long-standing client. The relationship manager asks you to wait: 'I will ask him about it at lunch on Friday.'

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-str/a` | Report promptly through the compliance officer, and ask the manager not to raise it with the client | best | Right. The report goes promptly, and nobody tells the client that a report or an analysis is under way. | Art. 73 para. 1 | AMLR Art. 69(1): promptly; Art. 73(1): no disclosure to the customer | ok |
| `d-str/b` | Wait until after the lunch | poor | Waiting delays a report that should be made promptly. And if the manager raises it at lunch, he risks disclosing that the client's transactions are being assessed, which is prohibited. | Art. 73 para. 1 | AMLR Art. 69(1): promptly; Art. 73(1): no disclosure that transactions are being assessed. Waiting is not itself disclosure: the consequence now says the lunch conversation risks it | ok after review (logic gap fixed) |
| `d-str/c` | Leave it to the manager: it is his client | poor | Sending reports to the FIU is the compliance officer's job, and the report is due promptly. It is not the relationship manager's decision. | Art. 11 para. 2 | AMLR Art. 11(2) and 69(6): the compliance officer reports to the FIU; Art. 69(1): promptly | ok after review (cite moved to Art. 11(2); the retaliation sentence removed: the shown citation does not support it) |

## Not verified by a primary source in this repository

- The three-stage model (placement, layering, integration), structuring, and the layering and
  integration examples: teaching model and typology wording, presented as such.
- Comparing identifiers and watching for spelling variants when clearing a sanctions name match:
  common screening practice, worded as such. Further reading: EU Best Practices for the effective
  implementation of restrictive measures (Council of the EU); FATF Recommendations 6 and 7. The EU
  sanctions regulations themselves are not in `docs/data/laws/`, so no freezing or reporting duty
  under them is claimed.
- How to structure an STR narrative ("who, what, when, how much, why it does not fit"): worded as "a
  common way to write it". The reporting format will be set by implementing technical standards
  (AMLR Art. 69(3)), not yet in the library.

## Changes made after the independent review (2026-10-17)

- `g-ubo-pick/c2`: answer key corrected to Mark and Rania (Art. 54(b)); the intro and the summary now
  say "multiply along the chain, unless Article 54 applies"; Art. 54(b) added to the law box.
- `d-pep/b`: verdict changed from "also acceptable" to "poor"; consequence rests on Art. 20(2).
  `d-pep/a` adds that a firm may decline after assessing the customer, with a documented reason.
- Alert closures (`g-tm-triage/p`, summary, `d-tm/a`, `d-tm/b`, the Close hint): conditional wording;
  "short written reason" dropped.
- Sanctions (`g-sanctions-match/c4`, c5 data, summary bullets 1 and 3, `d-sanctions/a`): the AMLR check
  is separated from freezing and reporting under the sanctions rules.
- STR and tipping-off (`d-str/b`, `d-str/c`, `g-str-facts/c2`, summary bullet 3): logic gap fixed,
  "never tell the customer" qualified to the Art. 73(1) wording.
- Context (`c1`, `c2`, `c3`, summary, law box): monitoring named for accounts, alternatives in Art. 34(2),
  cite moved to Art. 20(1)(f), the lower Art. 19(2) to (4) thresholds added as a note (figures and
  conditions checked in the Art. 19 text), Art. 90 added.
- Minor: `g-kyc-docs/c5` and summary, `g-pep-sort/c3`, `c4`, `c6`, `g-tm-triage/c1`, `c4`, `d-kyc/b`.

Not taken from the review: Art. 21(4) is not cited for de-risking (it only mandates AMLA and EBA
guidelines under Directive 2014/92/EU), and Art. 21(1) is not cited for declining a PEP relative whose
source of wealth cannot be established (source of wealth for PEPs is Art. 42(1)(b), not an Art. 20(1)
measure).

## Changes made during the self-check

- `g-context-stages/c1` and its summary bullet: "the law looks at linked transactions together" was
  limited to occasional transactions (Art. 19(1)(b) is about the due diligence threshold).
- `g-sanctions-match/c4`: the comparison table no longer shows a question row; the ownership row says
  who owns the customer.
- No nominee-shareholder card: who counts as beneficial owner in a nominee structure is an open owner
  question from the Ownership room (case OWN-03), so the game avoids it.

