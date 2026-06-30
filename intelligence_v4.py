"""
═══════════════════════════════════════════════════════════════════
  INTELLIGENCE v4 — Thematic briefing + Key-dates timeline
  Companion module for regulatory_watch.py (works with enrichment_v3)

  THREE THINGS:
  1. is_groq_ready()      — hardened key check (rejects xai-/placeholder keys)
  2. build_thematic_briefing()  — Groq narrative on the 2-3 hottest themes,
                                  with status + concrete examples
  3. build_key_dates_timeline() — curated base timeline + dates Groq extracts
                                  from this week's articles, merged & sorted
═══════════════════════════════════════════════════════════════════
"""

import json
import re
import logging
from datetime import datetime, date
from collections import defaultdict

import requests

log = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


# ═══════════════════════════════════════════════════════════════
#  HARDENED GROQ KEY CHECK
# ═══════════════════════════════════════════════════════════════

def is_groq_ready(api_key: str) -> bool:
    """
    True only if the key looks like a real Groq key.
    Rejects: empty, placeholders, and xAI/Grok keys (xai-...).
    Groq keys start with 'gsk_'. Grok (xAI) keys start with 'xai-' — different company!
    """
    if not api_key:
        return False
    k = api_key.strip()
    if not k.startswith("gsk_"):
        if k.startswith("xai-"):
            log.error("API key starts with 'xai-' (that's an xAI/Grok key). "
                      "You need a GROQ key from console.groq.com starting with 'gsk_'.")
        else:
            log.info("Groq disabled — API key missing or not a Groq key (should start with 'gsk_').")
        return False
    if "PASTE" in k.upper() or "YOUR" in k.upper() or "XXXX" in k.upper():
        log.info("Groq disabled — API key is still the placeholder.")
        return False
    return True


def _parse_json(raw: str) -> dict:
    if not raw:
        return {}
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    return {}


