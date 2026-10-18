# Film 04 · Look through (module `beneficial-ownership`)

Script v1, 2026-10-18. **Phase 1 of the script review gate** (`academy/SCRIPT_REVIEW.md`): brief,
storyboard and claim ledger. Nothing is built until the independent check (step 3) and owner
sign-off (step 5) are done.

Status: self-checked by the author against `docs/data/laws/32024R1624_EN.json` (AMLR) and
`docs/data/laws/32024L1640_EN.json` (AMLD6). Arithmetic checked. Independent check: **pending**.
Owner sign-off: **pending**.

## Brief

| | |
|---|---|
| Module | `beneficial-ownership`, track 4 "Beneficial ownership" (`docs/data/academy/curriculum.json`) |
| Length | 60 s |
| Audience | A new analyst at a payment, e-money or crypto firm who reviews company customers. |
| One message | **Look through the companies to the natural persons who own (25 % or more, direct or indirect, chains multiplied then added) or control (by other means, checked in parallel).** |
| Situation shown | **One example scenario**, named in the first caption: a fictional company applies to a fictional crypto-asset service provider. Typology named: **a stake split up so that no single piece looks big** (part held directly, part through a holding company), one example of a common pattern. A second route, **control without shares**, shows why ownership is not the only test. |
| Teaching models | None presented as law. The warning signs are worded "common warning signs, not proof". |
| Fictional | Velmont Analytics, Kappa Holding, Orrin, Mira, Jonas, Elif, Tom, Victor, every percentage. HUD and end card say "Fictional example". |
| Structure (fixed, checked) | Velmont Analytics: Mira 30 % direct · Kappa Holding 40 % · Jonas 8 % direct · other shareholders 22 % (each under 5 %). Kappa Holding: Jonas 45 % · Elif 35 % · Tom 20 %. Victor: no shares; a shareholders' agreement gives him the right to appoint or remove a majority of Velmont's board. Nothing else gives anyone control of Kappa or Velmont. Totals: Velmont 30 + 40 + 8 + 22 = 100 %; Kappa 45 + 35 + 20 = 100 %. |
| Result | Beneficial owners: **Mira** (30 % direct), **Jonas** (8 % + 45 % x 40 % = 8 % + 18 % = 26 %), **Victor** (control by other means). Not on these facts: Elif (14 %), Tom (8 %), the other shareholders (each under 5 %). |
| Why Art. 54 does not apply | Art. 52(1) multiplies along the chain "unless Article 54 applies". Art. 54 applies where ownership interest and control coexist at different layers. Here nobody controls Kappa (no one holds 50 % plus one, Art. 53(2)(c), and no other means are given) and Kappa (40 %) does not control Velmont. So the multiplication rule applies. This structure was chosen to avoid the Art. 54 exception, which the rounds review found easy to get wrong (`academy/FACTCHECK-rounds.md`, g-ubo-pick/c2). |
| Not covered | Trusts and similar arrangements (Art. 58), foundations (Art. 57), Art. 54 cases, nominee mechanics beyond a warning sign, register access rules. |
| Caption load | 308 words in 60 s (about 5.1 words a second; film 01 ran at about 6.1). Many words are numbers that are also shown as arithmetic on canvas. |
| Chapters | Hook 0:00 · Who counts 0:06 · Ownership 0:12 · Multiply, then add 0:18 · Control 0:32 · Verify 0:39 · What goes wrong 0:46 · End card 0:57 |

## Storyboard

Same world, palette and camera grammar as film 01 (see `academy/films/README.md`). The film's
central object is **the ownership chart**: company cards (as the shell cards in film 01) and
person markers (the dashed silhouette from film 01's "Beneficial owner?" reveal, now solid when
identified). Percentages travel **up** the chart as comets, so the eye follows ownership from
the customer to the people. A dashed horizontal **25 % line** is drawn across a bar meter at the
right of frame; each person's total grows as a bar and turns cool when it crosses the line.
HUD: `FICTIONAL EXAMPLE` over `Velmont Analytics`.

### S1 · Hook · 0:00 to 0:06

- **Camera**: fade from black; tight on one company card (z 1.8), pull out to z 1.1.
- **Visual**: card `Velmont Analytics BV · fictional`. Behind it, four faint warm silhouettes
  flicker in and out of focus, as if behind frosted glass. An `Orrin · fictional crypto-asset
  service provider` tag clips to the card (the customer applying).
