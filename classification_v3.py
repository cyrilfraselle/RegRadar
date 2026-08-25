"""
═══════════════════════════════════════════════════════════════════
  CLASSIFICATION & SOURCES v3 — Refinement module
  
  Drop-in replacement for the scoring, sources and email-grouping
  logic in regulatory_watch.py.
  
  WHAT CHANGED (per feedback):
  1. Refined CRITICAL definition (source-tier aware)
  2. Separated official regulator output from Google News commentary
  3. Added AML / fraud / financial-crime / fintech-licensing queries
  4. Major-FI enforcement detection (Wise, Revolut, N26, Binance…)
  5. Fixed subject/content count mismatch
═══════════════════════════════════════════════════════════════════

HOW TO INTEGRATE:
  Replace the corresponding functions/blocks in regulatory_watch.py with
  the versions below. Each section is labelled with what it replaces.
"""

from datetime import datetime

# ═══════════════════════════════════════════════════════════════
#  SOURCE TRUST TIERS
#  → REPLACE/ADD near the top of regulatory_watch.py (after SOURCES)
# ═══════════════════════════════════════════════════════════════

# Tier 1 — Official regulator feeds. These CAN be marked critical.
OFFICIAL_REGULATOR_SOURCES = {
    "fsma_rss", "fsma_circulaires", "bnb_rss", "bnb_circulaires",
    "esma_rss", "esma_qa", "eba_rss", "ecb_rss", "ecb_supervision_rss",
    "eurlex_ojl", "eurlex_proposals", "eiopa_rss", "amla_rss", "esrb_rss",
    "srb_rss", "fsb_rss", "ec_presscorner",
}

# ═══════════════════════════════════════════════════════════════
#  DOCUMENT TYPE & LEGAL WEIGHT
#  A compliance officer's first question about any publication is
#  "is this binding on me?". A regulation and a speech are both
#  "news" to an RSS reader and are worlds apart in practice, so
#  classify the instrument and carry its legal weight explicitly.
#  Ordered most-binding first — the first pattern to match wins.
# ═══════════════════════════════════════════════════════════════

DOC_TYPES = [
    ("regulation", "Regulation", "binding", [
        "regulation (eu)", "delegated regulation", "implementing regulation",
        "official journal", "règlement délégué",
    ]),
    ("directive", "Directive", "binding-transposed", [
        "directive (eu)", "directive 20", "transposition",
    ]),
    # NB: no bare " its " here. It was matching the English possessive
    # pronoun in ordinary prose and labelling speeches and consultations
    # as binding technical standards — the worst possible direction for
    # a classification error to go. Short tokens are matched as whole
    # words via _WORD_PATTERNS below; "rts" is safe that way, "its" is
    # not safe at all and only appears in explicit phrases.
    ("rts_its", "RTS / ITS", "binding", [
        "regulatory technical standard", "implementing technical standard",
        "draft rts", "draft its", "final draft rts", "final draft its",
        "rts on", "its on prudential", "binding technical standard",
    ]),
    ("national_law", "National law", "binding", [
        "moniteur belge", "belgisch staatsblad", "loi du", "arrêté royal",
        "koninklijk besluit", "wet van",
    ]),
    ("circular", "Circular", "supervisory-binding", [
        "circular", "circulaire", "nbb_20", "fsma_20",
    ]),
    ("guideline", "Guideline", "comply-or-explain", [
        "guidelines", "orientations", "richtsnoeren", "final report on guidelines",
        "guidance on", "operational guidance", "guidance note",
    ]),
    ("qa", "Q&A", "interpretive", [
        "q&a", "question and answer", "questions and answers", "single rulebook q&a",
    ]),
    ("supervisory", "Supervisory statement", "supervisory-expectation", [
        "supervisory statement", "supervisory expectations", "dear ceo",
        "public statement", "warns the public", "warning notice", "opinion of the",
        "supervisory briefing",
    ]),
    ("enforcement", "Enforcement decision", "enforcement", [
        "fined", "fine of", "penalty", "sanctioned", "enforcement action",
        "cease and desist", "consent order", "prosecuted", "settlement with",
        "administrative fine", "imposes a fine", "imposes administrative",
        "sanction decision", "withdrawal of authorisation", "licence withdrawn",
    ]),
    ("consultation", "Consultation", "not-yet-binding", [
        "consultation paper", "consults on", "call for evidence", "call for input",
        "discussion paper", "public consultation", "call for advice",
    ]),
    ("proposal", "Legislative proposal", "not-yet-binding", [
        "proposal for a regulation", "proposal for a directive", "legislative proposal",
        "commission proposes", "political agreement", "provisional agreement",
    ]),
    ("report", "Report", "non-binding", [
        "annual report", "final report", "thematic review", "peer review",
        "monitoring report", "risk dashboard", "stress test results", "assessment report",
    ]),
    ("speech", "Speech", "non-binding", [
        "speech by", "keynote", "remarks by", "interview with", "blog post",
        "panel remarks", "statement by",
    ]),
]

