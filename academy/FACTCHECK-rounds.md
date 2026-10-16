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

**Status:** self-checked by the author against the source text (2026-10-16). Independent check (step 3
of the gate) and owner sign-off (step 5): **pending**. Built as a prototype ahead of sign-off at the
owner's request; mark any row you disagree with and the data changes before release.

Verdicts: `ok` = matches the source in meaning (or verbatim where quoted); `ok, teaching model` or
`ok, practice wording` = not law, worded as such; `interpretation` = a reasonable reading the owner
should confirm.


## Game `g-context-stages`: Three stages (sort, lesson `context`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-context-stages/p` | Cash entering the financial system is what the model calls placement. One example: a cash-heavy business used as cover. | none shown | Teaching model (placement, layering, integration); FATF typologies as further reading | ok, teaching model, worded "what the model calls" and "one example" |
| `g-context-stages/c1` | Getting cash into accounts is placement. Splitting it into small amounts, often called structuring, is one common example. For occasional transactions, the law counts linked transactions together when applying its threshold. | Art. 19 para. 1(b) | AMLR Art. 19(1)(b): occasional transactions counted "in a single operation or through linked transactions". "Structuring" is a common typology term, no legal definition claimed | ok after rewording (draft said "the law looks at linked transactions together" without limiting it to occasional transactions) |
| `g-context-stages/c2` | Moving money through layers of companies and countries to blur the trail is commonly called layering. Complex transactions with no apparent economic purpose must be examined. | Art. 34 para. 2 | Teaching model; AMLR Art. 34(2)(a) and (d): complex transactions, no apparent economic or lawful purpose | ok, teaching model worded "commonly called" |
| `g-context-stages/c3` | Integration is the stage where the money returns looking legitimate, here as a loan that buys property. Asking about the source of funds is one way this gets noticed. | Art. 25 para. (c) | Teaching model; AMLR Art. 25, point (c): source of funds information where necessary | ok, hedged ("one way this gets noticed") |
| `g-context-stages/c4` | Fast movement with no business behind it is a common layering pattern. The law asks for a closer look at transactions in an unusual pattern. | Art. 34 para. 2(c) | Teaching model; AMLR Art. 34(2)(c): transaction conducted in an unusual pattern | ok, teaching model worded "a common layering pattern" |
| `g-context-stages/c5` | The money now reaches the person as ordinary-looking income. One example of integration. | none shown | Teaching model only; no legal claim, no citation shown (the card says "a teaching example, not a legal rule") | ok, teaching model |
| `g-context-stages/c6` | Still about turning cash into something easier to move or deposit: one example of placement. Real cases often mix stages. | none shown | Teaching model only; "real cases often mix stages" is a judgement, hedged | ok, teaching model |

Summary text (What to remember):

- Placement, layering and integration is a common teaching model, not a legal definition.
- Real cases mix the stages. Due diligence, monitoring and reporting work across all of them.
- For occasional transactions, the law counts linked transactions together, so splitting does not hide the total.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 19 para. 1(b).
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
| `g-kyc-docs/c5` | It may simply be a second nationality, and the law asks for all nationalities. So this mismatch is a question: ask, and record both. | Art. 22 para. 1(a) | AMLR Art. 22(1)(a)(iii): "nationalities" (plural) | ok; the card treats the mismatch as a question, not a fault |

Summary text (What to remember):

- Check what the customer told you against an identity document or reliable, independent source.
- For a person: all names, place and full date of birth, nationalities, address. For a company: name, legal form, office, country, representatives.
- A mismatch is a question, not a verdict: ask, record the answer, and where doubts remain apply due diligence again.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 22 para. 1(a); AMLR Art. 19 para. 1(e).
Further reading named, not quoted: FATF Recommendation 10 (customer due diligence).

