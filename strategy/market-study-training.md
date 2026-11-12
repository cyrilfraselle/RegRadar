# Market study: AML training as RegRadar's first paid product

Date: 18 October 2026. Every web source was retrieved on 18 October 2026
(see Appendix C). This is not legal advice. Prices below are either quoted
from a public page (with the source) or marked **HYPOTHESIS** or **ESTIMATE**.

---

## Executive summary

1. The law creates the demand: AMLR Art. 12 requires training that is "specific", "ongoing", fits each role and the firm's own risks, and is "duly documented". It applies from 10 July 2027.
2. Art. 12 also says staff must know the firm's **own** risk assessment, policies and procedures. A generic course does not cover that part on its own. This is the strongest hook.
3. Supervisors have criticised generic training: the Irish central bank, the CSSF (a course built only on UK rules) and the EBA (weak training at payment institutions).
4. Market: 767 payment institutions, 342 e-money institutions and 354 CASPs are active in the EU27 (EBA and ESMA registers, 18 Oct 2026). About 1,350 core firms. No public data shows how many staff they have.
5. Generic e-learning is crowded and cheap: £32 to £88 per user per year from UK vendors, and some material is free. RegRadar should not compete on a standard course alone.
6. Tailored training is offered by most vendors, but always "on request". No public price, and no vendor found that builds training from a client's policies with paragraph citations and an audit-ready evidence pack.
7. Do-it-yourself AI tools (document-to-video, document-to-course) already exist from about $18 a month. Turning a document into a video is not a moat. Accuracy, citations, sign-off and evidence are.
8. The policy gap tool is a real category, with young but direct competitors (Govix, Cardamon, CUBE/Kodex AI, Sia Partners). Run it as a service inside the training pilot first. Build the tool later.
9. Recommendation: **TEST** a paid, fixed-price "tailored training + evidence pack" pilot, with a light gap review included. Do not build a standard catalogue yet.
10. In the next 4 weeks: 12 interviews, 1 landing page, a pilot offer to 15 firms, a mock evidence pack shown to practitioners, and 1 concierge gap review. The bar is 2 paid pilots or 3 written letters of intent.

---

## 1. The need and the hook

### What the law says (AMLR, Regulation (EU) 2024/1624)

| Article | What it requires (plain language) |
|---|---|
| Art. 9(2)(a)(x) | A written **training policy** for employees and, where relevant, agents and distributors. |
| Art. 12, para 1 | Staff (and agents and distributors) must know the AML rules **and** the firm's own business-wide risk assessment, policies, procedures and controls, including on personal data. |
| Art. 12, para 2 | "Specific, ongoing training programmes", "appropriate to their functions" and the firm's risks, and "duly documented". |
| Art. 11 | A management-body member (the "compliance manager") must make sure there are enough resources. A compliance officer runs AML day to day. |
| Art. 90 | Applies from **10 July 2027**. |

Source: verbatim text in `docs/data/laws/32024R1624_EN.json` (EUR-Lex CELEX 32024R1624).

**Why this matters commercially (inference):** by mid-2027 most firms must rewrite their policies for the AMLR (Art. 9) and then train staff on the new versions (Art. 12). That gives a deadline-driven reason to buy in late 2026 and the first half of 2027.

### What a supervisor or auditor expects as evidence

No EU-level list of training evidence exists yet. The most detailed public list we found is from the Central Bank of Ireland's AML/CFT Guidelines (2021), section 8 and 9.2.8. It is an Irish text, but it is a useful benchmark:

| Expectation | CBI Guidelines section |
|---|---|
| Train everyone on the firm's own risk assessment, AML policy and procedures | 8.1 |
| Role-specific training; extra training for the MLRO and senior management | 8.2 |
| New joiners trained promptly; everyone at least once a year | 8.3 |
| Senior management oversees training and keeps content up to date | 8.4 |
| Outsourced providers' staff trained too | 8.5 |
| Records: who, what type, what date | 8.7 |
| A test that must be passed, or other proof that training worked | 8.8 |
| Management information: completion and pass rates | 8.9 |
| Keep dates, attendance, content and test results | 9.2.8 |

A French guide from a legal-tech vendor (Leto) describes similar market practice: named, dated records per employee, the module version, and proof that content was updated after rule changes. It is a vendor source, so treat it as indicative.

**The RegRadar evidence pack** should map one-to-one to the table above. This is something a buyer can check.

### Documented supervisory findings on training

