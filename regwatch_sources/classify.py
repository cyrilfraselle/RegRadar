"""Document type, status (draft / final / in force), deadlines and rank.

All rules are explicit and ordered; nothing is guessed. When no rule
fires the source's default type is used and the status is "published".
"""
import re
from datetime import date

from .parsers import parse_date

TYPES = ["legislation", "rts_its_draft", "consultation", "guideline",
         "supervisory_communication", "enforcement", "faq"]

_RULES = [  # (type, regex on title), first match wins
    ("consultation", r"\bconsult(ation|s on)\b|call for (evidence|input|advice)|public hearing|seeks? (views|feedback)|discussion paper"),
    ("rts_its_draft", r"\b(draft|final report).{0,40}\b(RTS|ITS|regulatory technical standards?|implementing technical standards?)\b|\b(RTS|ITS)\b.{0,10}\bunder\b|technical standards?"),
    ("guideline", r"\bguidelines?\b|\brecommendations? on\b|\borientations\b"),
    ("faq", r"\bQ&As?\b|\bFAQs?\b|questions and answers"),
    ("enforcement", r"publication (of the decision|concerning)|\bfined?\b|administrative (fine|measure)s? (imposed|on)|\bimposes?\b.{0,30}\b(fine|sanction|measure)|penalty (on|imposed)|withdrawal of (the )?(authorisation|licence)"),
]


def doc_type(entry: dict, src: dict) -> str:
    if src.get("parser") == "cellar_sparql":
        celex = entry.get("extra", {}).get("celex", "")
        # sector 5 = preparatory acts: COM proposals (PC) stay legislation
        # (status "proposal"); Parliament resolutions and other preparatory
        # documents are communications, not law.
        if celex.startswith("5") and not re.match(r"5\d{4}(PC|DC)", celex):
            return "supervisory_communication"
        return "legislation"
    t = entry.get("title", "")
    for typ, rx in _RULES:
        if re.search(rx, t, re.I):
            return typ
    return src.get("type", "supervisory_communication")


def doc_status(entry: dict, dtype: str, today: str = None) -> str:
    today = today or date.today().isoformat()
    t = (entry.get("title", "") + " " + entry.get("extra", {}).get("status", "")).lower()
    ex = entry.get("extra", {})
    if dtype == "legislation":
        celex = ex.get("celex", "")
        if celex.startswith("5"):
            return "proposal"
        eif = (entry.get("fields", {}).get("Entry into force") or {}).get("date", "")
        base = "in force" if eif and eif <= today else ("adopted, not yet in force" if eif else "published in OJ")
        return base + (" (corrigendum)" if ex.get("corrigendum") else "")
    if dtype == "supervisory_communication" and ex.get("celex", "").startswith("5"):
        return "European Parliament or other preparatory document"
    if "consultation closed" in t and "final report" not in t:
        return "draft (consultation closed)"
    if "consultation open" in t or "under consultation" in t:
        return "draft (consultation open)"
    if "final report published" in t or "final report" in t or "final draft" in t:
        return "final (submitted to the Commission)" if dtype == "rts_its_draft" else "final"
    status_field = (entry.get("fields", {}).get("Status") or {}).get("text", "") or entry.get("category", "")
    if dtype == "consultation":
        sf = status_field.lower()
        if "closed" in sf:
            return "draft (consultation closed)"
        if "open" in sf:
            return "draft (consultation open)"
        dl = consultation_deadline(entry)
        if dl:
            return "draft (consultation open)" if dl >= today else "draft (consultation closed)"
        return "draft"
    if "draft" in t:
        return "draft"
    if dtype in ("guideline", "faq", "enforcement"):
        return "final"
    return "published"


def consultation_deadline(entry: dict) -> str:
    for k, v in (entry.get("fields") or {}).items():
        if k.lower() in ("deadline", "closing date", "deadline for responses"):
            return v.get("date") or parse_date(v.get("text", ""))
    return ""


# ── deadlines in document text ────────────────────────────────────
# Each pattern names the kind of date; the date must be in the same
# sentence. Confidence "medium": a stated pattern in prose, to be checked.
_DATE = r"(\d{1,2}(?:st|nd|rd|th)? (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})"
TEXT_PATTERNS = [
    ("consultation closes", rf"(?:deadline for (?:the )?(?:submission|receipt) of (?:responses|comments|contributions)|consultation (?:runs|is open|will run|closes)(?: until| on)?|responses? (?:should|must) be (?:submitted|sent|received) by|closing date)[^.]{{0,80}}?{_DATE}"),
    ("application date", rf"(?:shall apply|applies|apply|will apply|application) (?:from|as from|as of|with effect from)[^.]{{0,40}}?{_DATE}"),
    ("transposition deadline", rf"(?:transpose|transposition)[^.]{{0,80}}?(?:by|before|no later than|until)[^.]{{0,20}}?{_DATE}"),
    ("reporting deadline", rf"(?:report(?:ing)?|submit|notify)[^.]{{0,60}}?(?:by|no later than|before)\s+{_DATE}"),
]


def text_deadlines(sections: list, limit: int = 12) -> list:
    out = []
    for s in sections:
        for p in s.get("paras", []):
            for kind, rx in TEXT_PATTERNS:
                for m in re.finditer(rx, p["text"], re.I):
                    d = parse_date(m.group(1))
                    if not d:
                        continue
                    start = max(0, p["text"].rfind(".", 0, m.start()) + 1)
                    end = p["text"].find(".", m.end())
                    quote = p["text"][start:(end + 1 if end != -1 else len(p["text"]))].strip()
                    out.append({"date": d, "kind": kind, "quote": quote[:400], "loc": p["loc"]})
                    if len(out) >= limit:
                        return out
    return out


# ── rank ──────────────────────────────────────────────────────────
TYPE_WEIGHT = {"legislation": 100, "rts_its_draft": 90, "consultation": 85, "guideline": 80,
               "enforcement": 70, "faq": 60, "supervisory_communication": 45}
NEWS_WEIGHT = 15


def rank(item: dict, today: str = None) -> float:
    """Higher is more important. The score sits inside a band so primary
    documents always outrank news whatever their age or topics:
    band 2 = in-scope primary, band 1 = other primary, band 0 = news;
    rank = band * 100 + score (score is below 100)."""
    today = today or date.today().isoformat()
    if item.get("is_news"):
        band, base = 0, NEWS_WEIGHT
    else:
        band = 2 if item.get("in_scope") else 1
        base = TYPE_WEIGHT.get(item.get("type"), 40) - 15
    st = item.get("status", "")
    if "open" in st or st.startswith("in force") or st.startswith("final") or st.startswith("adopted"):
        base += 5
    base += min(10, 2 * len(item.get("topics", [])))
    d = (item.get("date") or "")[:10]
    if d:
        try:
            age = (date.fromisoformat(today) - date.fromisoformat(d)).days
            base -= min(20, max(0, age) / 7)        # minus 1 point per week, capped
        except ValueError:
            pass
    return round(band * 100 + max(0.0, min(99.0, base)), 2)


def tier(item: dict) -> str:
    """critical: binding or about-to-bind AML/payments/crypto material
    (legislation, final or draft standards, guidelines, open consultations,
    enforcement decisions) from a primary source.
    important: other in-scope primary documents.
    info: everything else, including all news."""
    if item.get("is_news"):
        return "info"
    if not item.get("in_scope"):
        return "info"
    st = item.get("status", "")
    if item.get("type") in ("legislation", "rts_its_draft", "guideline", "enforcement") or \
            (item.get("type") == "consultation" and "open" in st):
        return "critical"
    return "important"