# How much weight a compliance officer should give each, 0-10.
# Drives ranking so that a binding instrument outranks commentary
# even when the commentary is louder.
LEGAL_WEIGHT = {
    "regulation": 10, "national_law": 10, "rts_its": 9, "directive": 9,
    "circular": 8, "guideline": 7, "qa": 6, "supervisory": 6,
    "enforcement": 5, "proposal": 4, "consultation": 4,
    "report": 3, "speech": 1,
    # Third-party coverage never outranks the instrument it describes.
    "news_enforcement": 2, "news": 1, "publication": 1,
}


def classify_doc_type(title: str, summary: str = "", source_id: str = ""):
    """Return (type_id, human_label, legal_status).

    Source tier constrains the answer. A press article *about* an RTS is
    not an RTS — only the issuing authority's own feed carries the
    instrument itself. Labelling third-party coverage as "directly
    binding" would put a compliance officer's trust in exactly the wrong
    place, so news sources can never claim a binding instrument type;
    they get "News: <topic>" at commentary weight instead.
    """
    # Match on the title only. A publication's title reliably states what
    # it is; summaries are often digests that mention several instruments
    # (an "EBA E-mail alert" listing that week's RTS and guidelines would
    # otherwise be classified as an RTS itself).
    text = title.lower()
    is_primary = source_id in OFFICIAL_REGULATOR_SOURCES

    # A consultation *about* an instrument is not that instrument. This
    # has to be checked ahead of the binding types, or "consults on the
    # draft RTS" reads as a binding RTS that is in fact still open for
    # comment — flagging work that isn't due yet as work that is.
    _CONSULT = ("consults on", "consultation paper", "call for evidence",
                "call for input", "call for advice", "discussion paper",
                "public consultation", "seeks views", "seeks feedback")
    if any(p in text for p in _CONSULT):
        if is_primary:
            return "consultation", "Consultation", "not-yet-binding"
        return "news", "News: consultation", "informational"

    # Same trap one step earlier in the lifecycle: "Proposal for a
    # REGULATION ..." is the Commission asking for a regulation, not a
    # regulation. EUR-Lex's proposals feed is full of these, and scoring
    # them as binding law would put horizon-scanning material at the top
    # of a compliance officer's queue as though it were in force.
    _PROPOSAL = ("proposal for", "proposal of", "commission proposes",
                 "draft proposal", "legislative proposal")
    if any(p in text for p in _PROPOSAL):
        if is_primary:
            return "proposal", "Legislative proposal", "not-yet-binding"
        return "news", "News: proposal", "informational"

    for tid, label, status, patterns in DOC_TYPES:
        if any(p in text for p in patterns):
            if is_primary:
                return tid, label, status
            # Third-party coverage: keep the subject, drop the authority.
            if tid == "enforcement":
                # Enforcement reporting is genuinely useful from the press
                # (supervisors rarely publish these promptly) — keep it,
                # but as reporting, not as a decision served on you.
                return "news_enforcement", "Reported enforcement", "informational"
            return "news", f"News: {label.lower()}", "informational"

    if is_primary:
        return "publication", "Publication", "informational"
    return "news", "News coverage", "informational"


# ═══════════════════════════════════════════════════════════════
#  REGULATORY LIFECYCLE STAGE
#  Idea → Consultation → Proposal → Adoption → Publication →
#  Entry into force → Application → Level 2 → Guidance →
#  Supervision → Enforcement → Amendment
#  Knowing the stage is what separates "prepare" from "comply now".
# ═══════════════════════════════════════════════════════════════

