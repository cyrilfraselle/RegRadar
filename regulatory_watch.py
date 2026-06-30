"""
═══════════════════════════════════════════════════════════════════
  REGULATORY WATCH — Veille Réglementaire Financière
  Belgique + Union Européenne
═══════════════════════════════════════════════════════════════════

  Ce script surveille automatiquement les publications des régulateurs
  financiers belges et européens, filtre par mots-clés, score l'impact
  et envoie un email récapitulatif formaté.

  SOURCES SURVEILLÉES :
  ─ FSMA (RSS + scraping circulaires)
  ─ BNB / Banque Nationale de Belgique (RSS + scraping)
  ─ ESMA (RSS + scraping Q&A)
  ─ EBA (RSS)
  ─ BCE / ECB (RSS)
  ─ Commission Européenne / EUR-Lex (RSS)
  ─ EIOPA (RSS)

  PRÉREQUIS : voir README.md
═══════════════════════════════════════════════════════════════════
"""

import feedparser
import requests
from bs4 import BeautifulSoup
import json
import os
import smtplib
import gspread
from google.oauth2.service_account import Credentials
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
import hashlib
import schedule
import time
import logging
from pathlib import Path
from classification_v3 import (
    classify_article,
    REFINED_GNEWS_SOURCES,
    OFFICIAL_REGULATOR_SOURCES,
    compute_counts,
    build_subject,
)
from enrichment_v3 import (
    enrich_with_groq,
    build_exec_summary,
    record_week,
    load_trends,
    analyze_trends,
    render_trends_html,
    build_trend_text,
)
from intelligence_v4 import (
    build_thematic_briefing,
    build_key_dates_timeline,
    get_upcoming_dates,
)
from dashboard_data import export_dashboard_data

# ── Optionnel : résumés automatiques via Claude API ──────────────
try:
    import anthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False

# ═══════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════
#
#  ⚠️  LES SECRETS NE SONT PAS DANS CE FICHIER.
#
#  Ce fichier est public (sur GitHub). Tous les secrets (mot de passe
#  Gmail, clé API Groq, ID Google Sheet, emails) vivent dans un fichier
#  séparé "config.py" qui reste sur ton PC et n'est JAMAIS poussé sur
#  GitHub (il est dans .gitignore).
#
#  POUR CONFIGURER :
#  1. Copie le fichier "config.example.py" en "config.py"
#  2. Remplis tes vraies valeurs dans "config.py"
#  3. C'est tout — ce fichier-ci lit automatiquement config.py
#
#  Si config.py n'existe pas, le script tourne avec des valeurs neutres
#  (email/Sheets désactivés) pour que rien ne plante.
# ═══════════════════════════════════════════════════════════════

try:
    import config as _cfg
    _HAS_CONFIG = True
except ImportError:
    _cfg = None
    _HAS_CONFIG = False
    import logging as _logging
    _logging.warning(
        "config.py introuvable — email & Google Sheets désactivés. "
        "Copie config.example.py vers config.py et remplis tes valeurs."
    )


def _get(attr, default):
    """Lit une valeur depuis config.py, sinon renvoie une valeur par défaut neutre."""
    return getattr(_cfg, attr, default) if _HAS_CONFIG else default


CONFIG = {

    # ── Email ────────────────────────────────────────────────────
    "email": {
        "expediteur": _get("EMAIL_SENDER", ""),
        "mot_de_passe_app": _get("EMAIL_APP_PASSWORD", ""),
        "destinataires": _get("EMAIL_RECIPIENTS", []),
        "heure_envoi": _get("EMAIL_SEND_TIME", "08:00"),
        "jours_envoi": _get("EMAIL_SEND_DAYS",
                            ["monday", "tuesday", "wednesday", "thursday", "friday"]),
    },

    # ── Google Sheets ────────────────────────────────────────────
    "google_sheets": {
        # désactivé automatiquement si pas d'ID configuré
        "actif": bool(_get("GSHEET_ID", "")),
        "credentials_file": _get("GSHEET_CREDENTIALS_FILE", "credentials.json"),
        "spreadsheet_id": _get("GSHEET_ID", ""),
        "nom_onglet": _get("GSHEET_TAB", "Veille Réglementaire"),
    },

    # ── Claude API (optionnel) ───────────────────────────────────
    "claude": {
        "actif": False,
        "api_key": _get("CLAUDE_API_KEY", ""),
        "seuil_impact": 2,
    },

    # ── Groq AI (free tier) ──────────────────────────────────────
    "groq": {
        "actif": bool(_get("GROQ_API_KEY", "")),
        "api_key": _get("GROQ_API_KEY", ""),
        "min_impact": 2,
        "max_calls": 40,
        "exec_summary": True,
    },

    # ── Trends ───────────────────────────────────────────────────
    "trends": {
        "actif": True,
    },

    # ── Filtrage ─────────────────────────────────────────────────
    "impact_minimum_email": 1,
    "lookback_jours": 7,

}
 
# ═══════════════════════════════════════════════════════════════
#  SOURCES DE DONNÉES
# ═══════════════════════════════════════════════════════════════
 