| Who | When | Finding | Source |
|---|---|---|---|
| Central Bank of Ireland: Campbell O'Connor & Co. | May 2019 | €280,000 fine. One listed breach was "failure to provide training to staff on identifying suspicious transactions" | CBI enforcement notice |
| Central Bank of Ireland: review of retail intermediaries | Aug 2016 | Training records were not always kept. Some staff got only "generic, high level" training with little firm-specific content | CBI Intermediary Times AML edition |
| CSSF (Luxembourg): ActivTrades Europe | Dec 2024 (announced Apr 2025) | €14,000 fine. Findings included AML training "based solely on UK regulations" | Paperjam (press report of the CSSF decision) |
| EBA: report on payment institutions (EBA/REP/2023/18) | June 2023 | Supervisors cited "lack of rigorous training", especially where agents are used | EBA report, p. 14 |

**Not found:** a published sanction against an EU payment, e-money or crypto firm where training was the main breach. Training usually appears as one finding among several, so the fear of a fine alone is a weak sales argument. "Your inspector will ask for this file" is stronger.

### AMLA

AMLA starts its first selection of directly supervised firms by 1 July 2027 (AMLAR, Regulation (EU) 2024/1620, Art. 13). Direct supervision of up to 40 cross-border groups (active in at least 6 Member States) starts on 1 January 2028 (Jones Day summary). Almost all small and mid-sized firms will stay with their national supervisor. AMLA is a reason to expect more consistent supervision across the EU. It is not a direct buyer trigger for small firms.

---

## 2. Market size (bottom-up, bounded)

### Firm counts (active, 18 October 2026)

| Segment | EU27 | Plus NO/IS/LI | Source and method |
|---|---|---|---|
| Authorised payment institutions (PSD_PI) | **767** | 31 | EBA register full download (file of 18 Oct 2026, 16:00 UTC). "Active" = no withdrawal date recorded |
| Authorised e-money institutions (PSD_EMI) | **342** | 14 | Same |
| Account information service providers only | 86 | 1 | Same |
| Exempt (small) payment institutions | 1,072 (927 of them in Poland) | 4 | Same |
| Exempt (small) e-money institutions | 47 | 0 | Same |
| CASPs on ESMA interim MiCA register | **354** distinct entities | 19 | ESMA CASPS.csv (last update in file: 15 Oct 2026) |
| ...of which notified under MiCA Art. 60 (banks, investment firms etc.) | 114 | | Same |
| ...authorised under Art. 63 or basis not stated | 240 | | Same |
| Payment agents (agent records) | 325,271 records | | EBA register. Status not checked, so treat as an upper bound |

Caveats: the EBA says its register "has no legal significance" and depends on national authorities. My "active" rule is my reading of the date fields. Firms holding both an EMI licence and a CASP licence are not de-duplicated.

**Staff numbers by firm: not found** at EU level. The only proxy found: Lithuania had 248 fintech companies and about 7,800 fintech employees at the end of 2025 (Invest Lithuania). **ESTIMATE:** 7,800 / 248 ≈ 31 staff per company on average. This covers all fintechs, not only licensed ones, so it is only a rough signal that typical firms are small.

### Core addressable firms (ESTIMATE)

- Core = PIs + EMIs + CASPs that are not Art. 60 notifications = 767 + 342 + 240 = **≈1,350 firms** (upper bound, because of possible overlap).
- Six English-friendly hubs (IE, MT, CY, LT, LU, NL) = 193 PIs + 208 EMIs + 99 CASPs = **≈500 firms**. This is a possible beachhead. The hub choice is an assumption to confirm with the founder.

### What revenue could look like (ESTIMATE, illustrative only)

Prices are the HYPOTHESIS ranges from section 5, not facts.

| Share of 1,350 firms won | Firms | At €2,000/yr | At €6,000/yr |
|---|---|---|---|
| 1% | 13 | €26,000 | €78,000 |
| 3% | 40 | €80,000 | €240,000 |
| 5% | 67 | €134,000 | €402,000 |

To reach €100,000 a year you would need 100,000 / 6,000 ≈ 17 firms at the top price, or 100,000 / 2,000 = 50 firms at the bottom price. **Reading:** training alone is a real but modest business at this firm count. It is useful as a wedge and to fund development. It is not big enough to be the whole company, which fits the "compliance OS" vision.

---

## 3. Competitor landscape