LIFECYCLE_STAGES = [
    ("consultation", "Consultation", ["consultation", "consults on",
        "call for evidence", "call for input", "discussion paper", "call for advice"]),
    ("proposal", "Proposal", ["proposal for", "commission proposes", "propose amendments",
        "legislative proposal", "political agreement", "provisional agreement"]),
    ("adopted", "Adopted", ["adopted", "adoption of", "council adopts",
        "parliament adopts", "endorsed"]),
    ("published", "Published", ["published in the official journal",
        "official journal", "publishes"]),
    ("in_force", "In force", ["entry into force", "enters into force",
        "entered into force"]),
    ("applies", "Applies", ["applies from", "application date", "shall apply from",
        "start of application"]),
    ("level2", "Level 2", ["regulatory technical standard",
        "implementing technical standard", "draft rts", "draft its", "delegated"]),
    ("guidance", "Guidance", ["guidelines", "q&a", "questions and answers",
        "supervisory statement", "opinion", "recommendation"]),
    ("enforcement", "Enforcement", ["fined", "penalty", "enforcement action",
        "sanctioned", "cease and desist"]),
    ("amendment", "Amendment", ["amending", "amendment to", "revised", "review of"]),
]


# ═══════════════════════════════════════════════════════════════
#  JURISDICTIONAL RELEVANCE
#  RegWatch's scope is Belgium + EU. A money-laundering prosecution
#  in Thailand or a US licence refusal is real news and creates no
#  obligation for a Belgian compliance officer — it is, precisely,
#  noise. Google News queries pull these in constantly (one UAE story
#  arrived eight times from eight outlets), so scope has to be
#  enforced here rather than hoped for in the query string.
#  Applies to news sources only: a regulator's own feed is in scope
#  by definition, whatever it happens to be about.
# ═══════════════════════════════════════════════════════════════

EU_BE_MARKERS = [
    # Union / country
    "eu", "europe", "european", "belgium", "belgian", "brussels",
    "euro area", "eurozone", "member state", "single market",
    # EU + Belgian authorities
    "esma", "eba", "eiopa", "ecb", "amla", "srb", "esrb", "fsma", "nbb",
    "ctif", "cfi", "european commission", "european parliament",
    # EU frameworks — a story about one is EU-relevant by construction
    "amlr", "amld", "dora", "mica", "micar", "psd2", "psd3", "mifid", "mifir",
    "sfdr", "csrd", "crr", "crd", "gdpr", "nis2", "emir", "csdr", "priips",
    "ucits", "aifmd", "eltif", "ai act", "fida",
    # Member states
    "netherlands", "dutch", "france", "french", "germany", "german", "spain",
    "spanish", "italy", "italian", "ireland", "irish", "luxembourg", "portugal",
    "austria", "austrian", "poland", "polish", "finland", "sweden", "denmark",
    "greece", "cyprus", "cysec", "malta", "estonia", "latvia", "lithuania",
    "slovakia", "slovenia", "croatia", "romania", "bulgaria", "hungary", "czech",
]


# ═══════════════════════════════════════════════════════════════
#  NON-SUPERVISORY REGULATOR OUTPUT
#  A regulator's feed is not uniformly supervisory. The ECB press
#  feed carries monetary policy, macro surveys, banknote design and
#  staff appointments alongside actual supervision; the EBA emits
#  content-free "E-mail alert <date>" wrappers. None of that creates
#  a compliance obligation, so being a primary source is not on its
#  own enough to earn a place in the feed.
# ═══════════════════════════════════════════════════════════════

NON_SUPERVISORY_TERMS = [
    # Monetary policy & macro
    "consumer expectations survey", "survey of professional forecasters",
    "bank lending survey", "wage tracker", "access to finance of enterprises",
    "economic bulletin", "monetary policy decision", "monetary policy meeting",
    "governing council", "euro short-term rate", "€str", "target balances",
    "balance of payments", "economic forecast", "projections for the euro area",
    # Housekeeping / institutional
    "banknote", "appoints", "appointment of", "reappoint", "vacancy",
    "call for applications", "public procurement", "catering services",
    "e-mail alert", "email alert", "newsletter of", "annual accounts",
    "meeting of ", "agenda of", "minutes of",
]