## Game `g-ubo-pick`: Find the owner (pick, lesson `beneficial-ownership`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-ubo-pick/p` | Lotte holds 60%, which is 25% or more. None of the small shareholders comes close. | Art. 52 para. 1 | AMLR Art. 52(1): 25 % or more | ok |
| `g-ubo-pick/c1` | Ines holds 30% directly. Hugo holds 50% indirectly (100% of the holding × 50%). Pieter's 20% is under 25%, and nothing here shows control by other means. | Art. 52 para. 1 | AMLR Art. 52(1): indirect ownership calculated by multiplying along the chain. Hugo: 100% x 50% = 50%. Also consistent with Art. 54 | ok, arithmetic checked |
| `g-ubo-pick/c2` | Multiply along the chain: Mark 60% × 60% = 36%. Rania 40% × 60% = 24%, just under 25%, and nothing on this chart shows she controls by other means. An agreement giving her control would change that. | Art. 52 para. 1 | AMLR Art. 52(1). Mark 60% x 60% = 36%; Rania 40% x 60% = 24%. Rania does not control the holding (40%), so Art. 54 does not make her a beneficial owner either | ok, arithmetic checked; the card states that an agreement giving control would change the answer (Art. 53) |
| `g-ubo-pick/c3` | No one reaches 25%, but the right to appoint or remove a majority of the board is control via other means. Control is checked in parallel to ownership. | Art. 53 para. 3(b) | AMLR Art. 53(3)(b): right to appoint or remove a majority of the board; Art. 51, second paragraph: control identified in parallel to ownership | ok |
| `g-ubo-pick/c4` | After exhausting all possible means, no natural person qualifies. Record that no beneficial owner was identified, and identify (and verify) the senior managing officials. They are not recorded as beneficial owners. | Art. 22 para. 2 | AMLR Art. 22(2): after exhausting all possible means, record that no beneficial owner was identified, identify and verify the senior managing officials | ok |

Summary text (What to remember):

- Look through companies to the natural person who ultimately owns or controls.
- 25% or more, direct or indirect. Multiply along the chain and add the chains together.
- Control by other means counts in parallel, for example the right to appoint or remove a majority of the board.
- No one found after all means? Record it and identify the senior managing officials.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 52 para. 1; AMLR Art. 53 para. 3(b).
Further reading named, not quoted: FATF Recommendations 24 and 25 (transparency of legal persons and arrangements).