Only vendors whose offer I checked on their own site (or an official document) are listed. Prices are shown only where they were published.

### A. AML e-learning and awareness vendors

| Vendor | What, for whom | Format | Public price | Strengths | Gaps vs RegRadar idea |
|---|---|---|---|---|---|
| Skillcast (UK) | Compliance e-learning library, including financial crime | Own LMS or your LMS; course authoring on Premium | From £32 / £39 / £72 per user per year (average of 200 users) | Large library, LMS, policy hub | UK-centred; pricing assumes larger firms; tailoring is via authoring tools |
| iHasco (UK) | General compliance e-learning (no AML mention on the pricing page) | Subscription, 250+ courses | £5.85 to £7.30 per learner per month for 30 learners (≈£70 to £88 per year, my arithmetic) | Cheap, simple | Not AML-specialist, not EU-specific |
| VinciWorks (UK) | AML base courses, refreshers, deep dives | Astute LMS, SCORM, course builder, bespoke service | Not published | Short refreshers, gamification, bespoke | Lists EU directives (AMLD5/6) on the course page, not the AMLR |
| SAI360 | Ethics and compliance library, including AML | Course editor, own or client LMS | Not published | Role scenarios, many languages | AML page targets the APAC region; enterprise focus |
| Thomson Reuters Compliance Learning | AML/CTF course families | 40+ languages, completion audit records | Not published | Brand, audit records | Enterprise focus; catalogues seen were regional and dated |
| CMS Client Academy (law firm, DE) | AML e-learning (about 40 min), aimed at industry and trade | SaaS or SCORM; can be adapted to the firm's risks | On request | Law-firm credibility, SCORM, tailoring | German non-financial sector focus |
| Haufe Akademie (DE) | AML e-learning for all staff, 9 languages | E-learning | Not published | Reach in Germany | Generic |

### B. Certification bodies and course providers (individual learners)

| Provider | Offer | Public price | Note |
|---|---|---|---|
| ACAMS | CAMS certification package (eLearning, study guide, exam) | US$2,095 private sector / US$1,595 public sector; membership required (2026 factsheet) | For compliance professionals, not firm-wide staff training. A possible channel or complement, not a direct rival |
| EIMF (Cyprus-linked) | Live-online courses, e.g. "AML and Fraud Risk Management for EMIs" (6 h, CPD, certificate); in-house group delivery on request | €170 to €290 per listing; EU AML package course €160 to €280 | The closest EU, EMI-specific trainer. Live sessions, not a staff-evidence system |

### C. Free material (price pressure)

- **Basel LEARN** (Basel Institute on Governance): free self-paced courses with completion certificates, aimed at investigators and analysts.
- **FIAU Malta**: CPE-accredited supervisor training sessions (price not stated on the page).
- Supervisor guidance itself (for example the CBI Guidelines) is free and is what MLROs build in-house slides from.

### D. Do-it-yourself AI tools (the real threat to "motion design")

| Tool | What it does | Public price |
|---|---|---|
| Synthesia | AI avatar video from scripts/docs; SCORM on Enterprise | Free tier; Starter $29/mo monthly or about $18/mo yearly; Pro $89/mo or $64/mo yearly (the page shows some inconsistent figures) |
| Vyond | Animation, including "Document to Video" from PDF/Word | $699 to $1,999 per user per year |
| Easygenerator | Course authoring with AI; SCORM; Frankfurt data centre | $1,499/yr (Pro, 1 author, 100 learners) to $7,495/yr (Team) |
| Coursebox | Says it builds a full course from an uploaded policy or regulation | Free tier; paid tiers not shown in the page text |

**Reading:** an MLRO can already turn a policy into a slick video for under €100 a month. What these tools do not offer (as far as their pages show): an AML-specific check against the law, paragraph-level citations back to the policy, a sign-off workflow, an "out of date when the policy changes" flag, and an inspection-ready evidence file.

### E. "Tailored from your policies"

Bespoke courses are common (VinciWorks bespoke service, CMS adapted courses, EIMF in-house sessions, Skillcast authoring). None of them publishes a price or describes citations back to the client's policy paragraphs. **Inference:** today, tailoring is a services sale priced by quote.

### Where RegRadar can differ (to be validated)