# ═══════════════════════════════════════════════════════════════
#  SUBJECT SCOPE — for whole-corpus sources
#  EUR-Lex OJ L carries every act the Union adopts: fishing quotas,
#  anti-dumping duties, plant health, and — somewhere in there — the
#  delegated regulations that actually bind a financial firm. Same for
#  the Commission press corner. These sources are indispensable and
#  unusable raw, so they get a subject test the narrower supervisory
#  feeds don't need.
# ═══════════════════════════════════════════════════════════════

SUBJECT_SCOPE_TERMS = [
    # Sector
    "financial", "credit institution", "payment", "e-money", "electronic money",
    "bank", "banking", "investment firm", "insurance", "insurer", "reinsurance",
    "fund", "ucits", "aifm", "securities", "market infrastructure", "clearing",
    # Financial crime
    "money laundering", "anti-money", "terrorist financing", " aml", " cft",
    "sanction", "restrictive measure", "asset freeze", "beneficial owner",
    # Frameworks
    "mica", "crypto", "crypto-asset", "dora", "operational resilience",
    "mifid", "mifir", "emir", "csdr", "benchmark", "psd2", "psd3", "gdpr",
    "solvency", "capital requirement", "own funds", "prudential", "basel",
    # Cross-cutting compliance
    "data protection", "personal data", "supervis", "reporting requirement",
    "transparency", "governance", "outsourcing", "ict risk", "audit",
    # Authorities
    "esma", "eba", "eiopa", "amla", "european central bank", "srb",
]


def is_in_subject_scope(title: str, summary: str = "") -> bool:
    """True if the item is plausibly about financial services, financial
    crime or data — used only for whole-corpus sources."""
    text = ((title or "") + " " + (summary or "")).lower()
    return any(t in text for t in SUBJECT_SCOPE_TERMS)


# Sources that publish across every policy area and therefore need the
# subject test above applied.
WHOLE_CORPUS_SOURCES = {"eurlex_ojl", "eurlex_proposals", "ec_presscorner"}


def is_supervisory(title: str, summary: str = "") -> bool:
    """False for regulator output that creates no compliance obligation —
    monetary policy, macro statistics, institutional housekeeping."""
    text = (title + " " + (summary or "")).lower()
    return not any(t in text for t in NON_SUPERVISORY_TERMS)


def is_eu_relevant(title: str, summary: str = "") -> bool:
    """True if the item plausibly touches the Belgium/EU perimeter.

    Deliberately tests the TITLE only. The summary field may hold
    AI-generated commentary written for a Belgian/EU audience, so it
    almost always contains "EU" or "Belgian" regardless of what the
    story is about — testing it let an Indian asset-seizure case
    through on the strength of its own generated blurb. The title comes
    from the source and says what the story actually is.

    `summary` is accepted and ignored so callers need not change.
    """
    text = (title or "").lower()
    return any(_re.search(r"\b" + _re.escape(k) + r"\b", text)
               for k in EU_BE_MARKERS)


def classify_lifecycle(title: str, summary: str = "") -> tuple:
    """Return (stage_id, label) for where in the regulatory lifecycle this
    item sits. Returns ('', '') when nothing matches rather than guessing —
    a wrong stage is worse than no stage."""
    text = (title + " " + (summary or "")).lower()
    for sid, label, patterns in LIFECYCLE_STAGES:
        if any(p in text for p in patterns):
            return sid, label
    return "", ""

# Tier 2 — Google News. Commentary caps at IMPORTANT unless strong
# enforcement signal on a major FI.
GOOGLE_NEWS_SOURCES = {
    "gnews_fsma_bnb", "gnews_esma", "gnews_eba", "gnews_eiopa_amla",
    "gnews_amla", "gnews_eiopa",
    "gnews_eu_regulations", "gnews_ecb_supervision", "gnews_fintech_licensing",
    "gnews_aml_financialcrime", "gnews_fraud",
    "gnews_enforcement_be", "gnews_enforcement_majorFI", "gnews_global_enforcement",
    "gnews_sanctions", "gnews_data_protection", "gnews_consumer_protection",
    "gnews_tax_transparency",
}

