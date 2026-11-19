# Competitor study: Max, the GRC market, EU RegTech and AML training

Date: 14 November 2026. Every web source was retrieved on 14 November 2026
(Appendix A). Builds on `strategy/market-study-training.md` (18 October 2026)
and does not repeat it. Not legal advice.

How to read this: **Evidence** means a vendor's own page, a press release, a
public register or a named price-data site, cited in Appendix A. **Inference**
is my reading and is labelled. A price is either quoted with its source or
marked **ESTIMATE** with the arithmetic. "Not found" means I looked and could
not verify it.

---

## Executive summary (10 lines)

1. Max does not compete with enterprise GRC (Optro, the new name of AuditBoard since March 2026, plus MetricStream, Archer, ServiceNow, Workiva, Diligent). They sell audit, SOX and risk to large firms at a median of about $46,000 a year (Vendr, AuditBoard).
2. Those suites do not write regulatory content. They buy it: Optro's RegComply runs on CUBE data, Archer bought Compliance.ai, ServiceNow plugs in Thomson Reuters or CUBE feeds.
3. The content layer is consolidating fast. CUBE bought Thomson Reuters Regulatory Intelligence (Dec 2024) and Kodex AI (Oct 2025). Bloomberg bought Regology (June 2026). Corlytics bought Clausematch (2024).
4. Vanta and Drata (median $20,000 and $24,934 a year, Vendr) automate security frameworks (SOC 2, ISO 27001, DORA). They have no AML, payment or crypto obligation content. That is Max's opening, not their market.
5. The closest threats are small and new: Vixio (payments regulatory intelligence with an "Obligations Library"), Cardamon (YC-backed, article-level obligation mapping and gap analysis), AI AML (Latvia, €39 to €350 a month) and ReguShield (Vilnius, €299 to €1,499 a month, "pre-revenue").
6. Max's real edge is narrow: verbatim EU law in EN/FR/NL with machine-checked article citations, built for small PI/EMI/CASP teams. But it has only 12 verified obligations today. Breadth is the biggest gap.
7. Jira is the workflow benchmark: free up to 10 users, Standard $7.91 per user per month (July 2026 list). Max must feel as fast as Jira, not try to out-feature it.
8. Training update: tailoring is no longer unclaimed. Attensi now advertises scenarios "built around" a client's own policies and risk assessment. Nobody I found shows paragraph-level citations plus a sign-off and evidence pack.
9. The site the owner half-remembered is **AML Unfiltered** (amlunfiltered.com), a UK AML case-file simulator. It is live, has a free tier and paid passes from £270 to £970, and was incorporated on 8 May 2026. It is FATF-framed, not EU/AMLR-specific, and has no evidence register for firms.
10. Recommendation: keep Max focused on "EU AML obligations you can trust, mapped to your controls and evidence in an afternoon". Grow verified obligations first, add an evidence request list and an applicability quick-start, and do not build connectors or continuous monitoring yet.

---

## 1. Max versus general GRC, audit and compliance automation platforms

### 1.1 Summary table

"Ships regulatory content" means the vendor provides regulation text or an
obligation library itself or through a named partner.

| Vendor | What it sells, to whom | Ships regulatory content? | AI (named by vendor) | Public price | EU payment/e-money/crypto fit |
|---|---|---|---|---|---|
| **Optro** (AuditBoard until 9 Mar 2026) | Audit, SOX, risk, infosec and compliance suite; "Trusted by over 50% of the Fortune 500" | Yes, via **RegComply**, "powered by regulatory change and obligations data from CUBE RegPlatform" (Apr 2025) | Optro AI, Autonomous Testing, Agentic Compliance, AI Governance (FairNow bought) | Not published. Vendr median **$45,947/yr** (86 purchases, range $21,220 to $111,208) | Not found. Home page names US customers only |
| **Hyperproof** | Compliance operations, multi-framework | Security frameworks; "Crosswalks" maps requirements across frameworks (Secure Controls Framework) | Not checked in depth | Not published. Vendr median **$41,400/yr** (44 purchases) | Not found |
| **LogicGate** Risk Cloud | GRC "Applications" (30+) plus Power User licences | Lists NIST CSF, ISO 27001, PCI DSS, SOC 2, GDPR, HIPAA; regulatory content partner Ascent shows LogicGate as an integration | GRC Agents, Config Newton | Not published (model: apps + Power Users, other users free) | Not found |
| **OneTrust** | Privacy, third-party risk, GRC | DataGuidance research, "300+ jurisdictions" (vendor) | Not checked | Not published | Markets DORA support (ICT third-party risk) |
| **MetricStream** | Enterprise GRC | Obligation extraction and content mapping added May 2026 (vendor); earlier content partners incl. Compliance.ai | AI agents for obligation extraction, control testing | Not published. Third-party claims start at $75,000/yr (SelectHub, unverified) | Not found |
| **Archer** | Integrated risk management | Yes, bought **Compliance.ai** (Feb 2024): maps regulatory change to policies and controls | Compliance.ai engine | Not published | Compliance.ai focus was US banking and insurance |
| **ServiceNow** IRM/GRC | GRC on the ServiceNow platform | Regulatory Change Management ingests partner feeds: Thomson Reuters Regulatory Intelligence (extra licence) or a CUBE connector | Now Assist for IRM | Not published | Only via partners |
| **Workiva** | Financial reporting, SOX, ESG and GRC for the CFO office | No obligation library found | Workiva AI (agentic, Sep 2025) | Not published; Controls/SOX priced "based on the number of controls" (CEO call) | Not found |
| **Diligent** | Board, GRC, ethics, third-party risk (Diligent One) | Not found for AML. Bought 3rdRisk (Jan 2026), which supports DORA and NIS2 | AI in 3rdRisk and Vault | Not published | DORA third-party risk only |
| **Vanta** | Security compliance automation | Prebuilt frameworks: SOC 2, ISO 27001, GDPR, HIPAA, ISO 42001, DORA, NIS 2 | Vanta AI Agent (evidence checks, control mapping) | Not published. Vendr median **$20,000/yr** (379 purchases, $7,500 to $57,400) | DORA only; no AML |
| **Drata** | Security compliance automation | SOC 2, ISO 27001, GDPR, HIPAA, Cyber Essentials; DORA page exists | AI questionnaires, agentic TPRM | Not published. Vendr median **$24,934/yr** (236 purchases) | DORA only; no AML |
| **Atlassian Jira / Confluence** | Work management and wiki for any team | None | Rovo (not verified in detail) | Jira Free up to 10 users; Standard **$7.91** and Premium **$14.54** per user per month (July 2026 list, resolution.de) | Neutral tool, used everywhere |