1. **AMLR-native and sector-native** (PI/EMI/CASP scenarios, agents, crypto transfers), not UK- or directive-based.
2. **Built from the client's own BWRA and policies**, with every scene citing the policy paragraph and the AMLR article. This directly addresses Art. 12 para 1.
3. **Evidence by design**: a register of who, what version, when and score, plus management information, mapped to the CBI-style checklist.
4. **Linked to the rest of the OS**: training becomes evidence for the Art. 12 obligation in the RegRadar register.

---

## 4. Willingness to pay: evidence vs inference

### Evidence (published prices)

| Type | Price point | Source |
|---|---|---|
| Generic compliance e-learning per seat (UK) | £32 to £72 per user per year (200-user average) | Skillcast |
| Generic e-learning, small team | ≈£70 to £88 per learner per year at 30 learners | iHasco |
| Live-online EU AML course per participant | €160 to €290 | EIMF |
| Individual AML certification | US$2,095 | ACAMS |
| DIY authoring and video tools | about $18/mo to $1,999 per user per year | Synthesia, Vyond, Easygenerator |
| Bespoke or tailored training | **not published by anyone checked** | n/a |
| Policy gap assessment (tool or consultancy) | **not published by anyone checked** | n/a |

### Inference (to test, not proven)

- Per-seat prices for generic content are low and anchored by UK vendors. With ~30 staff, a generic course costs a firm roughly £2,000 to £2,600 a year (**ESTIMATE**: 30 × £70 to £88). That is a ceiling for "standard path" pricing.
- Firms pay more for things a supervisor will look at: tailored content and evidence. But no public price proves how much more.
- **Not found:** analyst reports with reliable EU AML-training spend figures. Paywalled "market size" reports were not used.

---

## 5. Pricing hypotheses to test (not facts)

| # | Offer | HYPOTHESIS range | Reasoning | What would disprove it |
|---|---|---|---|---|
| H1 | Standard AMLR path (PI/EMI/CASP), per firm per year, up to ~30 learners, with evidence register | €1,500 to €3,500 per firm per year (≈€50 to €115 per learner) | Just above the UK generic per-seat level, justified by AMLR- and sector-specific content and evidence | Most interviewees already pay less or use free/in-house material and will not switch even at the low end |
| H2 | Tailored module built from the client's policy (one topic, e.g. onboarding/EDD or agent oversight), fixed-fee pilot | €3,000 to €8,000 per module, one-off | A services-like deliverable that replaces consultant or MLRO time; it must cover at least the founder's time | Fewer than 2 of 15 offered firms accept any price in the range, or they only accept below the lower bound |
| H3 | Evidence pack (register, certificates, MI report, export for inspection) | Included in H1/H2; or €500 to €1,500 per year as an add-on for firms using another course provider | Evidence is the part supervisors check; it may sell on its own to firms already on Skillcast-type tools | Buyers say their LMS already produces enough evidence |
| H4 | Policy gap review (concierge, one policy vs AMLR, cited, human-confirmed) | €2,000 to €6,000 per policy, or bundled into H2 | Ahead of July 2027, every firm must re-check its policies against the AMLR | Buyers see it as something their law firm or auditor already does, or will not share policies |

Use interviews (Appendix A, Q8 and Q9) and the pilot offer (Appendix B) to narrow these ranges. Do not publish any price until at least one pilot has been paid.

---

## 6. Buyer, sales cycle and channels

**Who uses it:** the AML compliance officer / MLRO (Art. 11(2)). They own the training policy and must produce the records.

**Who signs (inference):** in a firm of under ~50 people, the CEO, COO or the management-body member responsible for AML (Art. 11(1) "compliance manager"). In larger firms, procurement and information security also get involved.

**What proof they need (inference, check in interviews):**
1. A sample module on a topic they know, with citations they can check.
2. The evidence pack and how it answers an inspector's request.
3. Data protection: where policies are stored, which AI model sees them, no training on their data, a DPA.
4. Vendor due diligence. Under DORA (Art. 2 and Art. 28(3)), PIs, EMIs and CASPs must record **all** ICT service contracts in a register of information, so expect a security questionnaire even for a small tool.
5. Who is behind it. The founder's compliance background matters, because there are no customer references yet. No invented logos or claims.

**Sales cycle (inference, no data found):** for small firms, probably weeks to about 3 months from first call to signature. Faster if tied to a dated trigger: an inspection notice, an audit finding, a new licence, or the AMLR rewrite.

**Channels to test (inference):**
- Direct LinkedIn outreach to MLROs in the hub countries.
- Outsourced-MLRO and compliance consultancies that serve many small EMIs/CASPs (white-label or referral).
- Law firms and auditors who find training gaps but do not build training.
- Industry associations and events in the hub countries (names to be chosen by the founder).