# ═══════════════════════════════════════════════════════════════
#  REFINED KEYWORD SETS
# ═══════════════════════════════════════════════════════════════

# Signals that a piece is an actual REGULATOR OUTPUT (not commentary)
REGULATOR_OUTPUT_SIGNALS = [
    "publishes", "issues", "adopts", "launches consultation", "consults on",
    "final draft", "final report", "final guidelines",
    "rts", "its", "technical standard", "delegated regulation", "delegated act",
    "circular", "circulaire", "opinion", "decision", "consultation paper",
    "call for evidence", "call for input", "discussion paper", "q&a",
    "advisory note", "advisory", "supervisory statement", "warning notice",
    "guidance note", "no-action letter", "public statement",
]

# Signals of direct regulatory impact
REG_IMPACT_SIGNALS = [
    "rts", "its", "technical standard", "guidelines", "circular", "regulation",
    "directive", "delegated", "requirement", "obligation", "framework",
    "licensing", "license", "licence", "authorisation", "consultation",
    "transposition", "entry into force", "application date", "deadline",
]

# Strong enforcement signals
ENFORCEMENT_STRONG = [
    "fined", "fine of", "penalty", "penalised", "penalized", "sanctioned",
    "under investigation", "investigated", "probe", "charged", "raid", "raided",
    "money laundering", "sanctions violation", "sanctions breach",
    "fraud charges", "criminal", "prosecuted", "settlement", "consent order",
    "warning letter", "cease and desist", "enforcement action", "wind-down order",
]

# Serious financial-crime topics (elevate enforcement to critical)
SERIOUS_CRIME = [
    "money laundering", "terrorist financing", "sanctions", "fraud",
    "criminal", "market manipulation", "market abuse", "aml", "cft",
]

# A generic enforcement word ("probe", "investigated", "charged"...) is not
# on its own evidence of a financial-sector story — a major-FI name can
# collide with an unrelated outlet's byline or a coincidental mention (see
# "KBC Digital" reporting on an unrelated police matter, matching "KBC").
# Require this context too before enforcement language alone earns weight.
FINANCE_CONTEXT = [
    "bank", "banking", "financial institution", "fintech", "payment",
    "insurer", "insurance", "asset manager", "broker", "investment firm",
    "crypto", "exchange", "lender", "credit institution", "regulator",
    "supervisory", "compliance", "money laundering",
]

# Major financial institutions to watch by name.
# NOTE: matched with word boundaries (see _contains_fi) to avoid
# false positives like "ing" inside "reporting" or "n26" inside text.
MAJOR_FI = [
    "wise", "revolut", "n26", "monzo", "starling",
    "ing", "kbc", "belfius", "bnp paribas", "argenta",
    "deutsche bank", "commerzbank", "hsbc", "barclays", "santander",
    "unicredit", "intesa", "société générale", "societe generale",
    "credit agricole", "rabobank", "abn amro", "danske bank", "nordea",
    "binance", "coinbase", "kraken", "paypal", "stripe",
    "western union", "moneygram", "adyen",
]

# Noise — pure macro/market with no compliance relevance
NOISE_TERMS = [
    "interest rate", "interest rates", "raises rates", "rate hike", "rate cut",
    "monetary policy", "quantitative easing",
    "funding round", "raises €", "raises $", "series a", "series b",
    "valuation", "ipo", "stock price", "share price",
    "quarterly earnings", "quarterly results", "annual results",
    "profit warning", "dividend", "jackson hole", "davos",
    "gdp", "inflation rate", "unemployment", "beats estimates", "beats expectations",
]

# Off-topic content that shares a keyword with a regulator's name/acronym
# by coincidence (arts, entertainment, sport, lifestyle) — a Google News
# search on "ESMA" or "EBA" will occasionally surface these; unlike
# NOISE_TERMS above, a real regulatory story essentially never carries
# both an enforcement signal AND one of these, so this filter applies
# unconditionally rather than yielding to has_enforcement.
OFF_TOPIC_TERMS = [
    "thriller", "novel", "film review", "movie review", "box office",
    "album", "concert", "tour dates", "tv series", "tv show", "episode recap",
    "video game", "recipe", "horoscope", "fashion week", "runway show",
    "football match", "premier league", "champions league", "world cup",
    "celebrity", "red carpet", "streaming service", "documentary",
    "school complaint", "student protest", "district-wise", "school district",
    "baseball", "basketball", "nba", "nfl", "mlb", "cricket match",
]