**ESTIMATE (Jira for a small compliance team):** 10 users x $7.91 x 12 months
= **$949 a year**. Or $0 on the Free plan. Any Max price has to be justified
against that for the "board and tickets" part alone.

### 1.2 What each one teaches (short)

- **Optro (AuditBoard).** The market leader for audit and SOX, now selling
  "agents". Its regulatory content is CUBE's, not its own. Strengths: control
  testing, workpapers, evidence requests, reporting for auditors. Weakness for
  our buyer: built for internal audit teams in large firms. One third-party
  comparison (search summary, source not pinned down) notes adoption friction
  for occasional users such as control owners. Inference: a 5-person EMI compliance team is not its customer.
- **Hyperproof.** Best example of "collect evidence once, reuse across
  frameworks" (Crosswalks). It is a security-framework idea, but the pattern
  applies to AMLR + national rules + EBA guidelines.
- **LogicGate.** No-code "applications" make it very configurable, which
  matches the ROADMAP rule "configuration over code". Regulatory content comes
  from partners (Ascent lists LogicGate as an integration).
- **OneTrust.** Strong on privacy content (DataGuidance). In finance it sells
  DORA third-party risk, not AML.
- **MetricStream, Archer, ServiceNow.** Enterprise platforms. Third-party
  pricing sites say implementation can cost more than the licence (search
  summaries only; not verified on vendor sites). Inference: a
  1,350-firm market of small PIs, EMIs and CASPs is outside their sales model.
- **Workiva, Diligent.** CFO and board software. Not a competitor for Max.
- **Vanta, Drata.** The best "speed to value" products in compliance: connect
  your systems, hourly automated tests, a dashboard of passing and failing
  controls. But the controls are about IT security. Neither lists AML,
  payment-services or MiCA frameworks (pricing and framework pages checked).
- **Jira and Confluence.** Not compliance tools, but every fintech already has
  them. The ROADMAP decision "Tickets: both" (own board plus a two-way Jira
  link) is correct: the board must be as fast as Jira and the compliance
  objects (obligation, control, evidence) must be ours.

### 1.3 Where Max does NOT compete

| Area | Why not |
|---|---|
| Internal audit and SOX | Optro, Workiva, MetricStream own it; our buyers are mostly unlisted firms with no SOX duty (inference) |
| Enterprise risk platforms | Archer, ServiceNow, MetricStream; long implementations, six-figure budgets |
| Security certification (SOC 2, ISO 27001) | Vanta, Drata, Hyperproof, with 400+ integrations (Vanta) |
| Board portals | Diligent |
| Global regulatory feeds (750 jurisdictions) | CUBE, Wolters Kluwer, Ascent; Max should not try to monitor the world |

### 1.4 Where Max could win (inference, to test)

1. **Verified EU AML, payment and crypto obligations with article-level
   citations.** The repo holds 15 EU legal texts verbatim in EN, FR and NL
   (AMLR, AMLD6, AMLAR, TFR, MiCA, DORA, PSD2, EMD2, GDPR and others) and quote
   checks by script. None of the GRC suites ships this; they license feeds.
2. **One topic view across law, AMLA drafts and supervisors.** For example
   "customer due diligence": AMLR articles, AMLA draft RTS, national
   supervisor guidance, your controls and your evidence on one page. CUBE and
   Vixio sell the feed; I found no small-firm product that shows the whole
   chain on one page (not verified inside paid products).
3. **Speed to value for a 1 to 10 person team.** Applicability by licence
   type, a starter control set, evidence slots, a board. Vanta's lesson:
   people buy "compliant in weeks", not "configurable".
4. **Price.** ESTIMATE: anything below the Vanta Vendr low end ($7,500 a year)
   is a different budget conversation from enterprise GRC.

---

## 2. EU and AML-specific RegTech

### 2.1 Horizon scanning and regulatory change vendors