## Game `g-pep-sort`: Who counts? (sort, lesson `peps`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-pep-sort/p` | Ministers are named in the definition of a politically exposed person. | Art. 2 para. 34(a)(i) | AMLR Art. 2(34)(a)(i): ministers | ok |
| `g-pep-sort/c1` | A spouse of a PEP is a family member. Members of parliament are PEPs. | Art. 2 para. 35(a) | AMLR Art. 2(35)(a): spouse; Art. 2(34)(a)(ii): members of parliament | ok |
| `g-pep-sort/c2` | Members of supreme and constitutional courts are named in the definition. | Art. 2 para. 34(a)(iv) | AMLR Art. 2(34)(a)(iv): members of supreme courts, of constitutional courts | ok |
| `g-pep-sort/c3` | Siblings count only for heads of State or government, ministers and deputy or assistant ministers (and equivalent functions). A parliament member's brother is not a family member under the EU definition. Your firm may still rate him higher risk. | Art. 2 para. 35(d) | AMLR Art. 2(35)(d): siblings only for functions in point (34)(a)(i) and equivalent functions. "Your firm may still rate him higher risk" is a judgement, hedged | ok |
| `g-pep-sort/c4` | Joint beneficial ownership of a legal entity with a PEP makes someone a person known to be a close associate. Ambassadors are PEPs. | Art. 2 para. 36(a) | AMLR Art. 2(36)(a): joint beneficial ownership of legal entities, or any other close business relations, with a PEP; Art. 2(34)(a)(vi): ambassadors | ok |
| `g-pep-sort/c5` | The EU definition covers heads of local authorities with at least 50 000 inhabitants. A Member State can add other functions, so check your national list too. | Art. 2 para. 34(a)(viii) | AMLR Art. 2(34)(a)(viii): heads of local authorities with at least 50 000 inhabitants; (ix): other functions provided for by Member States | ok |
| `g-pep-sort/c6` | The definition covers someone who is or has been entrusted with a prominent function. Measures continue for at least 12 months after leaving office, and longer while the risk remains. | Art. 45 para. 2 | AMLR Art. 2(34): "is or has been entrusted"; Art. 45(2): measures for not less than 12 months after leaving | ok |

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
| `g-tm-triage/p` | A seasonal rise from the usual source fits the business. Close it, and write down why: the assessment is kept on record. | Art. 77 para. 1(b) | AMLR Art. 77(1)(b): record of the assessment under Art. 69(2), whether or not it results in a report | ok (interpretation: reviewing an alert is an assessment under Art. 69(2)) |
| `g-tm-triage/c1` | Many unrelated payers and fast pass-through do not fit a consultant's business. A suspicion can rest on the link between transactions and on where the funds come from and go. | Art. 69 para. 2 | AMLR Art. 69(2), second subparagraph: link between several transactions; origin, destination or use of funds | ok |
| `g-tm-triage/c2` | Same payee, same amount, same reference as every month. Consistent with what the bank knows. Close, with that reason. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-tm-triage/c3` | Expected and documented: the customer told the bank and the deed is on file. That knowledge is what monitoring compares against. Note it in the closure. | Art. 26 para. 1 | AMLR Art. 26(1) | ok |
| `g-tm-triage/c4` | Four times the usual, while the salon was half closed. Unusually large and inconsistent with what the bank knows. | Art. 34 para. 2(b) | AMLR Art. 34(2)(b) and Art. 26(1) | ok |
| `g-tm-triage/c5` | No apparent economic purpose: a textile importer paid for consulting by an unrelated sector, with no contract. One example of a pattern that needs a closer look. | Art. 34 para. 2(d) | AMLR Art. 34(2)(d): no apparent economic or lawful purpose. Worded "one example of a pattern" | ok |
| `g-tm-triage/c6` | It fits the change she told the bank about. Update her profile: a change in a customer's circumstances is a reason to review the information held. | Art. 26 para. 3(a) | AMLR Art. 26(3)(a): review and update customer information where there is a change in the relevant circumstances | ok |

Summary text (What to remember):

- Compare each alert with what the bank knows: profile, business, origin and destination of funds.
- Close only with a reason you can write down. The assessment and its result are kept on record.
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
| `g-sanctions-match/c4` | The customer's name is not on the list, but a designated entity holds more than 50% of it. The law asks banks to check owners and controllers too. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d): legal persons subject to targeted financial sanctions that have more than 50 % of the proprietary rights | ok |
| `g-sanctions-match/c5` | Same name and nationality, but thirty years apart and a different place of birth. Clear it, and record the identifiers you compared. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d); identifier comparison as common practice | ok |

Summary text (What to remember):

- A name alone proves nothing: compare date of birth, nationality, place of birth and other identifiers (common practice).
- Spelling variants and transliterations can still be the same person.
- Check owners and controllers too: a legal entity controlled by, or more than 50% owned by, designated persons is caught.
- Banks and financial institutions re-check on every new designation.

Law quotes in the summary (verbatim, checked by verify.mjs): AMLR Art. 20 para. 1(d); AMLR Art. 26 para. 4.
Further reading named, not quoted: EU Best Practices for the effective implementation of restrictive measures (Council of the EU); FATF Recommendations 6 and 7 (targeted financial sanctions); The EU consolidated list of financial sanctions, at the source.

## Game `g-str-facts`: What goes in the report? (pick, lesson `suspicious-transaction-reports`)

| Key | Wording on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|
| `g-str-facts/p` | Dates, amounts, links between transactions and where the money went are facts. A feeling is not. | Art. 69 para. 2 | AMLR Art. 69(2), second subparagraph: suspicion based on characteristics, size, patterns, links, origin and destination of funds | ok |
| `g-str-facts/c1` | The profile, the pattern and the destination of the funds support the suspicion. A conclusion drawn from tone of voice, and irrelevant personal details, do not. | Art. 69 para. 2 | AMLR Art. 69(2). That tone of voice and personal trivia do not support a suspicion is a teaching judgement | ok |
| `g-str-facts/c2` | The pattern, the total and the mismatch with the business are facts. Whether the client is important has no place in the report, and a list of guesses is not a fact. | Art. 69 para. 2 | AMLR Art. 69(2). "Whether the client is important has no place in the report" is a teaching judgement | ok |
| `g-str-facts/c3` | Attempted transactions are reported too, and so are suspicions arising from not being able to complete due diligence. 'Nothing happened' is not a reason to stay silent. | Art. 69 para. 1 | AMLR Art. 69(1), second subparagraph: attempted transactions and suspicions arising from the inability to conduct due diligence are reported | ok |

Summary text (What to remember):

- Facts, not feelings. A common way to write it: who, what, when, how much, and why it does not fit.
- A suspicion rests on facts such as the customer and counterparts, size and pattern, links between transactions, and where funds come from and go.
- Attempted transactions are reported too. Never tell the customer.

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
| `d-kyc/b` | Open the account with every transaction blocked until the checks are complete | ok | Also acceptable for a bank or financial institution, if safeguards really stop any transaction until due diligence is complete. The €40,000 still waits. | Art. 23 para. 3 | AMLR Art. 23(3): an account may be opened if adequate safeguards ensure no transactions until full compliance with due diligence | ok; verdict "also acceptable" |
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
| `d-pep/a` | Apply the PEP measures: senior management approval, source of wealth and funds, enhanced monitoring | best | Correct. A child of a PEP is a family member, and the PEP measures apply to family members too. | Art. 46 | AMLR Art. 2(35)(b): a child is a family member; Art. 46: measures apply to family members; Art. 42(1): the measures | ok |
| `d-pep/b` | Decline: family members of PEPs are too risky | ok | Your firm can decide not to take the risk, but the law sets extra measures, not a ban. Declining every PEP relative by default is a business choice, not a legal duty. | Art. 42 para. 1 | AMLR Art. 42(1) sets measures; nothing in Arts 42 to 46 requires refusal. "A business choice, not a legal duty" is an interpretation | ok, interpretation; verdict "also acceptable" left to the owner (see questions) |
| `d-pep/c` | Standard checks: he is not the minister himself | poor | The measures for PEPs also apply to family members. Standard checks would miss the approval, source of wealth and monitoring the law requires. | Art. 46 | AMLR Art. 46 | ok |

### `d-tm`: 400 alerts a week (lesson `transaction-monitoring`)

Situation (fictional): One rule produces 400 alerts a week and nearly all are closed as false. A manager suggests closing them in bulk with the note 'no concern'.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-tm/a` | Keep closing alerts with a short written reason, and propose tuning the rule with the evidence | best | Each assessment and its result stays on record, and the rule gets fixed with a documented reason instead of being ignored. | Art. 77 para. 1(b) | AMLR Art. 77(1)(b): record of each assessment. Proposing to tune the rule is practice guidance | ok |
| `d-tm/b` | Bulk-close them with 'no concern' | poor | The record of each assessment, and what was considered, would be missing. A bulk closure can also hide the one alert that mattered. | Art. 77 para. 1(b) | AMLR Art. 77(1)(b). "Can also hide the one alert that mattered" is a judgement, hedged | ok |
| `d-tm/c` | Switch the rule off | poor | Monitoring still has to detect the transactions that need a closer look. Changing a rule is a decision to document, not a quick fix. | Art. 26 para. 1 | AMLR Art. 26(1): monitoring to detect transactions that need a more thorough assessment | ok |