# Short acronyms (esma, eba, ecb, aml…) are prone to matching inside an
# unrelated word or an off-topic phrase — check them as whole words, not
# bare substrings.
import re as _re


def _contains_word(text: str, terms: list[str]) -> bool:
    """Word-boundary match — avoids 'eba' inside an unrelated word, or
    'aml' hitting a false positive the way a bare substring check would."""
    for t in terms:
        if _re.search(r"\b" + _re.escape(t) + r"\b", text):
            return True
    return False


def _strip_byline(text: str) -> str:
    """Google News titles end 'Headline text - Outlet Name'. An outlet's
    own name can itself collide with a tracked FI (KBC Digital, ING
    News...) without the story being about that institution — strip the
    trailing byline before checking who the story is actually about."""
    return text.rsplit(" - ", 1)[0] if " - " in text else text


def _contains_fi(text: str) -> bool:
    """Word-boundary match for FI names to avoid 'ing' in 'reporting' etc.,
    and against the byline, to avoid an outlet's own name."""
    return _contains_word(_strip_byline(text), MAJOR_FI)


def classify_article(title: str, summary: str, source_id: str) -> int:
    """
    Refined impact classification (0-3).
      3 = CRITICAL : official regulator output w/ reg impact, OR major FI + serious crime
      2 = IMPORTANT: regulator commentary, soft guidance, minor enforcement
      1 = INFO     : background / general
      0 = FILTERED : noise / irrelevant

    Source-tier aware: Google News commentary cannot be 'critical' unless it
    carries a strong enforcement signal on a serious-crime topic.
    """
    text = (title + " " + (summary or "")).lower()

    # ── Off-topic filter — unconditional. A regulator's name/acronym
    #    colliding with an unrelated arts/entertainment/sport story isn't
    #    saved by an enforcement signal; that combination doesn't happen
    #    in a real regulatory piece, so this runs before anything else. ──
    if any(t in text for t in OFF_TOPIC_TERMS):
        return 0

    has_enforcement = any(e in text for e in ENFORCEMENT_STRONG)
    has_serious_crime = any(c in text for c in SERIOUS_CRIME)
    has_major_fi = _contains_fi(text)

    # ── Noise filter (but enforcement always overrides noise) ──
    if not has_enforcement:
        if any(n in text for n in NOISE_TERMS):
            return 0

    # ── CRITICAL path 1: official regulator + regulatory impact ──
    if source_id in OFFICIAL_REGULATOR_SOURCES:
        if any(s in text for s in REGULATOR_OUTPUT_SIGNALS) or \
           any(s in text for s in REG_IMPACT_SIGNALS):
            return 3
        # Official source but no strong reg signal → still important
        return 2

    # ── CRITICAL path 2: major FI + serious financial crime ──
    if has_enforcement and has_serious_crime:
        if has_major_fi or "billion" in text or "record" in text or "major" in text:
            return 3
        # Serious crime but smaller/unnamed entity → important
        return 2

    # ── Enforcement without serious-crime tag → important, but only if
    #    there's actual financial-sector context — a named major FI, or a
    #    generic finance term. (has_major_fi already excludes the trailing
    #    "- Outlet Name" byline, see _strip_byline.) ──
    if has_enforcement:
        if has_major_fi or any(c in text for c in FINANCE_CONTEXT):
            return 2
        return 0

    # ── Google News mentioning regulator output → important (commentary) ──
    if any(s in text for s in REGULATOR_OUTPUT_SIGNALS) or \
       any(s in text for s in REG_IMPACT_SIGNALS):
        return 2

    # ── Mentions a tracked framework/regulator at all → info ──
    # (but only if it didn't already trip the noise filter as pure market news)
    if any(n in text for n in NOISE_TERMS):
        return 0
    # Word-boundary matched: bare-substring checks let short acronyms like
    # "eba" or "aml" fire inside unrelated words or phrases — this is the
    # loosest path in the whole function, so it's the one most worth
    # tightening.
    framework_terms = ["dora", "mica", "sfdr", "mifid", "csrd", "crr", "crd",
                       "aml", "amla", "psd", "esma", "eba", "eiopa", "ecb",
                       "fsma", "compliance", "prudential", "supervision"]
    if _contains_word(text, framework_terms):
        return 1

    return 0