| Vendor | What, for whom | Content | AI | Price | Notes |
|---|---|---|---|---|---|
| **CUBE** (UK) | RegPlatform for enterprises; "Intel" for "growing regulated businesses" | 750 jurisdictions, 250 in-house experts (vendor) | "Agentic Coworkers"; Kodex AI gap analysis, obligation and control mapping | Not published | Bought Thomson Reuters Regulatory Intelligence and Oden (closed 31 Dec 2024, ~1,000 customers incl. payments) and Kodex AI (Oct 2025). Powers Optro RegComply; ServiceNow connector |
| **Thomson Reuters Regulatory Intelligence** | Now part of CUBE | | | | Listed for completeness: no longer a separate competitor |
| **Corlytics** (Ireland) | Regulatory intelligence and policy management for large banks | Clausematch policy mapping (bought 2024) | Says first RegTech with ISO 42001 (AI governance) | Not published | Majority-owned by Verdane since 2024; new CEO May 2026 |
| **Regology** (now Bloomberg Industry Group) | Smart Law Library, regulatory change, agents | US federal and 50 states on Professional; global on Enterprise | Reggi assistant (free tier), Regulatory Change Agent | **$1,700 per user per month**, 3-year contract (Professional); Enterprise on request | Acquired by Bloomberg Industry Group, June 2026 |
| **Ascent** (US) | AscentHorizon, AscentFocus "regulatory register" | "98 countries", "400000 obligations" (vendor) | AscentAI | Not published | Targets banks, money transmitters, payments firms, fintechs; integrates with LogicGate, Resolver, Onspring |
| **Compliance.ai** | Now part of Archer (Feb 2024) | US banking and insurance focus at the time | Mapping change to policies and controls | | |
| **Wolters Kluwer** OneSumX | Regulatory change data feed, "700 regulatory bodies" | Mostly US library (ProViso, Reg Manager for US community banks) | AI Reg Manager (2024) | Not published | EU AML depth not verifiable |
| **Vixio** PaymentsCompliance (UK) | Regulatory intelligence for payments and digital assets: e-money issuers, PISPs, wallets, acquirers, BNPL | 200+ jurisdictions; tools include "Obligations Library", "Requirements Extraction", "Regulatory Mapping", task management | VIQ Assistant; "every Vixio update is verified by human analysts" | Not published | **Closest sector match to RegRadar's buyer.** Content and workflow, not a full controls-and-evidence register (as far as public pages show) |

**Reading (inference).** Three facts matter. First, the content layer is
being bought by big information companies (Bloomberg, CUBE). Second, most of
it is US-first or global; EU AML for small payment and crypto firms is a thin
slice for them. Third, Vixio already serves exactly our sector. Before
selling, the owner should see a Vixio demo and price.

### 2.2 AML compliance programme tools aimed at small EU firms (new since the October study)

| Vendor | What | Target | Price | Stage and evidence |
|---|---|---|---|---|
| **AI AML** (GTB Group SIA, member of the Latvian Chamber of Commerce) | 13 tools: AI policy generator ("Policy Studio"), KYC forms, screening, transaction monitoring, risk scoring, "Lex AI Officer" | Accountants, law firms, fintechs, VASPs, payment institutions | Free; Starter **€39/mo**; Workspace **€89/mo** (€79 annual); Enterprise **from €350/mo** | Live. Says legislation was "manually reviewed" into tables and "Every generated clause is traceable to a legal source". Claims 27 EU states + UK + CH; another line says 29 jurisdictions (inconsistent). Three testimonials, no customer counts |
| **ReguShield AI** (Vilnius, pre-incorporation) | Maps operational data to AMLA, AMLR, MiCA, DORA, AI Act and Travel Rule obligations; risk scores; evidence and remediation tracking | Fintech, crypto, EMIs, PIs, CASPs | Visibility **€299/mo** (5 seats); Copilot **€1,499/mo** (25 seats); Infrastructure custom | Says "Production Live · Pre-Revenue". Run by a natural person until a company is formed. No customers named |
| **Cardamon** (London/New York) | Horizon scanning, article-level obligation mapping, gap analysis, AI search with citations | Banks, fintechs, crypto firms, consultants | Not published | "Backed by YCombinator"; ISO 27001 (Aug 2025), SOC 2 Type 2 claimed; "60+ jurisdictions"; shows Wise, Nu, OKX, Binance and others as "Featured partners" (not labelled customers) |

**Reading (inference).** The October study saw gap tools as the crowded
corner. Now the **"AI compliance OS for small EU fintechs"** idea itself has
direct, cheap entrants. AI AML is already live at €39 to €89 a month with
policy drafting and screening. ReguShield pitches the same obligation-to-
evidence chain as Max to the same licence types. Neither shows the depth of
verbatim law or the quote checking that Max has, but neither is standing
still.

### 2.3 Policy gap analysis tools (verified and extended)

| Vendor | Status on 14 Nov 2026 | What changed since 18 Oct |
|---|---|---|
| **Govix GapSure** (Jersey) | Live; maps policies against a structured JFSC AML Handbook, drafts fixes for approval, audit pack. Co-founder says the handbook is "in production use across dozens of regulated firms" in Jersey (digital.je, June 2026) | Roadmap: beyond AML and Jersey. No price |
| **Cardamon** | Gap analysis that maps policies and controls "directly to your regulatory obligations" and suggests remediation wording | Microsoft partnership (Feb 2026). No price |
| **CUBE + Kodex AI** | Kodex lists gap analysis, horizon scanning, obligation and control mapping | Sep 2026: "Analysis Coworker" natural-language agent; CUBE + IBM AI-governance work |
| **Sia Partners RegMatcher** | LLM policy-to-regulation mapping, gap analysis, evidence checks; shows "where the requirement is in the policy, so users can verify it" | No AML or EU focus on the page; consultancy product; demo only |
| **Corlytics / Clausematch** | Policy management and regulatory mapping for large banks | No 2026 acquisition found |
| **AI AML Policy Studio** | Drafts policies from mapped legislation tables, not gap review | New in this study |

**Willingness to pay for gap analysis: still not found.** No vendor publishes
a gap-review price.

---

## 3. Ten features to borrow