**Pilot shape:** fixed scope (one tailored module + standard core + evidence pack + light gap note), fixed price, 4 to 6 weeks, client sign-off before release, a written success criterion, and an option to convert to an annual licence. See Appendix B.

---

## 7. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Liability for content errors | A training scene that misstates the law or the policy can teach staff the wrong thing | Citations on every scene; client sign-off before release; "not legal advice" in the contract; liability cap; check professional indemnity insurance before the first paid pilot |
| Confidentiality of client policies | Policies reveal controls and weaknesses; some contain personal data | NDA + DPA; EU hosting; bring-your-own-key or no-retention AI; redaction; never train on client data (already in VISION.md) |
| Outsourcing rules | AMLR Art. 18 says outsourced AML tasks must be notified to the supervisor beforehand. Whether a training provider counts is an **open question**. Ask the pilot firm's counsel; do not assert either way | Position as a tool and content supplier; the firm keeps ownership of its training programme |
| LMS / SCORM expectations | Competitors offer SCORM (CMS, VinciWorks, Synthesia Enterprise, Easygenerator). Larger buyers may require it | Ask in interviews; offer CSV/PDF evidence exports first; add SCORM export only if 3+ prospects require it |
| Free and DIY alternatives | Basel LEARN, supervisor guidance, and AI video tools at about $18/mo | Do not sell "video". Sell "AMLR-specific, cited, signed-off, evidenced" |
| Price pressure | UK per-seat prices of £32 to £88 per year | Price per firm, not per seat; bundle evidence; avoid head-to-head with catalogues |
| Founder capacity / becoming a consultancy | Tailored modules are partly services | Fixed scope; reuse a scene library; cap the number of pilots (for example 3 at once); turn every pilot into reusable templates |
| Strategy drift | The current agreed wedge (ROADMAP, LOG of 16 Oct 2026) is horizon scanning + register + evidence | Frame training as the paid entry into the register: Art. 12 evidence is one obligation in the register, and tailored training needs the policy library anyway |

---

## 8. The policy gap assessment tool

**What it is:** compare a firm's policy with the AMLR (and guidance and the firm's other policies), list gaps with citations, and have a human confirm them. In RegRadar terms, this is the AI "Reviewer" slice (A4 in VISION.md).

### Competitors (verified on their own sites or press releases)

| Who | What | Note |
|---|---|---|
| Govix GapSure (Jersey, founded 2025) | Maps policies against a regulatory knowledge base, starting with the Jersey AML/CFT handbook; drafts fixes for human approval; audit pack | Closest match to the RegRadar idea; no price published |
| Cardamon (London / New York) | Gap analysis of controls and policies vs obligations; traceable matches; approval sign-off | Claims 60+ jurisdictions; no price published |
| Sia Partners RegMatcher | LLM mapping of regulations to internal policies; gap analysis; human review | A consultancy product |
| CUBE + Kodex AI | CUBE (regulatory change) bought Berlin-based Kodex AI in October 2025; gap analysis is among its features | Enterprise focus |
| Corlytics + Clausematch | Policy management plus regulatory mapping; Clausematch acquired in 2023 | Tier-1 banks |

Regology also advertises "policy gap analysis", but its help page was behind a login, so I could not verify it.

**Willingness to pay: not found.** No vendor or consultancy publishes a price for an AML policy gap review. Treat H4 as a pure hypothesis.

**How RegRadar could differ:** verbatim law already in the repo, quote-checking (VISION "Verifiable"), EU payment/crypto focus, an affordable fixed price for small firms, and direct links into the obligation register and training. The idea is not new, so the edge must be accuracy and price for small firms.

**Before or after training?** **Alongside, as a service, then after as a product.** Building a tailored training module means reading the client's policy closely anyway, so a short "gaps we noticed" note is a cheap by-product that shows value. But a gap tool carries more liability (it reads like an opinion on compliance), faces direct funded competitors, and needs much stronger accuracy tests. Productise it only after 3 to 5 pilots have produced a golden test set.

---

## 9. Recommendation

### Decision table

