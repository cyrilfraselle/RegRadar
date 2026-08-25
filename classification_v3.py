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
    "eurlex_finance", "eiopa_rss", "amla_rss", "esrb_rss",
}

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