Ranked by value to a small team and fit with the current Max code
(board, controls, obligations, home).

| # | Feature | Borrowed from | Why it fits Max |
|---|---|---|---|
| 1 | **Evidence request list**: one list of "please provide X by date Y", owner, status (requested, submitted, accepted), reminders, linked to a control | AuditBoard/Optro (PBC requests, CrossComply evidence requests; confirmed in user reviews and Optro Academy) | Inspections are a list of document requests. Max can pre-build that list from the obligations |
| 2 | **Control matrix view**: one grid of obligation, control, owner, frequency, last test, result, evidence | AuditBoard SOXHUB risk and control matrix | Compliance officers already think in Excel grids; this is the "replace Excel" screen |
| 3 | **Test of design vs operating effectiveness**, with a walkthrough note per control | AuditBoard best-practice guide | Makes "a control without a test is a gap" (VISION) concrete |
| 4 | **Passing / failing control dashboard** with a reason and a fix step per failure | Vanta continuous monitoring ("automated, hourly tests") | Start with manual or scheduled tests; the screen pattern matters more than automation now |
| 5 | **Reuse one piece of evidence across several requirements** | Hyperproof Crosswalks | One training register can serve AMLR Art. 12 and the national rule; one KYC file sample serves several CDD articles |
| 6 | **Swimlanes and WIP limits on the board** (by owner, by obligation) | Jira boards (swimlanes by query, assignee or epic; column constraints) | The first buyer is a dispatcher (ROADMAP): workload per person is the point |
| 7 | **Saved filters and shareable views** | Jira quick filters | "My overdue", "AMLA items this quarter" in one tap on a phone |
| 8 | **Framework onboarding in minutes**: pick your licence, get a prebuilt set | Vanta / Drata prebuilt frameworks | Speed to value; Max equivalent is "I am an EMI in Ireland" giving obligations and starter controls |
| 9 | **Human-verified update badge** on every regulatory item | Vixio ("every update is verified by human analysts") | Trust signal; matches VISION "Verifiable". Show who checked and when |
| 10 | **Decision review after a case**: compare your choice with the expected analysis | CasePilot debriefs, AML Unfiltered assessed mode | For the Academy: graded practice, not only quizzes; for Max later: QA sampling |