| Option | Decision | Why |
|---|---|---|
| (a) Standard AML path sold alone | **NO-GO for now** (keep as part of the bundle) | Crowded, cheap, free alternatives; no differentiation on its own |
| (b) Tailored training from client policies + evidence pack | **TEST (lead offer)** | Directly tied to Art. 12 para 1; supervisors have criticised generic training; no public competitor offers cited, signed-off, evidenced tailoring for small EU payment and crypto firms |
| Motion-design explainers | **TEST cheaply** | Use the existing in-page explainer player; do not invest in video production while DIY tools are this cheap |
| Evidence pack / certificates | **GO (build into every offer)** | Low cost; maps to a concrete supervisor checklist |
| (c) Gap assessment | **TEST as a concierge add-on**; tool later | Real need before July 2027, but direct competitors and higher liability |
| SCORM / LMS integration | **Defer** | Build only if 3+ prospects need it |

### The 5 cheapest experiments (next 4 weeks)

| # | Experiment | Cost | Success threshold |
|---|---|---|---|
| 1 | **12 design-partner interviews** (MLROs at PIs/EMIs/CASPs, mostly in the hub countries) using Appendix A | Time only | At least 6 of 12 rank training evidence or AMLR retraining in their top 5 pains, **and** at least 4 share their current spend or setup |
| 2 | **Landing page with two offers** ("AMLR staff path" vs "Training built from your policies"), each with a "request a pilot slot" button, shown to targeted visitors through outreach | Free hosting + time | At least 150 targeted visitors and at least 5 pilot requests; the tailored offer gets at least 2x the requests of the standard one |
| 3 | **Fixed-price pilot offer** (Appendix B) sent to 15 warm prospects, with a price chosen inside the H2 range | Time | At least 2 paid pilots, or at least 3 signed letters of intent at a stated price, within 4 weeks |
| 4 | **Mock evidence pack review**: show a sample register, certificate and MI report to 3 practitioners (an MLRO, an internal auditor, an ex-supervisor if possible) | Time | At least 2 of 3 say it would answer an inspection request with only minor changes |
| 5 | **Concierge gap review**: one real policy from a design partner (under NDA), or a public sample policy, checked against the AMLR using the Reviewer flow | Time | The partner rates it at least 4/5 for usefulness, accepts at least 70% of flagged gaps as valid, and gives a price they would pay |

**Stop rule:** if, after 4 weeks, experiments 1 and 3 both miss their thresholds, park training as a paid wedge. Keep the Academy as free marketing for the register.

---

## Appendix A: design-partner interview guide (10 questions, about 30 minutes)

Do not pitch first. Ask, listen, take notes, and ask for documents only at the end.

1. Tell me about your firm: licence type, countries, headcount, and how many people need AML training (including agents or distributors).
2. Walk me through how AML training works today: who builds it, which tools or vendors, how often, and how long it takes you each year.
3. What did your last inspection or audit ask about training? What did you hand over? Was anything criticised?
4. How much of your current training is about **your own** risk assessment and procedures, rather than general AML? How do you prove that?
5. What will change in your policies for the AMLR (July 2027), and how do you plan to retrain people on the changes?
6. If you could stop doing one training-related task tomorrow, which would it be?
7. Do you have an LMS? Must training run inside it (SCORM), or is a separate link with exports fine?
8. What do you spend today on AML training (licences, external trainers, your own time)? Who approves that spend?
9. If someone built a module from your own policy, with every slide citing the paragraph, and you signed it off, what would that be worth to you as a one-off price? What would be "too expensive"?
10. What would you need to see (security, data handling, references, a sample) before sharing a policy with a small vendor? Would you try a paid pilot in the next 2 months?

Close by asking: "Can I send you a one-page pilot offer?" and "Who else should I talk to?"

---

## Appendix B: one-page pilot offer (draft)

**RegRadar pilot: AMLR training built from your own policies**

**For:** [Firm name], [licence type], [country]
**Duration:** 4 to 6 weeks from kick-off
**Price:** [PRICE: choose within the H2 range in section 5; do not publish before the first paid pilot] fixed, excluding VAT. Optional annual continuation at [PRICE: H1 range].

**What you get**
1. **One tailored module** on a topic you choose (for example onboarding and EDD, agent oversight, crypto transfers), built from your current policy and procedures. Every scene cites the paragraph of your policy and the AMLR article it relies on.
2. **The standard AMLR core path** for your sector (short explainers, a scenario game and a test).
3. **Evidence pack:** a named, dated completion register with module version and score; certificates; and a management summary of completion and pass rates. Exportable as CSV and PDF.
4. **"Gaps we noticed" note:** a short list of points where your policy and the AMLR text seem out of line, with citations. You decide what to do with it. This is not an audit or legal opinion.