- **Kinetic type**: `Who is behind it?` (word rise; `behind` in warm).
- **Caption C1**: One example scenario: Velmont Analytics, a fictional company, applies for an account at Orrin, a fictional crypto-asset service provider. The pattern to watch: a stake split up so that no single piece looks big.
- **Sound**: pulse; low hum under the silhouettes.

### S2 · Who counts · 0:06 to 0:12

- **Camera**: slow push (z 1.1 → 1.25).
- **Visual**: the card turns translucent; two labelled routes rise from it to the silhouettes:
  a solid line `OWNS` and a dashed line `CONTROLS`, drawn at the same time, side by side.
- **Kinetic type**: header `01 · WHO COUNTS`, headline `A natural person. Owns or controls.`
- **Caption C2**: A beneficial owner is any natural person who ultimately owns or controls a legal entity. Ownership and control are separate tests, run in parallel.
- **Sound**: two light tones, together.

### S3 · Ownership · 0:12 to 0:18

- **Camera**: pull out to the full chart, z 0.95; bar meter appears at the right with the dashed
  25 % line.
- **Visual**: Velmont's shareholders deal in above it: `Mira · 30 %` (person), `Kappa Holding Ltd
  · 40 %` (company), `Jonas · 8 %` (person), `Other shareholders · 22 % · each under 5 %` (a cluster
  of small dots). Mira's comet travels up; her bar on the meter grows to 30 %, crosses the line,
  turns cool, label `BENEFICIAL OWNER`. The small dots' bars stay short and grey.
- **Kinetic type**: header `02 · OWNERSHIP`, headline `25 % or more.` Mono footnote at the foot of
  the meter: `Lower thresholds may be set for some higher-risk types of company · Art. 52(2)`.
- **Caption C3**: Ownership means 25 % or more of the shares, voting rights or other ownership interest, directly or indirectly. Mira holds 30 % directly: she is a beneficial owner.
- **Sound**: tock as Mira's comet lands; light tone as her bar crosses the line.

### S4 · Multiply, then add · 0:18 to 0:32

- **Camera**: move up and right onto Kappa Holding (cam ease), z 1.3.
- **Visual (0:18 to 0:26)**: Kappa opens like the shell stack in film 01, revealing its owners:
  `Jonas · 45 %`, `Elif · 35 %`, `Tom · 20 %`. For each, a comet runs **two links** (person →
  Kappa → Velmont) while the arithmetic types beside the path in mono: `45 % × 40 % = 18 %`,
  `35 % × 40 % = 14 %`, `20 % × 40 % = 8 %`. On the meter, Jonas reaches 18 %, Elif 14 %, Tom 8 %:
  all below the line, warm-grey.
- **Visual (0:26 to 0:32)**: camera pulls back (z 1.3 → 1.0, 0.18 dip). Jonas's **second** route
  lights: his direct `8 %` line into Velmont. The two comets meet at his marker; the sum types
  on: `18 % + 8 % = 26 %`. His bar grows past the line, turns cool, `BENEFICIAL OWNER`. Elif and
  Tom stay below.
- **Kinetic type**: header `03 · MULTIPLY, THEN ADD`, headline `Multiply along. Add across.`
- **Caption C4** (0:18 to 0:26): Through a company, multiply along the chain. Kappa Holding owns 40 % of Velmont, and Jonas owns 45 % of Kappa: 45 % of 40 % is 18 %. Elif reaches 14 %, Tom 8 %.
- **Caption C5** (0:26 to 0:32): Then add the chains together. Jonas also holds 8 % of Velmont directly: 18 % plus 8 % is 26 %. He is a beneficial owner.
- **Sound**: a tick per arithmetic line; a two-note rise when Jonas crosses the line.

### S5 · Control · 0:32 to 0:39

- **Camera**: drift left to a person marker with no ownership line: `Victor · 0 %`, z 1.2.
- **Visual**: a document icon `Shareholders' agreement` slides in beside Victor. A dashed cool line
  runs from him to Velmont's board: five seats; three light up in sequence: `appoint or remove a
  majority`. Victor's marker turns solid cool: `BENEFICIAL OWNER · control`. On the meter, Victor
  has no bar; a separate cool tag reads `control, not shares`. Elif and Tom fade to grey with the
  label `not on these facts`.
- **Kinetic type**: header `04 · CONTROL`, headline `No shares. Still in charge.`
- **Caption C6**: Victor holds no shares, but an agreement gives him the right to appoint or remove a majority of the board. That is control by other means: he is a beneficial owner too. On these facts, Elif and Tom are not.
- **Sound**: three light tones (seats); low tone as Victor turns solid.

### S6 · Verify · 0:39 to 0:46

- **Camera**: pull back to frame three portraits in a row (Mira, Jonas, Victor), z 1.0.
- **Visual**: each portrait gets an ID card behind it and a verification tick that draws on.
  A card `Central register · extract` slides in from the right listing `Mira`. Jonas and Victor
  are missing from it; a warm `≠` appears between the register card and the chart, then an arrow
  `report the discrepancy` runs back into the register.
- **Kinetic type**: header `05 · VERIFY`, headline `The register is a check, not the answer.`
- **Caption C7**: Identify all three, take reasonable measures to verify who they are, and consult the central register as well. Differences from the register are, as a rule, reported to it.
- **Sound**: tick per verification; low tone at `≠`; light tone as the report arrow lands.

### S7 · What goes wrong · 0:46 to 0:57

- **Camera**: wide (z 0.8); the Velmont chart dims; a second, fictional chart fades in to the
  side: a chain of three companies that loops back on itself, ending in a card `Nominee
  Services Ltd · nominee` and a fogged `?`.
- **Visual (0:46 to 0:53)**: warm chips slide in under `COMMON WARNING SIGNS · NOT PROOF`:
  `Nominees with no explanation` · `Long or circular chains, no business reason` · `Owner will not
  be named`. Then a thin line from the fogged `?` to two dimmed screening icons: `sanctions check`
  and `PEP check`, both with a hollow circle (`not run on the missing owner`).
- **Visual (0:53 to 0:57)**: the fog stays. Three mono lines type on: `No one found after all
  possible means → record it` · `Identify and verify the senior managing officials` ·
  `Due diligence still not complete → do not proceed`.
- **Kinetic type**: header `WHAT GOES WRONG` (accent warm), headline `A missed owner is a missed check.`
- **Caption C8** (0:46 to 0:53): Common warning signs, not proof: nominees with no explanation, long or circular chains with no business reason, an owner who will not be named. Miss an owner and you miss the sanctions and politically exposed person checks on that person.
- **Caption C9** (0:53 to 0:57): If no one can be identified after exhausting all possible means, record that, and identify and verify the senior managing officials. If due diligence still cannot be completed, do not proceed.
- **Sound**: low tone at the loop closing; muted tones for the hollow checks.

### S8 · End card · 0:57 to 1:00

- **Kinetic type**: `Look through every layer.` / `Find the natural persons.` (`natural persons.`
  in cool). RegRadar mark. Mono footers: `AMLR · Regulation (EU) 2024/1624 · applies from 10 July
  2027` and `Fictional example. Not legal advice.`
- **Caption C10**: Look through every layer to the natural persons behind it. The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027.
- **Sound**: end chord.

### Stills (reduced motion)

| t | Heading | Still caption |
|---|---|---|
| 0:04 | Who is behind it? | Velmont Analytics, a fictional company, applies to Orrin, a fictional crypto-asset service provider. |
| 0:16 | Ownership | Mira holds 30 % directly: 25 % or more makes her a beneficial owner. |
| 0:24 | Multiply | Through Kappa Holding: 45 % × 40 % = 18 % for Jonas. |
| 0:31 | Then add | Jonas: 18 % plus 8 % directly = 26 %. |
| 0:37 | Control | Victor holds no shares but can appoint or remove a majority of the board. |
| 0:44 | Verify | Verify all three; the register is a check, and differences are reported. |
| 0:52 | What goes wrong | Nominees, circular chains, an owner who will not be named. |
| 1:00 | Look through every layer | The AMLR applies from 10 July 2027. |

## Claim ledger

Every row is the exact wording on screen (caption sentence or on-canvas text). AMLR =
Regulation (EU) 2024/1624, `docs/data/laws/32024R1624_EN.json`; AMLD6 = Directive (EU) 2024/1640.
Text in “curly quotes” in the Source column is verbatim from the JSON (checked by script on
2026-10-18). Verdicts as in the aml-basics ledger.

| # | Wording on screen | Where | Source checked | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | One example scenario: Velmont Analytics, a fictional company, applies for an account at Orrin, a fictional crypto-asset service provider. | C1, S1 tags | Invented. Crypto-asset service providers are financial institutions: AMLR Art. 2(1), point (6)(i) “a crypto-asset service provider”; obliged entities: Art. 3(2) “financial institutions” | ok, fictional | Unlike films 02 and 03, the firm type's scope is verifiable in the repo. |
| 2 | The pattern to watch: a stake split up so that no single piece looks big. | C1 | Typology, not law | ok, typology | One example of a common pattern (splitting holdings across direct and indirect routes). The law answers it by adding the chains (row 11) and taking “all shareholdings on every level” into account (Art. 52(1), second subparagraph). |
| 3 | Who is behind it? | S1 on canvas | No legal claim | ok | |
| 4 | A beneficial owner is any natural person who ultimately owns or controls a legal entity. | C2 | AMLR Art. 2(1), point (28): “‘beneficial owner’ means any natural person who ultimately owns or controls a legal entity or an express trust or similar legal arrangement” | ok | Verbatim up to "legal entity"; trusts and arrangements are left out because the film is about a company. |
| 5 | Ownership and control are separate tests, run in parallel. | C2, S2 two routes drawn together | AMLR Art. 51: natural persons who (a) “have, directly or indirectly, an ownership interest” “or” (b) “control, directly or indirectly, the corporate or other legal entity, through ownership interest or via other means”; second paragraph: “Control via other means ... shall be identified independently of and in parallel to the existence of an ownership interest or control through ownership interest.” | ok, paraphrase | Strictly, "in parallel" is said of control **via other means**. Control through ownership interest (50 % plus one, Art. 53(2)(c)) is part of the ownership side. Reviewer: is "separate tests, run in parallel" acceptable, or should it read "Control by other means is checked in parallel with ownership"? (the fallback). |
| 6 | A natural person. Owns or controls. | S2 headline | Art. 2(1), point (28); Art. 51 | ok | |
| 7 | Ownership means 25 % or more of the shares, voting rights or other ownership interest, directly or indirectly. | C3, S3 headline `25 % or more.`, dashed 25 % line | AMLR Art. 52(1): “direct or indirect ownership of 25 % or more of the shares or voting rights or other ownership interest in the corporate entity” | ok | "or more": exactly 25 % counts (the older "25 % plus one share" wording is not the AMLR test; see curriculum question). |
| 8 | Lower thresholds may be set for some higher-risk types of company · Art. 52(2) | S3 footnote | AMLR Art. 52(2): the Commission may adopt delegated acts identifying categories of corporate entities “associated with higher money laundering and terrorist financing risks and for which a lower threshold shall apply”; “a maximum of 15 %” unless a higher threshold is more proportionate, “in any case ... less than 25 %” | ok | "may be set" because the delegated acts are not adopted (Commission assessment "By 10 July 2029"). No figure shown, to keep it simple. |
| 9 | Mira holds 30 % directly: she is a beneficial owner. | C3, S3 bar | Art. 52(1); 30 % ≥ 25 % | ok, fictional | |
| 10 | Through a company, multiply along the chain. Kappa Holding owns 40 % of Velmont, and Jonas owns 45 % of Kappa: 45 % of 40 % is 18 %. Elif reaches 14 %, Tom 8 %. | C4, S4 arithmetic `45 % × 40 % = 18 %`, `35 % × 40 % = 14 %`, `20 % × 40 % = 8 %` | AMLR Art. 52(1): “The indirect ownership shall be calculated by multiplying the shares or voting rights or other ownership interests held by the intermediate entities in the chain of entities in which the beneficial owner holds shares or voting rights” ... “unless Article 54 applies” | ok, arithmetic checked | 0.45 × 0.40 = 0.18; 0.35 × 0.40 = 0.14; 0.20 × 0.40 = 0.08. Art. 54 does not apply (see brief, "Why Art. 54 does not apply"). |
| 11 | Then add the chains together. Jonas also holds 8 % of Velmont directly: 18 % plus 8 % is 26 %. He is a beneficial owner. | C5, S4 sum `18 % + 8 % = 26 %` | AMLR Art. 52(1): “and by adding together the results from those various chains”; first sentence: “direct or indirect ownership of 25 % or more”; second subparagraph: “all shareholdings on every level of ownership shall be taken into account” | ok, interpretation to confirm | The text says "adding together the results from those various chains". Treating Jonas's direct 8 % as one chain and adding it to the 18 % indirect result is the author's reading, supported by "direct or indirect ownership" and "all shareholdings on every level". **Reviewer: attack this first.** |
| 12 | Multiply along. Add across. | S4 headline | Summary of rows 10 and 11 | ok | |
| 13 | Victor holds no shares, but an agreement gives him the right to appoint or remove a majority of the board. | C6, S5 seats `appoint or remove a majority` | AMLR Art. 53(3)(b): control via other means “shall in any case include the possibility to exercise” “the right to appoint or remove a majority of the members of the board or the administrative, management or supervisory body”; Art. 53(4)(a): other means may include “formal or informal agreements with owners, members or the legal entities” | ok, fictional facts | |
| 14 | That is control by other means: he is a beneficial owner too. | C6, S5 tag `BENEFICIAL OWNER · control` | AMLR Art. 51(b) and Art. 53(3)(b) | ok | |
| 15 | On these facts, Elif and Tom are not. | C6, S5 label `not on these facts` | Art. 52(1) (14 % and 8 % are below 25 %); no control facts given for them; Art. 53(2)(c): control through ownership is “50 % plus one”, and neither holds that in Kappa | ok | "On these facts" keeps it conditional (Art. 53(3)(a) "acting in concert" and Art. 53(4) other means could change it; the scenario gives none). |
| 16 | Identify all three, take reasonable measures to verify who they are, | C7, S6 ticks | AMLR Art. 20(1)(b): “identifying the beneficial owners and taking reasonable measures to verify their identity”; Art. 22(7) (means of verification) | ok | |
| 17 | and consult the central register as well. | C7, S6 headline `The register is a check, not the answer.` | AMLR Art. 22(7), last subparagraph: “In addition to the means of verification set out in the first subparagraph of this paragraph, obliged entities shall verify the information on the beneficial owners by consulting the central registers.” | ok | "as well" and "a check, not the answer" reflect "In addition to". |
| 18 | Differences from the register are, as a rule, reported to it. | C7, S6 arrow `report the discrepancy` | AMLR Art. 24(1): report “any discrepancies they find between the information available in the central registers and the information they collect”, “without undue delay and, in any case, within 14 calendar days”; 24(2): may instead ask the customer for minor errors or outdated data (not in higher-risk cases); 24(3) | ok, "as a rule" covers 24(2) | Draft said "If the register says something different, report it", which ignored the 24(2) derogation. The 14-day limit is not shown. |
| 19 | Common warning signs, not proof: nominees with no explanation, long or circular chains with no business reason, an owner who will not be named. | C8, S7 chips | Practice wording, from `curriculum.json` beneficial-ownership `redflags`. Legal hooks (not shown): Art. 22(1)(b)(iv) (names of nominee shareholders and directors, with their status); Art. 53(4)(c) (nominee arrangements as means of control) | ok, typology | |
| 20 | Miss an owner and you miss the sanctions and politically exposed person checks on that person. | C8, S7 hollow checks | AMLR Art. 20(1)(d) (whether “the beneficial owners are subject to targeted financial sanctions”) and 20(1)(g) (whether “the beneficial owner of the customer” is a politically exposed person) | ok, consequence stated plainly | The checks attach to beneficial owners, so a missed owner is not checked. Wider consequence (fines for serious, repeated or systematic breaches of Chapter III, AMLD6 Art. 55(1)(b)) is not on screen to keep the beat short; reviewer may ask to add it. |
| 21 | A missed owner is a missed check. | S7 headline | Summary of row 20 | ok | |
| 22 | If no one can be identified after exhausting all possible means, record that, and identify and verify the senior managing officials. | C9, S7 lines | AMLR Art. 22(2), second subparagraph: “Where, after having exhausted all possible means of identification, no natural persons are identified as beneficial owners, or where there are doubts that the persons identified are the beneficial owners, obliged entities shall record that no beneficial owner was identified and identify all the natural persons holding the positions of senior managing officials in the legal entity and shall verify their identity.” | ok | Not shown: the "doubts" branch, and the third subparagraph (no verification where it may tip off the customer; record the steps instead). |
| 23 | If due diligence still cannot be completed, do not proceed. | C9, S7 line `Due diligence still not complete → do not proceed` | AMLR Art. 21(1): “shall refrain from carrying out a transaction or establishing a business relationship” | ok, shortened | Art. 21(1) also requires ending an existing relationship and considering a report to the FIU (covered in film 03). |
| 24 | Look through every layer to the natural persons behind it. / Look through every layer. Find the natural persons. | C10, S8 end card | AMLR Art. 52(1), second subparagraph (“all shareholdings on every level of ownership”); Art. 2(1), point (28) | ok | "Natural persons" kept as in the text (gate rule 4). |
| 25 | The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027. | C10, footer | AMLR Art. 90 | ok | |
| 26 | Mira · Jonas · Elif · Tom · Victor · Kappa Holding Ltd · Velmont Analytics BV · Orrin · Nominee Services Ltd · Other shareholders 22 % (each under 5 %) · every percentage | on canvas | Invented | ok, fictional | Checked: Velmont 30 + 40 + 8 + 22 = 100; Kappa 45 + 35 + 20 = 100. "Nominee Services Ltd" appears only in the warning-sign chart. |

### On-canvas text index

Every string drawn on the canvas (gate step 6: the words on screen are the words checked), with the
ledger row that covers it. Scene numbers in headers (`01 ·`, `02 ·` ...) count scenes, not laundering stages.

| On-canvas text | Scene | Ledger row |
|---|---|---|
| HUD `FICTIONAL EXAMPLE` / `Velmont Analytics` · `Velmont Analytics BV · fictional` · `Orrin · fictional crypto-asset service provider` | S1, all | 1, 26 |
| `Who is behind it?` | S1 | 3 |
| `01 · WHO COUNTS` · `A natural person. Owns or controls.` · `OWNS` · `CONTROLS` | S2 | 4 to 6 |
| `02 · OWNERSHIP` · `25 % or more.` · dashed 25 % line | S3 | 7 |
| `Lower thresholds may be set for some higher-risk types of company · Art. 52(2)` | S3 | 8 |
| `Mira · 30 %` · `Kappa Holding Ltd · 40 %` · `Jonas · 8 %` · `Other shareholders · 22 % · each under 5 %` · `Jonas · 45 %` · `Elif · 35 %` · `Tom · 20 %` · `Victor · 0 %` | S3 to S5 | 26 (fictional; sums checked) |
| `BENEFICIAL OWNER` (Mira) | S3 | 9 |
| `03 · MULTIPLY, THEN ADD` · `Multiply along. Add across.` · `45 % × 40 % = 18 %` · `35 % × 40 % = 14 %` · `20 % × 40 % = 8 %` | S4 | 10, 12 |
| `18 % + 8 % = 26 %` · `BENEFICIAL OWNER` (Jonas) | S4 | 11 |
| `04 · CONTROL` · `No shares. Still in charge.` · `Shareholders' agreement` · `appoint or remove a majority` · `BENEFICIAL OWNER · control` · `control, not shares` | S5 | 13, 14 |
| `not on these facts` | S5 | 15 |
| `05 · VERIFY` · `The register is a check, not the answer.` · `Central register · extract` · `≠` · `report the discrepancy` | S6 | 16 to 18 |
| `Nominee Services Ltd · nominee` · `COMMON WARNING SIGNS · NOT PROOF` · `Nominees with no explanation` · `Long or circular chains, no business reason` · `Owner will not be named` | S7 | 19, 26 |
| `sanctions check` · `PEP check` · `not run on the missing owner` · `WHAT GOES WRONG` · `A missed owner is a missed check.` | S7 | 20, 21 |
| `No one found after all possible means → record it` · `Identify and verify the senior managing officials` · `Due diligence still not complete → do not proceed` | S7 | 22, 23 |
| `Look through every layer.` / `Find the natural persons.` · `AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027` · `Fictional example. Not legal advice.` | S8 | 24 to 26 |

### For the independent reviewer: attack these first

1. **Row 11**: adding a direct holding (8 %) to an indirect chain result (18 %). The text speaks of
   "adding together the results from those various chains"; confirm a direct holding counts as a
   chain for this purpose.
2. **Row 10 / brief**: confirm Art. 54 does not apply to this structure (no control of Kappa,
   Kappa does not control Velmont).
3. **Row 5**: "separate tests, run in parallel" versus the text's "control via other means ...
   identified independently of and in parallel to".

### Not verified against a primary source held in the repo

- The typology label (row 2) and the warning signs (row 19) are practice wording. FATF
  Recommendations 24 and 25 are named as further reading in the curriculum, not held in the repo.
- Nothing else: every legal row above was checked in `docs/data/laws/32024R1624_EN.json`.