def _groq_chat(api_key: str, system: str, user: str,
               max_tokens: int = 700, temperature: float = 0.2) -> str:
    """Raw Groq chat call. Returns text content or '' on failure."""
    payload = {
        "model": GROQ_MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        r = requests.post(GROQ_URL, headers=headers, json=payload, timeout=40)
        if r.status_code == 401:
            log.error("Groq 401 Unauthorized — the API key is invalid. "
                      "Check it's a real Groq key from console.groq.com.")
            return ""
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.warning(f"Groq call failed: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════
#  FEATURE 1 — THEMATIC BRIEFING
# ═══════════════════════════════════════════════════════════════

def build_thematic_briefing(articles: list[dict], api_key: str,
                            top_themes: int = 3, min_items: int = 2) -> str:
    """
    Generate a narrative briefing on the 2-3 most active themes this week.
    Each gets a status summary + concrete examples (companies, actions).
    Returns HTML, or "" if Groq is off / not enough data.
    """
    if not is_groq_ready(api_key):
        return ""

    # Find the most active themes by article count
    theme_articles = defaultdict(list)
    for a in articles:
        for t in a.get("themes", []):
            theme_articles[t].append(a)

    ranked = sorted(theme_articles.items(), key=lambda kv: -len(kv[1]))
    ranked = [(t, arts) for t, arts in ranked if len(arts) >= min_items][:top_themes]
    if not ranked:
        return ""

    # Build context for Groq from the actual headlines
    context_blocks = []
    for theme, arts in ranked:
        heads = "\n".join(f"  - {a.get('titre','')}" for a in arts[:6])
        context_blocks.append(f"THEME: {theme} ({len(arts)} items)\n{heads}")
    context = "\n\n".join(context_blocks)

    system = ("You are a senior EU and Belgian financial-regulation analyst briefing a "
              "Big Four compliance, regulatory and risk team. Focus on the regulatory and "
              "supervisory angle (rules, guidelines, technical standards, consultations, "
              "licensing, AML, enforcement) and on EU/Belgian impact. Treat crypto, payments "
              "and fintech only through that compliance lens, not as market news. "
              "Be specific: name the regulation, regulator and affected firms where the "
              "headlines support it. Never invent facts. Respond in valid JSON only.")

    user = f"""This week's regulatory news, grouped by theme:

{context}

For each theme, write a briefing aimed at EU/Belgian financial-services compliance officers.
Emphasise what is changing, who must act, and the EU/Belgian dimension. Return ONLY this JSON:
{{
  "briefings": [
    {{
      "theme": "theme name",
      "status": "2-3 sentences on the current regulatory status and what is happening now",
      "examples": "1-2 sentences with concrete examples (firms affected, specific supervisory/enforcement actions) IF the headlines support it, else empty string",
      "watch": "1 sentence: the next regulatory milestone or action a compliance team should watch"
    }}
  ]
}}"""

    raw = _groq_chat(api_key, system, user, max_tokens=900, temperature=0.25)
    data = _parse_json(raw)
    briefings = data.get("briefings", [])
    if not briefings:
        return ""

    # Render HTML
    blocks = ""
    for b in briefings:
        theme = b.get("theme", "")
        status = b.get("status", "")
        examples = b.get("examples", "")
        watch = b.get("watch", "")
        if not status:
            continue
        examples_html = ""
        if examples and examples.strip():
            examples_html = f'<p style="margin:6px 0 0;font-size:12px;color:#374151"><b>Examples:</b> {examples}</p>'
        watch_html = ""
        if watch and watch.strip():
            watch_html = f'<p style="margin:6px 0 0;font-size:12px;color:#6B7280"><b>Watch:</b> {watch}</p>'
        blocks += f'''
        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #EEF2F7">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6B2D8B">{theme}</p>
          <p style="margin:0;font-size:13px;color:#1F2937;line-height:1.6">{status}</p>
          {examples_html}{watch_html}
        </div>'''

    if not blocks:
        return ""

    return f'''
    <tr><td style="padding:8px 24px 4px">
      <div style="background:#FAF7FD;border:1px solid #EAD9F5;border-radius:8px;padding:16px">
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#6B2D8B;text-transform:uppercase;letter-spacing:0.06em">
          🔍 This week's themes — status &amp; impact
        </p>
        {blocks}
      </div>
    </td></tr>'''


# ═══════════════════════════════════════════════════════════════
#  FEATURE 2 — KEY DATES TIMELINE
# ═══════════════════════════════════════════════════════════════

# Curated base timeline of known major EU/BE financial-regulation dates.
# EDIT THIS as the regulatory calendar evolves. Always-available even if Groq is off.
BASE_TIMELINE = [
    {"date": "2026-07-01", "event": "MiCAR transitional period ends — CASPs must be authorised", "theme": "MiCA/Crypto", "type": "application"},
    {"date": "2026-07-10", "event": "AMLA direct-supervision powers phase in", "theme": "AML/CFT", "type": "supervision"},
    {"date": "2026-09-17", "event": "DORA — first ICT major-incident reporting review window", "theme": "DORA", "type": "report"},
    {"date": "2026-12-31", "event": "CSRD first-wave reporting (FY2025) due", "theme": "SFDR/ESG", "type": "report"},
    {"date": "2027-01-01", "event": "CRR3 phased own-funds provisions continue", "theme": "Capital/CRR", "type": "application"},
    {"date": "2027-01-10", "event": "AMLR / AMLD6 application date", "theme": "AML/CFT", "type": "application"},
    {"date": "2027-06-29", "event": "MiCA — Commission full review", "theme": "MiCA/Crypto", "type": "report"},
]

TYPE_ICON = {
    "application": "⚖️", "supervision": "👁️", "report": "📊",
    "consultation": "💬", "deadline": "⏰",
}


def _extract_dates_with_groq(articles: list[dict], api_key: str) -> list[dict]:
    """Ask Groq to pull any concrete upcoming regulatory dates from this week's items."""
    if not is_groq_ready(api_key):
        return []
    key_items = [a for a in articles if a.get("impact", 0) >= 2][:20]
    if not key_items:
        return []
    heads = "\n".join(f"- {a.get('titre','')} ({a.get('source_nom','')})" for a in key_items)
    system = ("You extract concrete future regulatory dates from news headlines for a "
              "compliance team. Only include dates that are clearly in the future and "
              "tied to a regulatory event (entry into force, deadline, supervision start, "
              "report due, consultation close). Respond in valid JSON only.")
    user = f"""Headlines:
{heads}

Return ONLY this JSON (empty list if none found):
{{
  "dates": [
    {{"date": "YYYY-MM-DD", "event": "short description", "theme": "e.g. AML/CFT", "type": "application|supervision|report|consultation|deadline"}}
  ]
}}"""
    data = _parse_json(_groq_chat(api_key, system, user, max_tokens=500))
    out = []
    for d in data.get("dates", []):
        if re.match(r"^\d{4}-\d{2}-\d{2}$", str(d.get("date", ""))):
            out.append(d)
    return out


def get_upcoming_dates(articles: list[dict], api_key: str = "",
                       horizon_days: int = 540, max_items: int = 8) -> list[dict]:
    """
    Return upcoming-dates as structured data (not HTML). Used by both the
    email HTML builder and the website data export.
    """
    today = date.today()
    combined = list(BASE_TIMELINE)
    combined += _extract_dates_with_groq(articles, api_key)

    seen = set()
    upcoming = []
    for item in combined:
        try:
            d = datetime.strptime(item["date"], "%Y-%m-%d").date()
        except (ValueError, KeyError):
            continue
        days = (d - today).days
        if days < 0 or days > horizon_days:
            continue
        sig = (item["date"], item.get("event", "")[:30].lower())
        if sig in seen:
            continue
        seen.add(sig)
        upcoming.append({**item, "days_away": days})

    upcoming.sort(key=lambda x: x["days_away"])
    return upcoming[:max_items]


def build_key_dates_timeline(articles: list[dict], api_key: str = "",
                             horizon_days: int = 540, max_items: int = 8) -> str:
    """
    Build the upcoming-dates timeline as email HTML. Wraps get_upcoming_dates.
    Works even if Groq is off (base timeline only).
    """
    upcoming = get_upcoming_dates(articles, api_key, horizon_days, max_items)
    if not upcoming:
        return ""

    rows = ""
    for item in upcoming:
        d_str = datetime.strptime(item["date"], "%Y-%m-%d").strftime("%d %b %Y")
        days = item["days_away"]
        if days <= 7:
            away, away_color = f"in {days}d", "#B91C1C"
        elif days < 90:
            away, away_color = f"in {days}d", "#92400E"
        else:
            away, away_color = f"in ~{days // 30}mo", "#6B7280"
        icon = TYPE_ICON.get(item.get("type", ""), "📅")
        rows += f'''<tr>
          <td style="padding:6px 10px 6px 0;font-size:12px;color:#111;white-space:nowrap;border-bottom:1px solid #F3F4F6;vertical-align:top">{icon} {d_str}</td>
          <td style="padding:6px 0;font-size:12px;color:#374151;border-bottom:1px solid #F3F4F6;vertical-align:top">{item.get("event","")}</td>
          <td style="padding:6px 0 6px 10px;font-size:12px;font-weight:600;color:{away_color};white-space:nowrap;border-bottom:1px solid #F3F4F6;vertical-align:top;text-align:right">{away}</td>
        </tr>'''

    return f'''
    <tr><td style="padding:8px 24px 4px">
      <div style="background:#F0F7FF;border:1px solid #CFE3F7;border-radius:8px;padding:16px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#0C447C;text-transform:uppercase;letter-spacing:0.06em">
          📅 Regulatory calendar — what's coming
        </p>
        <p style="margin:0 0 10px;font-size:11px;color:#5B7FA6;line-height:1.5">
          Key upcoming dates: entry into force, supervision milestones, reporting deadlines.
          Curated baseline plus dates detected in this week's news.
        </p>
        <table style="width:100%;border-collapse:collapse">{rows}</table>
      </div>
    </td></tr>'''