SOURCES = [
 
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  BELGIAN REGULATORS — direct feeds (work from office/residential IPs)
    #  If you see 403/404 errors, these will be covered by Google News fallbacks below
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "id": "fsma_rss",
        "nom": "FSMA",
        "pays": "BE",
        "type": "rss",
        "url": "https://www.fsma.be/fr/rss.xml",
        "couleur": "#185FA5",
    },
    {
        "id": "fsma_circulaires",
        "nom": "FSMA — Circulaires",
        "pays": "BE",
        "type": "scraping",
        "url": "https://www.fsma.be/fr/circulaires",
        "selecteur_articles": "article, div.node--type-circular, div.views-row, li.views-row",
        "selecteur_titre": "h2 a, h3 a, span.field-content a, a.node__title",
        "selecteur_date": "time, span.date-display-single, div.field--name-field-date",
        "selecteur_lien": "h2 a, h3 a, a.node__title, a",
        "couleur": "#185FA5",
    },
    {
        "id": "bnb_rss",
        "nom": "BNB / NBB",
        "pays": "BE",
        "type": "rss",
        "url": "https://www.nbb.be/fr/rss/communiques-de-presse",
        "couleur": "#185FA5",
    },
    {
        "id": "bnb_circulaires",
        "nom": "BNB — Circulaires",
        "pays": "BE",
        "type": "scraping",
        "url": "https://www.nbb.be/fr/supervision-financiere/surveillance-prudentielle/circulaires-et-communications",
        "selecteur_articles": "tr, div.item-list li, article",
        "selecteur_titre": "td a, li a, h3 a",
        "selecteur_date": "td:first-child, time",
        "selecteur_lien": "a",
        "couleur": "#185FA5",
    },
 
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  EU REGULATORS — direct feeds
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        "id": "esma_rss",
        "nom": "ESMA",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.esma.europa.eu/press-news/esma-news/rss.xml",
        "couleur": "#0F6E56",
    },
    {
        "id": "esma_qa",
        "nom": "ESMA — Q&A",
        "pays": "EU",
        "type": "scraping",
        "url": "https://www.esma.europa.eu/document-library/questions-and-answers",
        "selecteur_articles": "article, div.views-row, li.document-list__item",
        "selecteur_titre": "h3 a, h2 a, span.field-content a, a.document-title",
        "selecteur_date": "time, span.date-display-single",
        "selecteur_lien": "h3 a, h2 a, a",
        "couleur": "#0F6E56",
    },
    {
        "id": "eba_rss",
        "nom": "EBA",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.eba.europa.eu/rss.xml",
        "couleur": "#0F6E56",
    },
    {
        "id": "ecb_rss",
        "nom": "ECB",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.ecb.europa.eu/rss/press.html",
        "couleur": "#0F6E56",
    },
    {
        "id": "ecb_supervision_rss",
        "nom": "ECB — Banking Supervision",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.bankingsupervision.europa.eu/rss/news.en.rss",
        "couleur": "#0F6E56",
    },
    {
        "id": "eurlex_finance",
        "nom": "EUR-Lex — Official Journal",
        "pays": "EU",
        "type": "rss",
        "url": "https://eur-lex.europa.eu/RSSOJ-L_EN.xml",
        "couleur": "#0F6E56",
    },
    {
        "id": "eiopa_rss",
        "nom": "EIOPA",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.eiopa.europa.eu/rss_en",
        "couleur": "#0F6E56",
    },
    {
        "id": "amla_rss",
        "nom": "AMLA",
        "pays": "EU",
        "type": "scraping",
        # AMLA is new (est. 2024) — scraping their publications page
        "url": "https://www.amla.europa.eu/publications",
        "selecteur_articles": "article, div.publication, li.publication-item, div.views-row",
        "selecteur_titre": "h2 a, h3 a, a.publication-title",
        "selecteur_date": "time, span.date",
        "selecteur_lien": "a",
        "couleur": "#6B2D8B",
    },
    {
        "id": "esrb_rss",
        "nom": "ESRB",
        "pays": "EU",
        "type": "rss",
        "url": "https://www.esrb.europa.eu/home/rss/html/index.en.rss",
        "couleur": "#0F6E56",
    },
 
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  GOOGLE NEWS RSS — Primary fallback + adverse media
    #  These always work regardless of IP. Proven to return 100+ articles.
    #  Queries are precision-tuned for compliance teams.
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
    # — Regulatory publications (official regulator news via Google News) —
    {
        "id": "gnews_fsma_bnb",
        "nom": "Google News — FSMA / BNB",
        "pays": "BE",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22FSMA%22+OR+%22Banque+Nationale+de+Belgique%22+OR+%22NBB%22+regulation+OR+circular+OR+guideline+OR+circulaire&hl=en&gl=BE&ceid=BE:en',
        "couleur": "#185FA5",
    },
    {
        "id": "gnews_esma_guidelines",
        "nom": "Google News — ESMA",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22ESMA%22+guidelines+OR+regulation+OR+consultation+OR+RTS+OR+ITS+OR+opinion&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    {
        "id": "gnews_eba_prudential",
        "nom": "Google News — EBA",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22EBA%22+%22European+Banking+Authority%22+guidelines+OR+RTS+OR+ITS+OR+consultation+OR+regulation&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    {
        "id": "gnews_eiopa_amla",
        "nom": "Google News — EIOPA / AMLA",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22EIOPA%22+OR+%22AMLA%22+guidelines+OR+regulation+OR+consultation+OR+AML&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#6B2D8B",
    },
    {
        "id": "gnews_eu_regulations",
        "nom": "Google News — EU Regulatory Framework",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=DORA+OR+MiCA+OR+SFDR+OR+MiFID+OR+CSRD+OR+CRR3+OR+%22AMLR%22+OR+%22Retail+Investment%22+regulation+european&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
    {
        "id": "gnews_ecb_supervision",
        "nom": "Google News — ECB Supervision",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=ECB+%22banking+supervision%22+OR+SREP+OR+%22supervisory+review%22+OR+SSM+regulation&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#0F6E56",
    },
 
    # — Adverse media — regulatory fines, enforcement, financial crime —
    {
        "id": "gnews_enforcement_be",
        "nom": "Google News — Enforcement Belgium",
        "pays": "BE",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22FSMA%22+OR+%22NBB%22+fine+OR+penalty+OR+sanction+OR+enforcement+OR+%22money+laundering%22+OR+investigation+Belgium&hl=en&gl=BE&ceid=BE:en',
        "couleur": "#A32D2D",
    },
    {
        "id": "gnews_enforcement_eu",
        "nom": "Google News — Enforcement EU",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=bank+fine+OR+%22enforcement+action%22+OR+%22regulatory+penalty%22+OR+%22AML+violation%22+OR+%22sanctions+violation%22+EU+OR+Europe&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    {
        "id": "gnews_financial_crime",
        "nom": "Google News — Financial Crime",
        "pays": "EU",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22money+laundering%22+OR+%22financial+crime%22+OR+%22fraud%22+bank+EU+OR+Belgium+investigation+OR+charged+OR+fined&hl=en&gl=EU&ceid=EU:en',
        "couleur": "#A32D2D",
    },
    {
        "id": "gnews_bigbanks_global",
        "nom": "Google News — Major Global Enforcement",
        "pays": "GLOBAL",
        "type": "rss",
        "url": 'https://news.google.com/rss/search?q=%22billion%22+fine+OR+penalty+bank+OR+%22record+fine%22+%22money+laundering%22+OR+%22sanctions+violations%22+global&hl=en&gl=US&ceid=US:en',
        "couleur": "#A32D2D",
    },
 
]

# Replace old Google News entries with the refined v3 set
# (AML, fraud, fintech licensing, major-FI watch, tighter regulator queries)
SOURCES = [s for s in SOURCES if not s["id"].startswith("gnews_")] + REFINED_GNEWS_SOURCES

# ═══════════════════════════════════════════════════════════════
#  MOTS-CLÉS ET SCORING
# ═══════════════════════════════════════════════════════════════
 
MOTS_CLES = {
 
    # ── Impact 3 — Direct regulatory action required ─────────────
    # New guidance, regulation, enforcement: things a compliance team MUST act on
    "critique": {
        "poids": 3,
        "termes": [
            # New binding rules & standards
            "final draft", "final report",
            "regulatory technical standard", "RTS",
            "implementing technical standard", "ITS",
            "binding technical standard", "BTS",
            "draft technical standard", "draft RTS", "draft ITS",
            "delegated regulation", "règlement délégué",
            "delegated act", "implementing act",
            "circular", "circulaire",
            # Consultation & implementation
            "consultation paper", "call for evidence", "call for input",
            "deadline", "date limite", "entry into force", "entrée en vigueur",
            "transposition", "implementation date", "apply from",
            "mandatory", "obligatoire", "required to", "must comply",
            # Enforcement & fines (adverse media)
            "fined", "fine", "penalty", "penalised", "penalized",
            "enforcement action", "sanction", "amende",
            "under investigation", "investigated for", "charged with",
            "money laundering", "blanchiment", "AML violation",
            "sanctions violation", "sanctions breach",
            "fraud", "fraude", "market manipulation",
            "whistleblower", "suspected of", "criminal charges",
        ],
    },
 
    # ── Impact 2 — Important regulatory developments ─────────────
    # Guidelines, opinions, supervisory actions: important but not immediately binding
    "important": {
        "poids": 2,
        "termes": [
            # Soft law & supervisory outputs
            "guidelines", "orientations", "guidance",
            "opinion", "avis",
            "recommendation", "recommandation",
            "Q&A", "questions and answers",
            "peer review", "thematic review",
            "supervisory review", "inspection",
            "stress test", "climate stress test",
            "SREP", "supervisory expectations",
            "risk dashboard", "risk assessment", "risk monitor",
            "monitoring report", "supervisory convergence",
            # Regulators (boosting their publications)
            "FSMA", "BNB", "Banque Nationale", "NBB",
            "AMLA", "ESRB",
            # Key regulatory frameworks
            "DORA", "MiCA", "SFDR", "MiFID", "CSRD", "AMLR",
            "CRR3", "CRD6", "Basel IV", "Bâle IV",
            "Retail Investment Package", "PRIIPs",
            "FIDA", "open finance",
            # Action words that signal publications
            "publishes", "adopts", "issues", "launches", "consults on",
            "publie", "adopte",
            # Adverse media (important but not necessarily Belgian)
            "regulatory probe", "regulatory scrutiny",
            "compliance failure", "governance failure",
            "remediation", "consent order",
        ],
    },
 
    # ── Impact 1 — Informational ─────────────────────────────────
    # Background reading, market intelligence
    "informatif": {
        "poids": 1,
        "termes": [
            # Regulators (base signal)
            "EBA", "ESMA", "EIOPA", "ECB", "BCE",
            "European Banking Authority", "European Securities",
            "European Insurance", "European Systemic Risk",
            # General regulatory topics
            "financial regulation", "réglementation financière",
            "prudential", "capital markets", "banking supervision",
            "financial crime", "compliance", "governance",
            "annual report", "rapport annuel",
            "working paper", "discussion paper",
            "newsletter", "bulletin", "update",
            "fintech", "crypto-asset", "digital euro",
        ],
    },
 
    # ── Noise filter — terms that reduce score ────────────────────
    # Pure macro/market news with no compliance relevance
    "bruit": {
        "poids": -3,  # penalty applied per match
        "termes": [
            "interest rate decision", "rate hike", "rate cut",
            "monetary policy decision", "quantitative easing",
            "GDP", "inflation rate", "unemployment rate",
            "quarterly earnings", "quarterly results", "annual results",
            "stock price", "share price", "IPO", "merger announcement",
            "profit warning", "revenue growth", "dividend",
            "Jackson Hole", "Davos", "market outlook", "economic forecast",
            "Fed ", "Federal Reserve", "Bank of England",  # non-EU central banks
        ],
    },
 
    # ── Themes for tagging ────────────────────────────────────────
    "themes": {
        "DORA": ["DORA", "Digital Operational Resilience", "ICT risk", "operational resilience", "TLPT", "third-party ICT"],
        "SFDR/ESG": ["SFDR", "Sustainable Finance Disclosure", "PAI", "Principal Adverse", "CSRD", "ESG", "taxonomy", "taxonomie", "sustainability"],
        "MiFID/MiFIR": ["MiFID", "MiFIR", "investment firm", "best execution", "suitability"],
        "AML/CFT": ["AML", "AMLR", "money laundering", "blanchiment", "AMLA", "CFT", "terrorist financing", "sanctions", "KYC", "due diligence"],
        "Capital/CRR": ["CRR", "CRD", "Basel", "Bâle", "capital", "own funds", "SREP", "CRR3", "CRD6", "leverage ratio", "liquidity"],
        "MiCA/Crypto": ["MiCA", "crypto", "digital assets", "stablecoin", "crypto-asset", "DLT", "digital euro"],
        "FIDA/OpenFinance": ["FIDA", "open finance", "financial data", "PSD2", "PSD3", "open banking"],
        "Retail Investment": ["Retail Investment", "PRIIPs", "KID", "KIID", "retail investor", "suitability"],
        "Solvency/Insurance": ["Solvency", "Omnibus", "insurance", "assurance", "EIOPA", "reinsurance"],
        "Enforcement/Fines": ["fine", "penalty", "enforcement", "sanction", "investigation", "AML violation", "fraud"],
        "Stress Test": ["stress test", "climate stress", "SREP", "resilience", "scenario analysis"],
        "Market Infrastructure": ["CSDR", "EMIR", "CCP", "central counterparty", "settlement", "securities financing"],
    },
}
 
# ─── Noise filter helper (used in scoring) ───────────────────────
NOISE_TERMS = [t.lower() for t in MOTS_CLES["bruit"]["termes"]]
NOISE_PENALTY = abs(MOTS_CLES["bruit"]["poids"])
 
# ═══════════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════════
 
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M",
    handlers=[
        logging.FileHandler("regulatory_watch.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)
 
# ═══════════════════════════════════════════════════════════════
#  GESTION DE L'ÉTAT (seen.json)
# ═══════════════════════════════════════════════════════════════
 
SEEN_FILE = Path("seen.json")
 
def charger_vus() -> set:
    """Charge les IDs déjà traités depuis le fichier seen.json."""
    if SEEN_FILE.exists():
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()
 
def sauvegarder_vus(vus: set):
    """Sauvegarde les IDs traités. Garde les 2000 derniers pour éviter un fichier infini."""
    liste = list(vus)[-2000:]
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(liste, f)
 
def generer_id(url: str, titre: str) -> str:
    """Génère un identifiant unique pour un article."""
    contenu = f"{url}|{titre}"
    return hashlib.md5(contenu.encode()).hexdigest()
 
# ═══════════════════════════════════════════════════════════════
#  COLLECTE DES DONNÉES
# ═══════════════════════════════════════════════════════════════
 
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}
 
HEADERS_RSS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
}
 
def lire_flux_rss(source: dict) -> list[dict]:
    """Lit un flux RSS et retourne une liste d'articles normalisés."""
    articles = []
    try:
        log.info(f"RSS    → {source['nom']}")
        # Télécharger d'abord avec les headers navigateur, puis parser
        r = requests.get(source["url"], headers=HEADERS_RSS, timeout=15, allow_redirects=True)
        r.raise_for_status()
        feed = feedparser.parse(r.text)
 
        for entry in feed.entries:
            titre = entry.get("title", "").strip()
            lien = entry.get("link", "")
            resume = entry.get("summary", entry.get("description", ""))
 
            # Nettoyage HTML dans le résumé
            if resume:
                soup = BeautifulSoup(resume, "html.parser")
                resume = soup.get_text(" ", strip=True)[:500]
 
            # Date
            date_pub = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                date_pub = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                date_pub = datetime(*entry.updated_parsed[:6])
            else:
                date_pub = datetime.now()
 
            if titre and lien:
                articles.append({
                    "titre": titre,
                    "lien": lien,
                    "resume": resume,
                    "date": date_pub,
                    "source_id": source["id"],
                    "source_nom": source["nom"],
                    "pays": source["pays"],
                    "couleur": source.get("couleur", "#333"),
                })
 
    except Exception as e:
        log.error(f"Erreur RSS {source['nom']}: {e}")
 
    return articles
 
 
def scraper_page(source: dict) -> list[dict]:
    """Scrape une page HTML et retourne une liste d'articles normalisés."""
    articles = []
    try:
        log.info(f"SCRAPE → {source['nom']}")
        resp = requests.get(source["url"], headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
 
        blocs = soup.select(source["selecteur_articles"])
 
        for bloc in blocs[:20]:  # max 20 par page
            # Titre
            el_titre = bloc.select_one(source["selecteur_titre"])
            if not el_titre:
                continue
            titre = el_titre.get_text(strip=True)
 
            # Lien
            lien_el = bloc.select_one(source["selecteur_lien"])
            if lien_el and lien_el.get("href"):
                href = lien_el["href"]
                if href.startswith("http"):
                    lien = href
                else:
                    base = "/".join(source["url"].split("/")[:3])
                    lien = base + href
            else:
                lien = source["url"]
 
            # Date (best effort)
            date_el = bloc.select_one(source.get("selecteur_date", "time"))
            date_pub = datetime.now()
            if date_el:
                date_str = date_el.get("datetime", "") or date_el.get_text(strip=True)
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d.%m.%Y", "%B %d, %Y"]:
                    try:
                        date_pub = datetime.strptime(date_str[:10], fmt)
                        break
                    except Exception:
                        continue
 
            if titre:
                articles.append({
                    "titre": titre,
                    "lien": lien,
                    "resume": "",
                    "date": date_pub,
                    "source_id": source["id"],
                    "source_nom": source["nom"],
                    "pays": source["pays"],
                    "couleur": source.get("couleur", "#333"),
                })
 
    except Exception as e:
        log.error(f"Erreur scraping {source['nom']}: {e}")
 
    return articles
 
 
def collecter_toutes_sources() -> list[dict]:
    """Collecte les articles de toutes les sources configurées."""
    tous = []
    for source in SOURCES:
        if source["type"] == "rss":
            articles = lire_flux_rss(source)
        elif source["type"] == "scraping":
            articles = scraper_page(source)
        else:
            continue
        tous.extend(articles)
        log.info(f"  → {len(articles)} articles collectés")
    return tous
 
# ═══════════════════════════════════════════════════════════════
#  FILTRAGE ET SCORING
# ═══════════════════════════════════════════════════════════════
 
def detecter_themes(texte: str) -> list[str]:
    """Détecte les thèmes réglementaires présents dans un texte."""
    texte_lower = texte.lower()
    themes_detectes = []
    for theme, mots in MOTS_CLES["themes"].items():
        if any(mot.lower() in texte_lower for mot in mots):
            themes_detectes.append(theme)
    return themes_detectes
 
 
def calculer_impact(titre: str, resume: str) -> int:
    """
    Calculates impact score for an article (0-3).
    0 = not relevant, 1 = informational, 2 = important, 3 = critical
    Includes a noise penalty for pure macro/market news.
    """
    texte = (titre + " " + resume).lower()
    score = 0
 
    for niveau, config in [
        ("critique", MOTS_CLES["critique"]),
        ("important", MOTS_CLES["important"]),
        ("informatif", MOTS_CLES["informatif"]),
    ]:
        for terme in config["termes"]:
            if terme.lower() in texte:
                score += config["poids"]
 
    # Apply noise penalty
    for noise_term in NOISE_TERMS:
        if noise_term in texte:
            score = max(0, score - NOISE_PENALTY)
 
    if score >= 5:
        return 3
    elif score >= 2:
        return 2
    elif score >= 1:
        return 1
    else:
        return 0  # not relevant
 
 
def est_pertinent(article: dict) -> bool:
    """Retourne True si l'article est pertinent selon les mots-clés."""
    texte = (article["titre"] + " " + article.get("resume", "")).lower()
 
    # Vérifier si au moins un mot-clé de n'importe quel niveau est présent
    tous_termes = []
    for niveau in ["critique", "important", "informatif"]:
        tous_termes.extend(MOTS_CLES[niveau]["termes"])
    for theme_mots in MOTS_CLES["themes"].values():
        tous_termes.extend(theme_mots)
 
    return any(terme.lower() in texte for terme in tous_termes)
 
 
def filtrer_et_scorer(articles: list[dict], vus: set) -> list[dict]:
    """Filtre les articles nouveaux, pertinents, et calcule leur score."""
    resultats = []
    limite_date = datetime.now() - timedelta(days=CONFIG["lookback_jours"])
 
    for art in articles:
        # Filtre — déjà vu ET traité ?
        art_id = generer_id(art["lien"], art["titre"])
        if art_id in vus:
            continue
 
        # Filtre — trop ancien ?
        if art["date"] < limite_date:
            vus.add(art_id)  # marquer comme vu pour ne plus traiter
            continue
 
        # Scoring (avant le filtre pertinence, pour pouvoir logger)
        impact = classify_article(art["titre"], art.get("resume", ""), art["source_id"])
        themes = detecter_themes(art["titre"] + " " + art.get("resume", ""))
 
        # Filtre — non pertinent (impact 0 = aucun mot-clé trouvé)
        if impact == 0:
            # NE PAS ajouter dans vus — si les mots-clés changent, il sera rescané
            log.debug(f"Non pertinent (ignoré) : {art['titre'][:60]}")
            continue
 
        art["impact"] = impact
        art["themes"] = themes
        art["id"] = art_id
        resultats.append(art)
        vus.add(art_id)  # marquer comme traité seulement si pertinent
 
    # Tri : impact décroissant, puis date décroissante
    resultats.sort(key=lambda x: (-x["impact"], -x["date"].timestamp()))
    return resultats
 
# ═══════════════════════════════════════════════════════════════
#  RÉSUMÉS VIA CLAUDE API (optionnel)
# ═══════════════════════════════════════════════════════════════
 
def enrichir_avec_claude(articles: list[dict]) -> list[dict]:
    """Ajoute un résumé IA pour les articles à fort impact."""
    if not CONFIG["claude"]["actif"] or not CLAUDE_AVAILABLE:
        return articles
 
    client = anthropic.Anthropic(api_key=CONFIG["claude"]["api_key"])
 
    for art in articles:
        if art["impact"] < CONFIG["claude"]["seuil_impact"]:
            continue
        if art.get("resume_ia"):
            continue
 
        try:
            prompt = f"""Tu es un expert en réglementation financière européenne.
Voici une publication réglementaire :
 
TITRE : {art['titre']}
SOURCE : {art['source_nom']}
RÉSUMÉ DISPONIBLE : {art.get('resume', 'Non disponible')}
 
Fournis une analyse structurée en JSON avec exactement ces champs :
{{
  "resume": "2-3 phrases expliquant l'essentiel de la publication",
  "obligations": "Ce que les institutions financières doivent faire concrètement (ou 'Pas d'obligation directe')",
  "deadline": "Date limite si mentionnée (ou 'Non précisée')",
  "qui_est_concerne": "Type d'institution concernée (banques, assureurs, gestionnaires...)"
}}
 
Réponds UNIQUEMENT avec le JSON, sans markdown ni explication."""
 
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}],
            )
 
            texte = message.content[0].text.strip()
            # Nettoyer les éventuels backticks
            texte = texte.replace("```json", "").replace("```", "").strip()
            analyse = json.loads(texte)
 
            art["resume_ia"] = analyse.get("resume", "")
            art["obligations_ia"] = analyse.get("obligations", "")
            art["deadline_ia"] = analyse.get("deadline", "")
            art["qui_concerne_ia"] = analyse.get("qui_est_concerne", "")
            log.info(f"  IA résumé → {art['titre'][:60]}...")
 
        except Exception as e:
            log.warning(f"Erreur Claude API pour '{art['titre'][:40]}': {e}")
 
    return articles
 
# ═══════════════════════════════════════════════════════════════
#  GOOGLE SHEETS
# ═══════════════════════════════════════════════════════════════
 
COLONNES_SHEETS = [
    "Date", "Source", "Pays", "Titre", "URL",
    "Thèmes", "Impact", "Résumé", "Obligations",
    "Deadline", "Statut", "Responsable", "Notes"
]
 
def initialiser_sheets():
    """Initialise le Google Sheets avec les en-têtes si nécessaire."""
    try:
        creds = Credentials.from_service_account_file(
            CONFIG["google_sheets"]["credentials_file"],
            scopes=[
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ],
        )
        client = gspread.authorize(creds)
        sheet = client.open_by_key(CONFIG["google_sheets"]["spreadsheet_id"])
 
        try:
            ws = sheet.worksheet(CONFIG["google_sheets"]["nom_onglet"])
        except gspread.WorksheetNotFound:
            ws = sheet.add_worksheet(
                title=CONFIG["google_sheets"]["nom_onglet"],
                rows=1000, cols=len(COLONNES_SHEETS)
            )
            ws.append_row(COLONNES_SHEETS)
            log.info("Google Sheets — onglet créé avec en-têtes")
 
        return ws
 
    except Exception as e:
        log.error(f"Erreur initialisation Google Sheets: {e}")
        return None
 
 
def ajouter_dans_sheets(articles: list[dict]):
    """Ajoute les nouveaux articles dans Google Sheets."""
    if not CONFIG["google_sheets"]["actif"] or not articles:
        return
 
    ws = initialiser_sheets()
    if not ws:
        return
 
    labels_impact = {1: "ℹ️ Info", 2: "⚠️ Important", 3: "🔴 Critique"}
 
    lignes = []
    for art in articles:
        lignes.append([
            art["date"].strftime("%Y-%m-%d"),
            art["source_nom"],
            art["pays"],
            art["titre"],
            art["lien"],
            ", ".join(art.get("themes", [])),
            labels_impact.get(art["impact"], str(art["impact"])),
            art.get("resume_ia", art.get("resume", ""))[:300],
            art.get("obligations_ia", ""),
            art.get("deadline_ia", ""),
            "À analyser",
            "",
            "",
        ])
 
    try:
        ws.append_rows(lignes, value_input_option="USER_ENTERED")
        log.info(f"Google Sheets — {len(lignes)} lignes ajoutées")
    except Exception as e:
        log.error(f"Erreur écriture Google Sheets: {e}")
 
# ═══════════════════════════════════════════════════════════════
#  EMAIL HTML — English, with Regulatory + Adverse Media sections
# ═══════════════════════════════════════════════════════════════
 
# Sources considered "adverse media" (enforcement/financial crime)
ADVERSE_MEDIA_SOURCE_IDS = {
    "gnews_enforcement_be", "gnews_enforcement_eu",
    "gnews_financial_crime", "gnews_bigbanks_global",
}
ADVERSE_MEDIA_THEMES = {"Enforcement/Fines", "AML/CFT"}
 
def is_adverse_media(art: dict) -> bool:
    """Returns True if the article is adverse media (enforcement/financial crime)."""
    if art.get("source_id") in ADVERSE_MEDIA_SOURCE_IDS:
        return True
    themes = set(art.get("themes", []))
    if themes & ADVERSE_MEDIA_THEMES:
        titre = art["titre"].lower()
        adverse_signals = ["fine", "penalty", "fined", "penali", "investigation",
                          "money laundering", "fraud", "sanctions violation", "charged"]
        return any(s in titre for s in adverse_signals)
    return False
 
 
def badge_impact(impact: int) -> str:
    styles = {
        3: ("background:#FCEBEB;color:#791F1F", "🔴 CRITICAL"),
        2: ("background:#FAEEDA;color:#633806", "⚠️ IMPORTANT"),
        1: ("background:#F1EFE8;color:#555", "ℹ️ INFO"),
    }
    style, label = styles.get(impact, ("background:#eee;color:#333", "INFO"))
    return f'<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:4px;{style}">{label}</span>'
 
 
def badge_source(source: str, couleur: str) -> str:
    bg_map = {
        "#185FA5": "background:#E6F1FB;color:#0C447C",
        "#0F6E56": "background:#E1F5EE;color:#085041",
        "#6B2D8B": "background:#F0E8FA;color:#4A1A6A",
        "#A32D2D": "background:#FCEBEB;color:#7A1F1F",
    }
    style = bg_map.get(couleur, "background:#F1EFE8;color:#444")
    return f'<span style="font-size:11px;padding:2px 8px;border-radius:4px;{style}">{source}</span>'
 
 
def badge_theme(theme: str) -> str:
    return f'<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:#EEEDFE;color:#3C3489">{theme}</span>'
 
 
def badge_adverse() -> str:
    return '<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:4px;background:#FFF0F0;color:#8B1A1A">⚖️ ENFORCEMENT</span>'
 
 
def render_article(art: dict, show_adverse_badge: bool = False) -> str:
    badges = badge_impact(art["impact"])
    if show_adverse_badge:
        badges += " " + badge_adverse()
    badges += " " + badge_source(art["source_nom"], art.get("couleur", "#555"))
    for theme in art.get("themes", [])[:2]:
        if theme not in ("Enforcement/Fines",):  # skip redundant themes
            badges += " " + badge_theme(theme)
 
    summary = art.get("ai_summary") or art.get("resume_ia") or art.get("resume", "")
    so_what = art.get("ai_so_what", "")
    action = art.get("ai_action") or art.get("obligations_ia", "")
    deadline = art.get("ai_deadline") or art.get("deadline_ia", "")
    date_str = art["date"].strftime("%d %b %Y")
 
    summary_html = f'<p style="margin:0 0 8px;font-size:13px;color:#444;line-height:1.6">{summary}</p>' if summary else ""

    so_what_html = ""
    if so_what and so_what not in ("Informational only", "", None):
        so_what_html = f'<p style="margin:4px 0 0;font-size:12px;color:#374151"><b>So what:</b> {so_what}</p>'
 
    action_html = ""
    if action and action not in ("No direct obligation", "No action required", "Not specified", "Pas d'obligation directe", "", None):
        action_html = f'''<div style="background:#FFF8EC;border-left:3px solid #F59E0B;padding:6px 10px;margin:6px 0;border-radius:0 4px 4px 0">
          <span style="font-size:11px;font-weight:600;color:#92400E">ACTION: </span>
          <span style="font-size:12px;color:#78350F">{action}</span>
        </div>'''
 
    deadline_html = ""
    if deadline and deadline not in ("Not specified", "Non précisée", "", None):
        deadline_html = f'<span style="font-size:12px;color:#B91C1C;font-weight:600">⏰ {deadline}</span>'
 
    return f'''
    <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #F3F4F6">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">{badges}</div>
      <p style="margin:0 0 6px;font-size:14px;font-weight:500;color:#111;line-height:1.4">
        <a href="{art['lien']}" style="color:#111;text-decoration:none">{art['titre']}</a>
      </p>
      {summary_html}{so_what_html}{action_html}
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:4px">
        <span style="font-size:12px;color:#9CA3AF">📅 {date_str}</span>
        {deadline_html}
        <a href="{art['lien']}" style="font-size:12px;color:#185FA5;text-decoration:none">Read document →</a>
      </div>
    </div>'''
 
 
def render_deadlines_block(articles: list[dict]) -> str:
    items = [a for a in articles if a.get("deadline_ia") and
             a["deadline_ia"] not in ("Not specified", "Non précisée", "")]
    if not items:
        return ""
    rows = ""
    for art in items[:6]:
        rows += f'''<tr>
          <td style="font-size:12px;padding:5px 0;border-bottom:1px solid #F3F4F6;color:#374151;padding-right:12px">{art["titre"][:65]}…</td>
          <td style="font-size:12px;padding:5px 0;border-bottom:1px solid #F3F4F6;color:#B91C1C;font-weight:600;white-space:nowrap">{art["deadline_ia"]}</td>
        </tr>'''
    return f'''<div style="background:#F9FAFB;border-radius:8px;padding:14px 16px;margin-top:4px">
      <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em">UPCOMING DEADLINES</p>
      <table style="width:100%;border-collapse:collapse">{rows}</table>
    </div>'''
 
 
def generer_email_html(articles: list[dict], exec_summary: str = "", trend_html: str = "",
                       thematic_html: str = "", timeline_html: str = "") -> tuple[str, str]:
    """Generate HTML and plain text email content in English."""
    date_str = datetime.now().strftime("%d %B %Y")
 
    # Split into regulatory vs adverse media
    regulatory = [a for a in articles if not is_adverse_media(a)]
    adverse    = [a for a in articles if is_adverse_media(a)]
 
    nb_critical = sum(1 for a in regulatory if a["impact"] == 3)
    nb_important = sum(1 for a in regulatory if a["impact"] == 2)
    nb_adverse = len(adverse)
    nb_total = len(articles)
 
    # Status banner
    if nb_critical > 0:
        banner_bg, banner_fg = "#FCEBEB", "#791F1F"
        banner = f"🔴 {nb_critical} critical alert(s) — action required"
    elif nb_important > 0:
        banner_bg, banner_fg = "#FAEEDA", "#633806"
        banner = f"⚠️ {nb_important} important publication(s) to review"
    else:
        banner_bg, banner_fg = "#F0FDF4", "#14532D"
        banner = "✅ No urgent actions this week"
 
    # ── Section 1: Regulatory publications ──
    reg_sections = ""
    for groupe, label in [
        ([a for a in regulatory if a["impact"] == 3], "🔴 Critical — Regulatory Action Required"),
        ([a for a in regulatory if a["impact"] == 2], "⚠️ Important — Review Recommended"),
        ([a for a in regulatory if a["impact"] == 1], "ℹ️ Informational"),
    ]:
        if not groupe:
            continue
        items = "".join(render_article(a) for a in groupe)
        reg_sections += f'''<div style="margin-bottom:24px">
          <p style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 14px;padding-bottom:6px;border-bottom:2px solid #F3F4F6">{label}</p>
          {items}</div>'''
 
    deadlines_html = render_deadlines_block(articles)
 
    # ── Section 2: Adverse media ──
    adverse_html = ""
    if adverse:
        items = "".join(render_article(a, show_adverse_badge=True) for a in adverse)
        adverse_html = f'''
        <tr><td style="padding:0 24px 24px">
          <div style="border:1px solid #FEE2E2;border-radius:8px;overflow:hidden">
            <div style="background:#FEF2F2;padding:10px 16px;border-bottom:1px solid #FEE2E2">
              <p style="margin:0;font-size:12px;font-weight:600;color:#991B1B">
                ⚖️ ADVERSE MEDIA & ENFORCEMENT WATCH — {nb_adverse} item(s)
              </p>
              <p style="margin:2px 0 0;font-size:11px;color:#B91C1C">Regulatory fines · Financial crime · Enforcement actions · Belgium & EU</p>
            </div>
            <div style="padding:16px">{items}</div>
          </div>
        </td></tr>'''
 
    # ── Summary stats bar ──
    stats = f'''<tr><td style="padding:0 24px 20px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:80px;background:#F9FAFB;border-radius:6px;padding:10px 14px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:600;color:#B91C1C">{nb_critical}</p>
          <p style="margin:0;font-size:11px;color:#6B7280">Critical</p>
        </div>
        <div style="flex:1;min-width:80px;background:#F9FAFB;border-radius:6px;padding:10px 14px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:600;color:#92400E">{nb_important}</p>
          <p style="margin:0;font-size:11px;color:#6B7280">Important</p>
        </div>
        <div style="flex:1;min-width:80px;background:#F9FAFB;border-radius:6px;padding:10px 14px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:600;color:#7A1F1F">{nb_adverse}</p>
          <p style="margin:0;font-size:11px;color:#6B7280">Enforcement</p>
        </div>
        <div style="flex:1;min-width:80px;background:#F9FAFB;border-radius:6px;padding:10px 14px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:600;color:#374151">{nb_total}</p>
          <p style="margin:0;font-size:11px;color:#6B7280">Total</p>
        </div>
      </div>
    </td></tr>'''
 
    # ── Exec summary block ──
    exec_html = ""
    if exec_summary:
        exec_html = f'''
        <tr><td style="padding:20px 24px 0">
          <div style="background:#EEF4FB;border-left:3px solid #185FA5;padding:12px 16px;border-radius:0 6px 6px 0">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#185FA5;text-transform:uppercase;letter-spacing:0.05em">This week in brief</p>
            <p style="margin:0;font-size:13px;color:#1F2937;line-height:1.6">{exec_summary}</p>
          </div>
        </td></tr>'''

    # ── Trend block (wrapped in a table row) ──
    trend_row = ""
    if trend_html:
        trend_row = f'<tr><td style="padding:0 24px 8px">{trend_html}</td></tr>'

    # timeline_html and thematic_html already come wrapped as <tr>…</tr>
    timeline_row = timeline_html or ""
    thematic_row = thematic_html or ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB">
 
        <tr><td style="background:#1A3A5C;padding:20px 24px">
          <p style="margin:0;font-size:12px;color:#93C5E8;font-weight:500;text-transform:uppercase;letter-spacing:0.06em">Regulatory & Compliance Watch · Belgium & EU</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:600;color:#fff">{nb_total} publication(s) detected</p>
          <p style="margin:4px 0 0;font-size:12px;color:#93C5E8">{date_str}</p>
        </td></tr>
 
        <tr><td style="background:{banner_bg};padding:9px 24px;border-bottom:1px solid #E5E7EB">
          <p style="margin:0;font-size:13px;font-weight:600;color:{banner_fg}">{banner}</p>
        </td></tr>
 
        {exec_html}

        {timeline_row}

        {thematic_row}

        {stats}
 
        <tr><td style="padding:4px 24px 24px">
          {reg_sections}
          {deadlines_html}
        </td></tr>
 
        {trend_row}

        {adverse_html}
 
        <tr><td style="padding:14px 24px;border-top:1px solid #E5E7EB;background:#F9FAFB">
          <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6">
            Auto-generated · Sources: FSMA, BNB/NBB, ESMA, EBA, ECB, AMLA, EIOPA, ESRB, EUR-Lex, Google News<br>
            Regulatory Watch v2.0 · Questions? Reply to this email.
          </p>
        </td></tr>
 
      </table>
    </td></tr>
  </table>
</body>
</html>"""
 
    # Plain text fallback
    plain = f"Regulatory & Compliance Watch — {date_str}\n{'='*55}\n"
    plain += f"{nb_total} total | {nb_critical} critical | {nb_important} important | {nb_adverse} enforcement\n\n"
    for a in articles:
        cat = "ENFORCEMENT" if is_adverse_media(a) else f"Impact {a['impact']}"
        plain += f"[{cat}] {a['source_nom']} — {a['titre']}\n{a['lien']}\n\n"
 
    return html, plain
 
 
def envoyer_email(articles: list[dict], exec_summary: str = "", trend_html: str = "",
                  thematic_html: str = "", timeline_html: str = ""):
    """Send the digest email."""
    if not articles:
        log.info("No articles to send this cycle.")
        return
 
    articles_filtres = [a for a in articles if a["impact"] >= CONFIG["impact_minimum_email"]]
 
    if not articles_filtres:
        log.info(f"No articles above impact threshold {CONFIG['impact_minimum_email']}.")
        return
 
    html, texte = generer_email_html(articles_filtres, exec_summary, trend_html,
                                     thematic_html, timeline_html)

    # Counts — match the email body exactly (regulatory critical excludes adverse)
    regulatory = [a for a in articles_filtres if not is_adverse_media(a)]
    adverse = [a for a in articles_filtres if is_adverse_media(a)]
    official = [a for a in regulatory if a.get("source_id") in OFFICIAL_REGULATOR_SOURCES]
    nb_critical = sum(1 for a in regulatory if a["impact"] == 3)
    nb_adverse = len(adverse)
    nb_official = len(official)
 
    subject = f"[Regulatory Watch] {len(articles_filtres)} item(s)"
    if nb_official:
        subject += f" · 📋 {nb_official} official"
    if nb_critical:
        subject += f" · 🔴 {nb_critical} critical"
    if nb_adverse:
        subject += f" · ⚖️ {nb_adverse} enforcement"
    subject += f" · {datetime.now().strftime('%d/%m/%Y')}"
 
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = CONFIG["email"]["expediteur"]
    msg["To"] = ", ".join(CONFIG["email"]["destinataires"])
    msg.attach(MIMEText(texte, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
 
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as serveur:
            serveur.login(
                CONFIG["email"]["expediteur"],
                CONFIG["email"]["mot_de_passe_app"],
            )
            serveur.sendmail(
                CONFIG["email"]["expediteur"],
                CONFIG["email"]["destinataires"],
                msg.as_string(),
            )
        log.info(f"Email envoyé à {CONFIG['email']['destinataires']} ({len(articles_filtres)} articles)")
    except Exception as e:
        log.error(f"Erreur envoi email: {e}")
 
# ═══════════════════════════════════════════════════════════════
#  SAUVEGARDE LOCALE JSON (backup)
# ═══════════════════════════════════════════════════════════════
 
def sauvegarder_resultats(articles: list[dict]):
    """Sauvegarde les résultats en JSON local comme backup."""
    if not articles:
        return
    fichier = Path(f"resultats_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
    donnees = []
    for art in articles:
        d = art.copy()
        d["date"] = d["date"].isoformat()
        donnees.append(d)
    with open(fichier, "w", encoding="utf-8") as f:
        json.dump(donnees, f, ensure_ascii=False, indent=2)
    log.info(f"Résultats sauvegardés → {fichier}")
 
# ═══════════════════════════════════════════════════════════════
#  CYCLE PRINCIPAL
# ═══════════════════════════════════════════════════════════════
 
def executer_veille():
    """Exécute un cycle complet de veille réglementaire."""
    log.info("=" * 60)
    log.info("DÉMARRAGE DU CYCLE DE VEILLE")
    log.info("=" * 60)
 
    # 1. Charger les articles déjà traités
    vus = charger_vus()
    log.info(f"Articles déjà traités : {len(vus)}")
 
    # 2. Collecter toutes les sources
    log.info("─── Collecte des sources ───")
    tous_articles = collecter_toutes_sources()
    log.info(f"Total collecté : {len(tous_articles)} articles")
 
    # 3. Filtrer et scorer
    log.info("─── Filtrage et scoring ───")
    nouveaux = filtrer_et_scorer(tous_articles, vus)
    log.info(f"Nouveaux articles pertinents : {len(nouveaux)}")
 
    if not nouveaux:
        log.info("Aucun nouvel article pertinent. Fin du cycle.")
        sauvegarder_vus(vus)
        return
 
    # 4. Enrichissement IA (optionnel)
    if CONFIG["claude"]["actif"]:
        log.info("─── Enrichissement IA ───")
        nouveaux = enrichir_avec_claude(nouveaux)

    # 4b. Groq AI summaries
    if CONFIG.get("groq", {}).get("actif"):
        log.info("─── Groq AI summaries ───")
        nouveaux = enrich_with_groq(
            nouveaux,
            api_key=CONFIG["groq"]["api_key"],
            min_impact=CONFIG["groq"]["min_impact"],
            max_calls=CONFIG["groq"]["max_calls"],
        )

    # 4c. Trends + exec summary
    trend_html = ""
    trend_results = []
    if CONFIG.get("trends", {}).get("actif"):
        log.info("─── Trends ───")
        trends = record_week(nouveaux)
        trend_results = analyze_trends(trends)
        trend_html = render_trends_html(trend_results)

    exec_summary = ""
    if CONFIG.get("groq", {}).get("actif") and CONFIG["groq"].get("exec_summary"):
        log.info("─── Exec summary ───")
        exec_summary = build_exec_summary(nouveaux, CONFIG["groq"]["api_key"])

    # 4d. Thematic briefing (Groq) + key-dates timeline (base + Groq)
    groq_key = CONFIG.get("groq", {}).get("api_key", "") if CONFIG.get("groq", {}).get("actif") else ""
    thematic_html = ""
    timeline_html = ""
    if CONFIG.get("groq", {}).get("actif"):
        log.info("─── Thematic briefing ───")
        thematic_html = build_thematic_briefing(nouveaux, groq_key)
    log.info("─── Key-dates timeline ───")
    timeline_html = build_key_dates_timeline(nouveaux, groq_key)
 
    # 5. Google Sheets
    log.info("─── Mise à jour Google Sheets ───")
    ajouter_dans_sheets(nouveaux)
 
    # 6. Sauvegarde locale
    sauvegarder_resultats(nouveaux)

    # 6b. Export data for the website dashboard
    log.info("─── Export dashboard data ───")
    upcoming_dates = get_upcoming_dates(nouveaux, groq_key)
    export_dashboard_data(
        nouveaux,
        exec_summary=exec_summary,
        timeline=upcoming_dates,
        trends=trend_results,
    )
 
    # 7. Email
    log.info("─── Envoi email ───")
    envoyer_email(nouveaux, exec_summary=exec_summary, trend_html=trend_html,
                  thematic_html=thematic_html, timeline_html=timeline_html)
 
    # 8. Sauvegarder les vus
    sauvegarder_vus(vus)
 
    log.info("=" * 60)
    log.info(f"CYCLE TERMINÉ — {len(nouveaux)} articles traités")
    log.info("=" * 60)
 
 
# ═══════════════════════════════════════════════════════════════
#  PLANIFICATEUR
# ═══════════════════════════════════════════════════════════════
 
def planifier():
    """Configure et démarre le planificateur."""
    jours = CONFIG["email"]["jours_envoi"]
    heure = CONFIG["email"]["heure_envoi"]
 
    if jours == "daily":
        schedule.every().day.at(heure).do(executer_veille)
        log.info(f"Planifié : tous les jours à {heure}")
    else:
        for jour in jours:
            getattr(schedule.every(), jour).at(heure).do(executer_veille)
        log.info(f"Planifié : {jours} à {heure}")
 
    log.info("Planificateur démarré. Ctrl+C pour arrêter.")
    while True:
        schedule.run_pending()
        time.sleep(60)
 
 
# ═══════════════════════════════════════════════════════════════
#  POINT D'ENTRÉE
# ═══════════════════════════════════════════════════════════════
 
if __name__ == "__main__":
    import sys
 
    if "--reset" in sys.argv:
        # Vider le seen.json pour rescannerr tous les articles récents
        if SEEN_FILE.exists():
            SEEN_FILE.unlink()
            log.info("✅ seen.json supprimé — tous les articles récents seront rescannés")
        else:
            log.info("seen.json n'existait pas déjà")
        # Continuer avec un cycle immédiat si --maintenant aussi présent
        if "--maintenant" not in sys.argv:
            sys.exit(0)
 
    if "--maintenant" in sys.argv or "--reset" in sys.argv:
        # Lancement immédiat (test ou cron externe)
        executer_veille()
    else:
        # Mode planificateur intégré
        log.info("Lancement du planificateur de veille réglementaire")
        log.info("  --maintenant  : lancer un cycle immédiatement")
        log.info("  --reset       : vider seen.json et rescannerr (utile après update)")
        executer_veille()   # un cycle au démarrage
        planifier()
 