Not borrowed on purpose: Trust Center pages (sales tool for security
vendors), 400-tool integration catalogues (Phase 2 at the earliest), and
AI questionnaire automation (not our buyer's problem).

---

## 4. AML training market: update since 18 October 2026

### 4.1 What is new or newly found

| Item | What | Price | Source | Meaning for RegRadar |
|---|---|---|---|---|
| **Attensi** | Game-based simulations and AI role-play for AML; "scenarios built around your own policies, risk assessment and applicable regulations"; 50+ languages; per-employee records | Not published | Attensi AML page | **Corrects the October study**: a funded vendor now advertises policy-based tailoring. It does not describe paragraph citations or a sign-off trail (not found) |
| **VinciWorks Conversational Learning** | AI-driven dialogue course on AML due diligence and reporting | Not published | VinciWorks (search summary) | Generic vendors are adding AI interaction |
| **ACAMS EU AML Regulatory Framework certificate** | Self-paced, about 90 minutes | US$275 members / US$375 non-members | Search summary of ACAMS page (page itself returned 403) | Cheap individual AMLR primer exists from the best-known brand |
| **anti-money-laundering.eu** (Leitner Associates) | AMLR e-learning: ~60 min core + 10-min modules for banks and insurers | On request | Vendor page | AMLR-native course exists, but no PI/EMI/CASP modules |
| **Lefebvre Dalloz** (FR) | AML-TF e-learning, 3-month pack | €175 excl. VAT | Search summary | French-market price anchor |
| **Haufe Akademie** (DE) | One-day EU AML package seminar for factoring and leasing firms | €890 + VAT | Search summary | Live seminar price anchor |
| **ScenarioLab** (Brighton, UK) | "Escape Room for Financial Crime", ~1 hour, 3 CPD hours, certificate | **£75** per person; corporate on request | Vendor page | Interactive format at a low individual price |
| **CasePilot** (ClearPath Advisory) | 300-case register, free browser cases daily, paid app dossiers | Free in browser; one-time in-app purchase (price not stated) | Vendor page | Free interactive practice lowers the price of "games" |
| **AML Unfiltered** (UK) | Case-file simulator, see section 5 | £0 to £970 | Vendor page | Closest to our Academy format |
| **Skillcast** | Unchanged: from £32 / £39 / £72 per user per year (200-user average) | | Vendor page | Generic price anchor unchanged |

### 4.2 Formats now on the market

- Generic e-learning library with an LMS (Skillcast, iHasco, VinciWorks).
- Live online or classroom (EIMF, Haufe).
- Individual certificates (ACAMS, from US$275).
- **Interactive simulators and games** (AML Unfiltered, ScenarioLab, CasePilot,
  Attensi). This is the fastest-moving corner.
- DIY AI course builders from policy documents (Coursebox, Docebo, CYPHER
  Learning, Skill Studio AI and others, per review sites; none showed AML
  accuracy checks or citations).

### 4.3 The "tailored from the client's own policies" angle, re-checked

- **Evidence:** Attensi now claims policy-based scenarios. DIY tools claim
  course generation from uploaded policies. Neither shows (on public pages)
  citations to the policy paragraph and the AMLR article, a client sign-off
  per scene, an out-of-date flag when the policy changes, or a CBI-style
  evidence pack.
- **Inference:** "tailored" alone is no longer a differentiator. "Tailored,
  cited, signed off, kept in date, and evidenced for the inspector" still is.
  The pilot offer in the October study (Appendix B there) should lead with
  those four words, not with "tailored".

---

## 5. The site the owner remembered: "AML Unhinged / Unfiltered"

### Answer

**Found: AML Unfiltered, https://amlunfiltered.com.** The name matches, and it
is an interactive AML training simulator. I found no "AML Unhinged".

### What I tried

| Query or check | Result |
|---|---|
| Web search "AML Unfiltered" anti-money laundering | Found amlunfiltered.com |
| Web search "AML Unhinged" compliance | Nothing relevant |
| Search for the company director's name with "AML Unfiltered" | Only leukaemia results |
| `site:amlunfiltered.com` | Not indexed by the search tool |
| Site pages: home, about, demo, terms, accessibility | Read (below) |
| Companies House register | Found the company (below) |
| LinkedIn profile surfaced by search mentioning an AML Unfiltered simulator with a March beta | Could not open (LinkedIn blocks automated access); not used |
| Gamified AML training, AML escape room, AML simulator searches | Found the alternatives listed in 4.1 |

### Who runs it (evidence)

- **AML Unfiltered Ltd**, company number **17207490**, incorporated **8 May
  2026**, registered at 66 Paul Street, London EC2A 4NA (a shared business
  address, inference). One director, Chantelle Cordella Obatolu, appointed
  8 May 2026 (Companies House).
- The site names no founder or team. The About page says the scenarios were
  "Designed by people who have worked the alerts, written the SARs and sat in
  the escalation meetings".
- It shows logos (Oxford Saïd, Ripple, KPMG, ACAMS, ICA, Leicester College)
  as "experience" affiliations, **not** as customers. Testimonials are
  anonymous ("AML and Financial Crime professional").
- Terms last updated 15 May 2026; accessibility statement updated 27 October
  2026 (so the site is maintained).

### What it really offers (evidence)

| Element | What the site shows |
|---|---|
| Product | Working web platform with sign-up and login; no waitlist; "No card needed" |
| Core | Fictional SDD, CDD and EDD case files with evidence packs; Practice mode with an AI Co-Pilot, Assessed mode without it; scored decisions; certificate at 70%+ |
| Sectors | Banking, Law, Crypto, Fintech |
| Games | Red Flag Rush, Source of Snake, Ownership Structure Simulation |
| MLRO track | 8 escalation cases, a "Defensive SAR/STR Drafting Lab", a Board report template |
| Law basis | FATF Recommendations, "no national training track"; no EU/AMLR mention found |
| Demo | Auto-playing, hands-free preview of one case (Harbour Line Trading Ltd, UK): brief, KYC gaps, transactions, risk rating |
| "Check and compare" | A "Verify Certificate" page, and debriefs that compare your decision with the expected one (inference from the plan descriptions). No side-by-side product comparison |
| Accessibility | WCAG 2.2 AA target, read-aloud, keyboard, light and dark themes |
| CPD | "CPD Member", but accreditation "pending"; no CPD hours claimed |
| Payments | Paddle as merchant of record |

**Prices (GBP, "Founding Member" offer for the first 30 days):**

| Plan | Price | Access |
|---|---|---|
| Free Explorer | £0 | All KYC games, one Banking SDD case, non-CPD certificate |
| KYC Analyst Sector Pass | £270 (was £370) | 3 months, 1 sector, 6 cases |
| Premium Sector Pass | £670 (was £870) | 9 months, 4 sectors, 24 cases |
| MLRO Escalation Masterclass | £970 (was £1,170) | 9 months |
| Teams and Institutions | Custom | 12 months, multi-seat |

**Customers:** no evidence of paying customers or counts. Not found.

### How interactive is it?

The public demo is passive (auto-play). The paid product, as described,
is genuinely interactive: you investigate a case file, decide a risk rating
or escalation, and get scored with feedback. I could not test a logged-in
case, so the depth of branching is **not verified**.

### Compared with our Academy

| | AML Unfiltered | RegRadar Academy (per STREAMS.md and the repo) |
|---|---|---|
| Buyer | Individual learner (analyst, MLRO) | The firm (MLRO buys for staff) |
| Law | FATF, global | AMLR verbatim, article by article |
| Format | Case files, scored, AI co-pilot in practice | Topic path: film, questions, Spot it game, Decide scenario, law excerpt |
| Evidence for the firm | Personal certificate | Register and certificate pages exist (`academy-register.html`, `academy-certificate.html`) |
| Firm's own policies | Not offered | Planned (policy-to-video, tailored modules) |
| Price | £0 to £970 per person | Not priced |

### What we can learn

1. **A free tier with one full case** is the hook. Our Academy path is already
   free; make one complete scored case the first thing a visitor plays.
2. **Practice vs assessed modes** (AI help on, then off) is a clean way to
   make a certificate mean something.
3. **Sector passes** (banking, crypto, fintech) show people buy by sector.
   Our PI / EMI / CASP split is the EU equivalent.
4. **MLRO-level content** (escalation, SAR drafting, board report) sells at
   the highest price (£970). Our Max board report and STR narrative work
   could feed an MLRO track.
5. **Where we differ:** AMLR-specific, firm-level evidence, and the link to
   the firm's own controls. AML Unfiltered sells to individuals, we sell to
   the firm.

---

## 6. Positioning and recommendation

### 6.1 Where Max is differentiated (evidence from the repo, value is inference)

1. **Verbatim EU law, three languages, quote checking.** 15 EU texts in
   EN/FR/NL in `docs/data/laws/`; obligations pass build assertions.
2. **Sector focus**: PI, EMI, CASP. The GRC suites are horizontal; Vixio is
   payments but content-first.
3. **Law to obligation to control to evidence in one small, free tool**,
   with Kanban (`board.html`), briefing (`home.html`) and the Academy linked.
4. **Founder is a practitioner.** CasePilot and AML Unfiltered also sell on
   "built by people who did the job"; it matters in this market.

### 6.2 Where Max is weak (evidence)

1. **12 verified obligations.** Ascent claims "400000 obligations"; Cardamon
   maps article-level obligations across "60+ jurisdictions" (vendor claims).
2. **No backend, accounts or multi-user** (requirements-platform.md). A team
   buyer cannot use it together yet.
3. **No security credentials.** Cardamon shows ISO 27001 and SOC 2; Corlytics
   ISO 42001. DORA makes small firms ask vendors for this (October study).
4. **No integrations.** Vanta pulls from "400+ tools".
5. **No customers, no price, solo founder.**

### 6.3 The five biggest risks

| # | Risk | Evidence | What to do |
|---|---|---|---|
| 1 | **Cheap AI-native entrants reach our buyer first** | AI AML at €39 to €89/mo, live; ReguShield at €299/mo targeting EMIs/PIs/CASPs | Win on trust: show every citation and the human check; get 3 design partners before adding breadth |
| 2 | **Vixio or CUBE goes down-market** with obligations plus workflow | Vixio "Obligations Library" for payments; CUBE "Intel" for "growing regulated businesses" | See both demos; position Max as the register and evidence layer that can take their feed later |
| 3 | **Content breadth gap never closes** | 12 obligations vs vendor libraries in the hundreds of thousands | Do not chase the world: complete AMLR, then TFR and the AMLA RTS for PI/EMI/CASP. Publish a coverage list |
| 4 | **Security and DORA vendor checks block the first sale** | DORA register of all ICT contracts (October study); competitors show ISO/SOC 2 | Prepare a one-page security note and data flow before the pilot; keep prototype data fictional (requirements-platform.md rule) |
| 5 | **Spread too thin** (Max, Academy, RegWatch, Country risk, connectors) | Eight modules plus Academy already (ROADMAP) | One wedge at a time; freeze new modules until the obligation register and evidence flow are used by a real team |

### 6.4 What to build next because of these findings

1. **Complete the AMLR obligation set** (from 12 toward every operative
   article relevant to PI/EMI/CASP), each with the article quote and
   applicability by licence type. This is the moat; nobody small has it
   verified.
2. **Applicability quick-start**: "I am an EMI in Ireland with agents" gives
   obligations, starter controls and evidence slots in under 10 minutes
   (Vanta/Drata pattern).
3. **Evidence request list and control matrix view** in Max (features 1 and
   2 above). This is the "walk into the inspection ready" promise made
   visible.
4. **Topic view with AMLA drafts and supervisor guidance**, one topic first
   (customer due diligence), as the demo that no GRC suite shows.
5. **Academy: one scored case file** (practice and assessed modes) for one
   PI/EMI/CASP scenario, writing to the existing register. Not a full
   simulator catalogue.

**Do not build yet:** connectors, continuous automated monitoring,
multi-framework crosswalks beyond AML, or an MLRO paid course.

### 6.5 One-page comparison matrix

Only verified facts; "Not found" means not on the public pages I read.

| | **Max (RegRadar)** | **Optro (AuditBoard)** | **Vanta** | **Jira** | **CUBE** | **Vixio** | **Cardamon** | **AI AML** | **ReguShield** |
|---|---|---|---|---|---|---|---|---|---|
| Main buyer | Small EU PI/EMI/CASP compliance teams (planned) | Large firms; >50% of Fortune 500 | Security/compliance teams | Any team | Banks, insurers, financial services | Payments and digital-asset firms | Banks, fintechs, crypto | Small obliged entities | Fintech, EMIs, PIs, CASPs |
| EU AML obligation content | 12 verified AMLR obligations; 15 EU texts verbatim | Via CUBE (RegComply) | Not found (DORA, NIS 2 only) | None | Yes (750 jurisdictions) | Obligations Library (payments) | Article-level mapping, EU page | Legislation tables, 27 EU + UK + CH (vendor) | AMLR, AMLA, MiCA, DORA (vendor) |
| Quote checked against verbatim law | Yes (build scripts) | Not found | n/a | n/a | Not found | Human analyst verification | Citations claimed | "Traceable to a legal source" | Not found |
| Controls and testing | Yes (controls, test log) | Yes (strong) | Yes (automated tests) | No | Mapping via Kodex | Not found | Gap analysis | Not found | Evidence and remediation tracking |
| Evidence requests | Not yet | Yes | Automated collection | No | Not found | Not found | Not found | Not found | Evidence records |
| Kanban / tickets | Yes (`board.html`) | Not verified | Not verified | Yes (benchmark) | Not found | Task management | Not found | Not found | Not found |
| AI mapping | Planned | Yes | Yes | Rovo (not checked) | Yes (Kodex) | VIQ Assistant | Yes | Yes | Yes |
| Training | Academy (AMLR path) | No | No | No | No | No | No | Training logs only | No |
| Public price | None (free prototype) | No; Vendr median $45,947/yr | No; Vendr median $20,000/yr | Free ≤10 users; $7.91/user/mo | No | No | No | €0 to €350+/mo | €299 to €1,499/mo |
| Stage | Prototype, no backend | Mature | Mature | Mature | Mature | Mature | YC-backed, ISO 27001 | Live | "Pre-Revenue" |

---

## Appendix A: sources

All retrieved 14 November 2026. "Summary" means the fact came from a search
result summary because the page itself could not be opened.

| # | Title | URL | Supports |
|---|---|---|---|
| 1 | AML Unfiltered home | https://amlunfiltered.com/ | Product, plans, prices, logos, Paddle |
| 2 | AML Unfiltered About | https://amlunfiltered.com/about | No named team; mission quote |
| 3 | AML Unfiltered Demo | https://amlunfiltered.com/demo | Passive demo, case steps |
| 4 | AML Unfiltered Terms | https://amlunfiltered.com/terms | England and Wales; updated 15 May 2026 |
| 5 | AML Unfiltered Accessibility | https://amlunfiltered.com/accessibility | WCAG 2.2 AA; updated 27 Oct 2026 |
| 6 | Companies House, AML UNFILTERED LTD officers | https://find-and-update.company-information.service.gov.uk/company/17207490/officers | No. 17207490; incorporated 8 May 2026; director |
| 7 | Vanta pricing | https://www.vanta.com/pricing | Plans, no prices, frameworks |
| 8 | Vanta automated compliance | https://vanta.com/products/automated-compliance | Hourly tests; 400+ tools |
| 9 | Vanta European frameworks blog / fintech page | https://www.vanta.com/resources/european-momentum-new-frameworks | DORA and NIS 2 support (summary) |
| 10 | Vendr, Vanta | https://www.vendr.com/marketplace/vanta | Median $20,000; 379 purchases |
| 11 | Drata pricing | https://drata.com/pricing | Plans, frameworks, no prices |
| 12 | Vendr, Drata | https://www.vendr.com/marketplace/drata | Median $24,934; 236 purchases |
| 13 | Vendr, Hyperproof | https://www.vendr.com/marketplace/hyperproof | Median $41,400; 44 purchases |
| 14 | Hyperproof Crosswalks | https://hyperproof.io/resource/crosswalks-between-compliance-frameworks/ | Evidence reuse across frameworks |
| 15 | Optro home | https://optro.ai/ | Modules, AI names, Fortune 500 claim |
| 16 | Optro RegComply | https://optro.ai/product/regulatory-compliance | 10,000+ issuing bodies; AI mapping |
| 17 | AuditBoard launches RegComply (23 Apr 2025) | https://optro.ai/blog/auditboard-launches-new-regulatory-compliance-solution-expanding-comprehensive-risk-management | Powered by CUBE RegPlatform |
| 18 | Meet Optro press release (9 Mar 2026) | https://optro.ai/blog/meet-optro-auditboard-unveils-new-identity-as-ai-transforms-grc | Rebrand |
| 19 | Vendr, AuditBoard | https://vendr.com/marketplace/auditboard | Median $45,947; 86 purchases |
| 20 | BD Emerson, AuditBoard vs Workiva | https://www.bdemerson.com/article/auditboard-vs-workiva | RCM, adoption friction (summary) |
| 21 | PeerSpot, AuditBoard questions | https://www.peerspot.com/products/auditboard/questions | PBC requests used in OpsAudit (summary) |
| 22 | LogicGate pricing | https://www.logicgate.ai/logicgate-platform/pricing/ | Apps + Power Users; AI names |
| 23 | OneTrust DataGuidance release | https://www.onetrust.com/news/onetrust-unveils-the-next-generation-of-dataguidance-regulatory-research/ | 300+ jurisdictions (summary) |
| 24 | OneTrust DORA release | https://prnewswire.com/news-releases/onetrust-helps-strengthen-operational-resilience-and-risk-management-to-support-dora-compliance-302152917.html | DORA positioning (summary) |
| 25 | MetricStream compliance / obligation extraction blog | https://www.metricstream.com/blog/ai-powered-obligation-extraction-regulatory-review.html | AI obligation extraction (summary) |
| 26 | SelectHub, MetricStream | https://www.selecthub.com/p/grc-software-tools/metricstream/ | "Starts at $75,000" (third party, unverified) |
| 27 | Archer acquires Compliance.ai (20 Feb 2024) | https://www.archerirm.com/press-releases/archer-acquires-compliance-ai-to-drive-ai-powered-regulatory-compliance-and-risk-management | Acquisition, scope (summary) |
| 28 | ServiceNow docs, GRC integration with Thomson Reuters RI | https://www.servicenow.com/docs/r/UUPLjuAXTo4SlQO8Ml6ZjQ/jGLvvSoCvjgaDb~bWDbLFw | Partner feeds, extra licence (summary) |
| 29 | A-Team Insight, CUBE ServiceNow connector | https://a-teaminsight.com/briefs/cube-launches-certified-connector-for-service-now/ | CUBE connector (summary) |
| 30 | CFOtech, Workiva GRC platform | https://cfotech.co.uk/story/workiva-unveils-ai-ready-grc-platform-for-real-time-audit | Mar 2026 GRC update (summary) |
| 31 | Workiva call transcript | https://financialfilings.com/filings/workiva-inc/call-transcript/2026/48457418/ | Pricing by number of controls (summary) |
| 32 | Diligent acquires 3rdRisk (14 Jan 2026) | https://www.businesswire.com/news/home/20260114955071/en/ | DORA, NIS2 third-party risk (summary) |
| 33 | resolution.de, Jira pricing 2026 | https://www.resolution.de/post/jira-pricing-plans/ | Free ≤10 users; $7.91 / $14.54 |
| 34 | Atlassian docs, Using a Board | https://confluence.atlassian.com/display/AGILE063/Using+a+Board | Swimlanes, column constraints, quick filters (summary) |
| 35 | CUBE home | https://www.cube.global/ | 750 jurisdictions; Intel; agentic coworkers |
| 36 | CUBE completes TR RI and Oden acquisition | https://www.retailbankerinternational.com/news/cube-completes-acquisition-of-thomson-reuters/ | Closed 31 Dec 2024; ~1,000 customers (summary) |
| 37 | Financial IT, CUBE acquires Kodex AI | https://financialit.net/news/compliance/cube-acquires-berlin-based-kodex-ai-creating-industry-first-unified-compliance-risk | Oct 2025; gap analysis feature (summary) |
| 38 | FinTech Global, CUBE agents (Sep 2026) | https://fintech.global/2026/09/02/cube-turns-regulatory-overload-into-an-ai-advantage/ | Analysis Coworker (summary) |
| 39 | Corlytics acquires Clausematch | https://a-teaminsight.com/blog/corlytics-targets-regulatory-risk-value-chain-with-clausematch-acquisition | 2024 acquisition (summary) |
| 40 | Verdane majority stake in Corlytics | https://ibsintelligence.com/ibsi-news/verdane-acquires-majority-stake-in-regtech-consolidator-corlytics | 2024 (summary) |
| 41 | Regology pricing | https://regology.com/pricing | $1,700/user/month; Bloomberg banner |
| 42 | Bloomberg Industry Group acquires Regology | https://www.bloombergindustry.com/press-releases/bloomberg-industry-group-regology/ | June 2026 acquisition (summary) |
| 43 | Ascent home | https://www.ascentregtech.com/ | Products, targets, 400,000 obligations claim |
| 44 | Wolters Kluwer OneSumX Reg Manager | https://www.wolterskluwer.com/en/news/wolters-kluwer-launches-ai-powered-onesumx-reg-manager | US community bank focus (summary) |
| 45 | Vixio PaymentsCompliance platform | https://vixio.com/payments-platform | Obligations Library; targets; VIQ |
| 46 | Vixio horizon scanning blog | https://www.vixio.com/blog/top-regulatory-horizon-scanning-software | Human analyst verification (summary) |
| 47 | AI AML home | https://aiaml.com/ | Operator, tools, prices, jurisdictions |
| 48 | ReguShield AI home | https://regushield.ai/ | Operator, plans, pre-revenue |
| 49 | Cardamon home | https://cardamon.ai/ | Products, YC, ISO 27001, partners |
| 50 | digital.je, Govix member spotlight (Jun 2026) | https://www.digital.je/news-events/digital-news/member-spotlight-govix/ | GapSure, production use claim (summary) |
| 51 | Sia Partners RegMatcher | https://www.sia-partners.com/en/our-capabilities/regmatcher-automate-your-compliance-processes-with-ai | Features, human review |
| 52 | Attensi AML training | https://attensi.com/solutions/financial-services/anti-money-laundering-training/ | Policy-based scenarios; customers |
| 53 | ScenarioLab | https://sl.games/ | £75 escape room; CPD |
| 54 | CasePilot | https://casepilot.app/ | Free cases; ClearPath Advisory |
| 55 | anti-money-laundering.eu AMLR e-learning | https://anti-money-laundering.eu/e-learning-on-anti-money-laundering-and-countering-the-financing-of-terrorism-under-amlr/ | AMLR course scope |
| 56 | ACAMS EU AML Regulatory Framework certificate | https://www.acams.org/en/training/certificates/eu-aml-regulatory-framework | US$275 / US$375 (summary; page 403) |
| 57 | Lefebvre Dalloz AML-TF e-learning | https://formation.lefebvre-dalloz.fr/formations/anti-money-laundering-and-terrorist-financing-aml-tf-lcb-ft-e-learning-course-confort-pack-3-months_701499 | €175 (summary) |
| 58 | VinciWorks AML courses | https://vinciworks.com/courses/aml | Conversational learning (summary) |
| 59 | Skillcast pricing | https://www.skillcast.com/pricing | £32 / £39 / £72 unchanged |
| 60 | Repo: `docs/data/obligations.json`, `docs/data/laws/`, `docs/*.html` | (this repository, branch main) | 12 obligations; 15 texts; existing pages |

## Appendix B: what I could not verify

- Any public list price for Optro, Hyperproof, LogicGate, OneTrust,
  MetricStream, Archer, ServiceNow, Workiva, Diligent, Vanta, Drata, CUBE,
  Vixio, Corlytics, Ascent, Cardamon or Govix. Vendr medians are buyer-reported
  deal data, not list prices.
- Archer and ServiceNow price levels (only third-party estimates, not used).
- Whether Vixio, CUBE Intel or Cardamon include a controls and evidence
  register comparable to Max (paid products, not tested).
- Vanta's DORA depth (for example a DORA register of information); Jira's
  current Cloud price after an October 2026 change reported by third parties
  (I used the July 2026 list).
- Optro Kanban or board features; Rovo AI in Jira.
- AML Unfiltered: logged-in case depth, any paying customers, who designed the
  content, and the LinkedIn post about a beta (blocked).
- "AML Unhinged" as a separate site: nothing found.
- ACAMS certificate price on the ACAMS page itself (403; search summary used).
- Attensi's claim of policy-based tailoring in practice (citations, sign-off).
- Gosu Academy "The Desk" AML game (appeared in one search summary only; not
  confirmed, not used).
- Accuracy of any AI mapping or gap tool (no independent tests found).
- Willingness to pay for gap analysis or tailored training (still not
  published by anyone).