### `d-sanctions`: A new designation (lesson `sanctions-screening`)

Situation (fictional): This morning a new designation (fictional) names Harbor Line Holdings Ltd, which owns 55% of your customer Lindqvist Shipping AB (fictional). A payment from the customer is queued.

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-sanctions/a` | Escalate to the compliance officer now and follow the sanctions procedure before the payment goes | best | Right. A designated owner with more than 50% is exactly what the sanctions check covers, and banks re-check on every new designation. | Art. 26 para. 4 | AMLR Art. 26(4), second subparagraph: upon any new designation; Art. 20(1)(d): more than 50 %; Art. 11(2). No freezing duty claimed | ok |
| `d-sanctions/b` | Wait for the monthly screening run | poor | For banks and financial institutions the check is also done upon any new designation, not on the next scheduled run. | Art. 26 para. 4 | AMLR Art. 26(4), second subparagraph | ok |
| `d-sanctions/c` | Check the customer's name only: it is not on the list | poor | The check covers who owns and controls a legal entity, not only its name. | Art. 20 para. 1(d) | AMLR Art. 20(1)(d) | ok |

### `d-str`: 'Let me ask him at lunch' (lesson `suspicious-transaction-reports`)

Situation (fictional): You are about to report a suspicion on a long-standing client. The relationship manager asks you to wait: 'I will ask him about it at lunch on Friday.'

| Key | Option | Verdict shown | Consequence on screen | Citation shown | Source checked | Verdict |
|---|---|---|---|---|---|---|
| `d-str/a` | Report promptly through the compliance officer, and ask the manager not to raise it with the client | best | Right. The report goes promptly, and nobody tells the client that a report or an analysis is under way. | Art. 73 para. 1 | AMLR Art. 69(1): promptly; Art. 73(1): no disclosure to the customer | ok |
| `d-str/b` | Wait until after the lunch | poor | Telling the client that his transactions are being assessed is prohibited, and the report should be prompt. | Art. 73 para. 1 | AMLR Art. 73(1): not disclosing that transactions are being assessed | ok |
| `d-str/c` | Leave it to the manager: it is his client | poor | Reporting suspicions is the compliance officer's responsibility, not a sales decision. People who report are protected against retaliation. | Art. 69 para. 7 | AMLR Art. 11(2): the compliance officer reports; Art. 69(7): protection against retaliation | ok |

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

## Changes made during the check

- `g-context-stages/c1` and its summary bullet: "the law looks at linked transactions together" was
  limited to occasional transactions (Art. 19(1)(b) is about the due diligence threshold).
- `g-sanctions-match/c4`: the comparison table no longer shows a question row; the ownership row says
  who owns the customer.
- No nominee-shareholder card: who counts as beneficial owner in a nominee structure is an open owner
  question from the Ownership room (case OWN-03), so the game avoids it.