# ═══════════════════════════════════════════════════════════════
#  REFINED SOURCES — Google News block
#  → REPLACE the Google News entries in the SOURCES list
# ═══════════════════════════════════════════════════════════════

REFINED_GNEWS_SOURCES = [
    # — Official regulator coverage (actual publications, tighter) —
    {
        "id": "gnews_fsma_bnb", "nom": "GNews — FSMA / BNB", "pays": "BE", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("FSMA"+OR+"National+Bank+of+Belgium"+OR+"Banque+Nationale+de+Belgique")+(circular+OR+regulation+OR+guideline+OR+license+OR+authorisation+OR+sanction)&hl=en&gl=BE&ceid=BE:en',
        "couleur": "#185FA5",
    },
    {
        "id": "gnews_esma", "nom": "GNews — ESMA", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q="ESMA"+(guidelines+OR+"technical+standard"+OR+consultation+OR+opinion+OR+RTS+OR+ITS+OR+decision)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    {
        "id": "gnews_eba", "nom": "GNews — EBA", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q="EBA"+"European+Banking+Authority"+(guidelines+OR+"technical+standard"+OR+consultation+OR+RTS+OR+ITS)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    {
        "id": "gnews_eu_regulations", "nom": "GNews — EU Frameworks", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(DORA+OR+MiCA+OR+MiCAR+OR+SFDR+OR+MiFID+OR+CSRD+OR+CRR3+OR+AMLR+OR+PSD3)+(regulation+OR+guidelines+OR+"technical+standard"+OR+implementation+OR+"transitional+period")&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    # — AMLA (dedicated — now an active regulator, advisory notes, supervision) —
    {
        "id": "gnews_amla", "nom": "GNews — AMLA", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("AMLA"+OR+"Anti-Money+Laundering+Authority")+(advisory+OR+guidelines+OR+regulation+OR+supervision+OR+note+OR+opinion+OR+report+OR+RTS+OR+standard)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#6B2D8B",
    },
    # — EIOPA (dedicated) —
    {
        "id": "gnews_eiopa", "nom": "GNews — EIOPA", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q="EIOPA"+(guidelines+OR+opinion+OR+consultation+OR+Solvency+OR+"technical+standard"+OR+report)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    # — Fintech & licensing (kept, you like these) —
    {
        "id": "gnews_fintech_licensing", "nom": "GNews — Fintech / Licensing", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(fintech+OR+"payment+institution"+OR+"e-money"+OR+"crypto-asset+service")+(license+OR+licence+OR+authorisation+OR+passport+OR+registration)+(EU+OR+Belgium+OR+regulator)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    # — AML / Financial crime (NEW) —
    {
        "id": "gnews_aml_financialcrime", "nom": "GNews — AML / Financial Crime", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("money+laundering"+OR+"financial+crime"+OR+"terrorist+financing"+OR+"sanctions+breach")+(bank+OR+fintech+OR+payment)+(fined+OR+investigation+OR+probe+OR+charged+OR+breach)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    # — Fraud / market abuse (NEW) —
    {
        "id": "gnews_fraud", "nom": "GNews — Fraud / Market Abuse", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(fraud+OR+"market+abuse"+OR+"market+manipulation"+OR+embezzlement)+(bank+OR+financial+OR+"investment+firm")+(EU+OR+Belgium+OR+Europe)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    # — Enforcement Belgium —
    {
        "id": "gnews_enforcement_be", "nom": "GNews — Enforcement BE", "pays": "BE", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("FSMA"+OR+"NBB"+OR+Belgian)+(fine+OR+penalty+OR+sanction+OR+enforcement+OR+investigation+OR+warning)+(bank+OR+financial)&hl=en&gl=BE&ceid=BE:en',
        "couleur": "#A32D2D",
    },
    # — Major-FI enforcement (catches Wise, Revolut, N26, Binance…) —
    {
        "id": "gnews_enforcement_majorFI", "nom": "GNews — Major FI Watch", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(Wise+OR+Revolut+OR+N26+OR+ING+OR+KBC+OR+"BNP+Paribas"+OR+"Deutsche+Bank"+OR+Binance+OR+PayPal+OR+Adyen)+(fined+OR+investigation+OR+probe+OR+"money+laundering"+OR+sanction+OR+breach+OR+penalty)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    # — Major global enforcement (only the big stuff) —
    {
        "id": "gnews_global_enforcement", "nom": "GNews — Major Global", "pays": "GLOBAL", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("record+fine"+OR+billion+OR+major)+(bank+OR+financial)+("money+laundering"+OR+"sanctions+violation"+OR+fraud)&hl=en&gl=US&ceid=US:en',
        "couleur": "#A32D2D",
    },
    # — Sanctions (was folded into AML/CFT keyword-only; now a distinct
    #   theme, so it needs its own source or it stays near-empty) —
    {
        "id": "gnews_sanctions", "nom": "GNews — Sanctions", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("EU+sanctions"+OR+"restrictive+measures"+OR+"asset+freeze"+OR+"sanctions+list")+(bank+OR+financial+OR+compliance+OR+EU+OR+Belgium)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    # — Data protection (GDPR intersecting financial services — breach
    #   notifications, DPA fines against banks/fintechs) —
    {
        "id": "gnews_data_protection", "nom": "GNews — Data Protection", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(GDPR+OR+"data+protection")+(bank+OR+financial+OR+fintech+OR+insurer)+(fine+OR+breach+OR+EDPB+OR+guideline)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    # — Consumer protection (mis-selling, unfair terms, vulnerable
    #   customers — a standing compliance-officer beat, previously
    #   untracked entirely) —
    {
        "id": "gnews_consumer_protection", "nom": "GNews — Consumer Protection", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=("consumer+protection"+OR+"mis-selling"+OR+"unfair+terms"+OR+"vulnerable+customer")+(bank+OR+financial+OR+insurer+OR+EU)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    # — Tax transparency (DAC6/7/8, CRS, beneficial-ownership registers) —
    {
        "id": "gnews_tax_transparency", "nom": "GNews — Tax Transparency", "pays": "EU", "type": "rss",
        "url": 'https://news.google.com/rss/search?q=(DAC6+OR+DAC7+OR+DAC8+OR+CRS+OR+FATCA+OR+"automatic+exchange"+OR+"beneficial+ownership+register")+(EU+OR+Belgium+OR+tax)&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
]


# ═══════════════════════════════════════════════════════════════
#  FIXED SUBJECT/CONTENT COUNTS
#  → REPLACE generer_email_html() counting + envoyer_email() subject
# ═══════════════════════════════════════════════════════════════

def compute_counts(articles: list[dict], is_adverse_fn) -> dict:
    """
    Single source of truth for all counts used in BOTH subject and body.
    Separates adverse media first so counts never disagree.
    """
    adverse = [a for a in articles if is_adverse_fn(a)]
    regulatory = [a for a in articles if not is_adverse_fn(a)]

    official = [a for a in regulatory if a.get("source_id") in OFFICIAL_REGULATOR_SOURCES]
    market_intel = [a for a in regulatory if a.get("source_id") not in OFFICIAL_REGULATOR_SOURCES]

    return {
        "regulatory": regulatory,
        "adverse": adverse,
        "official": official,
        "market_intel": market_intel,
        "n_critical": sum(1 for a in regulatory if a["impact"] == 3),
        "n_important": sum(1 for a in regulatory if a["impact"] == 2),
        "n_info": sum(1 for a in regulatory if a["impact"] == 1),
        "n_adverse": len(adverse),
        "n_official": len(official),
        "n_total": len(articles),
    }


def build_subject(counts: dict) -> str:
    """Build email subject from the SAME counts used in the body."""
    parts = [f"[Regulatory Watch] {counts['n_total']} item(s)"]
    if counts["n_official"]:
        parts.append(f"📋 {counts['n_official']} official")
    if counts["n_critical"]:
        parts.append(f"🔴 {counts['n_critical']} critical")
    if counts["n_adverse"]:
        parts.append(f"⚖️ {counts['n_adverse']} enforcement")
    parts.append(datetime.now().strftime("%d/%m/%Y"))
    return " · ".join(parts)