**How it works**
- Week 1: kick-off call; you share the policy under NDA and DPA.
- Weeks 2 to 3: we draft the storyboard; you review and **sign off** every scene before release.
- Weeks 4 to 6: your staff take the training; we hand over the evidence pack.

**Your data**
- Documents are processed in the EU and never used to train AI models. AI use is labelled and logged. [Hosting and AI provider details to be confirmed before signing.]
- You keep ownership of your policies and of the tailored module.

**Success criteria (agreed at kick-off)**
- [e.g. at least 90% of in-scope staff complete within the window]
- [e.g. MLRO confirms the evidence pack would be submitted as-is for an inspection request]

**What RegRadar is not:** not legal advice and not an audit opinion. You remain responsible for your AML programme and for approving the content.

**Contact:** [founder name, email]

---

## Appendix C: sources

All retrieved 18 October 2026.

| # | Title | URL | Supports |
|---|---|---|---|
| 1 | Regulation (EU) 2024/1624 (AMLR), repo copy `docs/data/laws/32024R1624_EN.json` | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1624 | Arts. 9, 11, 12, 18, 90 |
| 2 | Regulation (EU) 2024/1620 (AMLAR), repo copy | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1620 | Art. 13: first selection by 1 July 2027 |
| 3 | Jones Day: Direct supervisory powers of the new AMLA (July 2025) | https://www.jonesday.com/en/insights/2025/07/direct-supervisory-powers-of-the-new-european-antimoney-laundering-authority | 40 entities, 6 Member States, 1 Jan 2028 |
| 4 | Regulation (EU) 2022/2554 (DORA), repo copy | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554 | Art. 2 scope; Art. 28(3) register of all ICT contracts |
| 5 | CBI, AML/CFT Guidelines for the Financial Sector (v2.0, June 2021) | https://www.centralbank.ie/docs/default-source/regulation/amld-/guidance/anti-money-laundering-and-countering-the-financing-of-terrorism-guidelines-for-the-financial-sector.pdf?sfvrsn=11 | Sections 8.1 to 8.9 and 9.2.8: evidence expectations |
| 6 | CBI, Intermediary Times special edition AML (Aug 2016) | https://centralbank.ie/docs/default-source/regulation/how-we-regulate/anti-money-laundering-and-countering-the-financing-of-terrorism/legislation/intermediary-times-special-edition-august-2016-aml.pdf?sfvrsn=12 | Missing training records; generic training |
| 7 | CBI, Enforcement action: Campbell O'Connor & Company (2019) | https://centralbank.ie/news/article/enforcement-action-campbell-o-connor | €280,000 fine incl. training failure |
| 8 | Paperjam, "CSSF fines ActivTrades Europe €14,000 for AML/CFT breaches" | https://en.paperjam.lu/article/cssf-fines-activtrades-europe-eu14-000-for-aml-cft-breaches | Training based solely on UK rules (press report; CSSF decision itself not read) |
| 9 | EBA, Report on ML/TF risks associated with payment institutions (EBA/REP/2023/18) | https://www.eba.europa.eu/sites/default/files/document_library/Publications/Reports/2023/1056453/Report%20on%20ML%20TF%20risks%20associated%20with%20payment%20institutions.pdf | Lack of rigorous training, especially with agents (p. 14) |
| 10 | EBA Payment Institutions Register, full download (file of 18 Oct 2026 16:00 UTC, SHA-256 checked) | https://euclid.eba.europa.eu/register/api/filemetadata | PI, EMI, AISP, exempt and agent counts |
| 11 | ESMA, MiCA page and interim CASP register (CASPS.csv) | https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica and https://www.esma.europa.eu/sites/default/files/2024-12/CASPS.csv | CASP counts, Art. 60 vs Art. 63 |
| 12 | Invest Lithuania, Fintech overview 2025-2026 | https://investlithuania.com/fintech-overview-2026/ | 248 fintechs, ≈7,800 employees (staff proxy) |
| 13 | Skillcast pricing | https://www.skillcast.com/pricing | £32 / £39 / £72 per user per year |
| 14 | iHasco pricing | https://www.ihasco.co.uk/pricing | £5.85 to £7.30 per learner per month (30 learners) |
| 15 | VinciWorks, Anti-Money Laundering courses | https://vinciworks.com/courses/anti_money_laundering_training | Formats, SCORM, bespoke, AMLD5/6 coverage |
| 16 | SAI360, Anti-Money Laundering Training | https://engage.sai360.com/anti-money-laundering-training | Course editor, LMS, APAC focus |
| 17 | Thomson Reuters Compliance Learning (HK) | https://www.thomsonreuters.com.hk/en/products-services/compliance-learning-hk-demo.html | AML courses, audit records (search summary of page) |
| 18 | CMS Client Academy, E-Learning Geldwäscheprävention | https://cms.law/de/deu/publication/cms-client-academy-unsere-e-learning-kurse-im-ueberblick/e-learning-geldwaeschepraevention-in-industrie-und-handel | SaaS/SCORM, adaptable, price on request |
| 19 | Haufe Akademie, Geldwäscheprävention e-learning | https://www.haufe-akademie.de/digital-suite/kurs/geldwaschepravention | Generic AML e-learning, 9 languages (search summary of page) |
| 20 | ACAMS CAMS factsheet (2026) | https://cdn.mediavalet.com/usva/acams/zeiaDohEe0K737_36hk31A/je-4hDbxGkG0SPoHsHswmQ/Original/EN_CAMS7_Factsheet.pdf | US$2,095 / US$1,595; membership required |
| 21 | EIMF, AML and Fraud Risk Management for EMIs | https://eimf.cademy.io/aml-and-fraud-risk-management-for-electronic-money-institutions-emis | €170 to €290; live online; in-house on request |
| 22 | EIMF, Navigating the EU AML Package | https://eimf.cademy.io/navigating-the-eu-aml-package-amla-single-rulebook-and-risk-based-compliance | €160 to €280 |
| 23 | Basel LEARN (Basel Institute on Governance) | https://baselgovernance.org/learning/events/basel-learn-free-courses-on-financial-investigation-asset-tracing-intelligence-g-2386 | Free courses with certificates (search summary of page) |
| 24 | FIAU Malta, upcoming courses | https://fiaumalta.org/courses-events/courses-by-fiau-2/upcoming-courses/ | Supervisor-run, CPE-accredited sessions |
| 25 | Synthesia pricing | https://www.synthesia.io/pricing | DIY AI video prices |
| 26 | Vyond pricing | https://www.vyond.com/pricing/ | $699 to $1,999 per user per year; document-to-video |
| 27 | Easygenerator pricing | https://www.easygenerator.com/en/pricing/ | $1,499 to $7,495 per year; SCORM; Frankfurt data centre |
| 28 | Coursebox, compliance training software | https://www.coursebox.ai/compliance-training-software | Course from an uploaded policy (vendor claim) |
| 29 | Leto, Formation LCB-FT guide | https://www.leto.legal/guides/formation-sensibilisation-lcb-ft | French market practice on training evidence (vendor source) |
| 30 | Govix (Jersey Finance directory) | https://www.jerseyfinance.com/ifc/business-directory/govix/ | GapSure: AML handbook gap mapping |
| 31 | Cardamon, Gap Analysis | https://cardamon.ai/product/conduct-gap-analysis | Gap analysis with traceability and sign-off |
| 32 | Sia Partners, RegMatcher | https://www.sia-partners.com/en/our-capabilities/regmatcher-automate-your-compliance-processes-with-ai | LLM policy-to-regulation gap analysis |
| 33 | Financial IT, CUBE acquires Kodex AI | https://financialit.net/news/compliance/cube-acquires-berlin-based-kodex-ai-creating-industry-first-unified-compliance-risk | Gap analysis feature; Oct 2025 acquisition (search summary) |
| 34 | Finextra, Corlytics acquires Clausematch | https://finextra.com/newsarticle/42592/corlytics-acquires-clausematch | Policy management plus regulatory mapping (search summary) |

### What I could not verify

- Staff headcount by firm for EU PIs, EMIs and CASPs (no published source).
- Any published price for tailored AML training or for AML policy gap assessments.
- An EU sanction against a PI, EMI or CASP where training was the main breach.
- The CSSF ActivTrades decision text itself (I relied on the Paperjam report).
- Regology's gap-analysis feature (login wall), the Lefebvre Dalloz price (blocked page), and ICA's own price list.
- Sales-cycle length and LMS/SCORM prevalence among small EU firms: these must come from the interviews.
- Whether an external training provider counts as "outsourcing" under AMLR Art. 18 (a legal question for the client's counsel).
