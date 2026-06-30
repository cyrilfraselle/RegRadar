"""
═══════════════════════════════════════════════════════════════════
  ENRICHMENT v3 — Groq AI summaries + Trend sparklines
  Companion module for regulatory_watch.py

  TWO FEATURES:
  ─────────────
  1. GROQ SUMMARIES (free, no credit card)
     Adds a plain-English "what it is / what to do" summary to every
     relevant article. Uses Groq's free tier (llama-3.3-70b-versatile).

  2. TREND SPARKLINES
     Tracks article volume per theme over a rolling 8-week window and
     surfaces which regulatory topics are heating up or cooling down.
     Stored in trends.json (auto-created).

  SETUP:
  ──────
  1. Free Groq key at https://console.groq.com  (2 min, no card)
  2. pip install requests   (already installed)
  3. In regulatory_watch.py CONFIG, add a "groq" block (see INTEGRATION.md)
═══════════════════════════════════════════════════════════════════
"""

import json
import re
import time
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

import requests

log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
#  PART 1 — GROQ AI SUMMARIES
# ═══════════════════════════════════════════════════════════════

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"   # free tier, strong model

SYSTEM_PROMPT = (
    "You are a senior EU and Belgian financial-regulation analyst writing for a "
    "Big Four compliance, regulatory and risk team. Your focus is regulatory and "
    "supervisory developments affecting financial institutions in the EU and Belgium: "
    "new rules, guidelines, technical standards, consultations, supervisory actions, "
    "enforcement and financial crime. "
    "You may cover crypto, payments and fintech, but ONLY through a regulatory/compliance "
    "lens (licensing, authorisation, AML, conduct) — never as general market or business news. "
    "Be precise, concrete and concise. Never invent facts not supported by the input. "
    "Always respond in valid JSON only — no markdown, no preamble."
)

USER_PROMPT_TEMPLATE = """Analyse this news item for an EU/Belgian financial-services compliance team.

Title: {title}
Source: {source}
Summary: {summary}

Guidance:
- Focus on the regulatory/compliance angle. If the item is purely market/business news
  (earnings, funding, price moves) with no compliance relevance, set relevance to "low".
- Prioritise EU and Belgian impact. Note explicitly if it is Belgium-specific.
- For "action", give a concrete compliance task only if the item genuinely warrants one.
- For "entities", pick ONLY the affected types from this exact list (use these exact labels):
  ["Banks", "Payment Institutions", "Investment Firms", "Asset & Wealth Managers",
   "Insurance Undertakings", "Market Infrastructure", "CASPs",
   "Lending & Credit Providers", "Critical ICT Providers"]
  Return an empty list if none clearly apply. Do not invent labels outside this list.

Return ONLY this JSON (no markdown):
{{
  "summary": "1-2 sentences, plain English: what this is and which firms it affects",
  "so_what": "1 sentence: the concrete compliance/regulatory implication, or 'Informational only'",
  "action": "Specific action a compliance team should take (e.g. 'Review CASP onboarding before 1 July'), else 'No action required'",
  "deadline": "YYYY-MM-DD if a concrete date is mentioned, else null",
  "jurisdiction": "Belgium / EU / Global",
  "entities": ["affected entity types from the allowed list"],
  "relevance": "high / medium / low — relevance to an EU/BE financial compliance team"
}}"""


def _parse_json(raw: str) -> dict:
    """Robustly extract a JSON object from an LLM response."""
    if not raw:
        return {}
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def _call_groq(api_key: str, title: str, source: str, summary: str,
               timeout: int = 30, _retry: bool = True) -> dict:
    """Single Groq API call. Returns parsed dict or {} on failure.
    On a 429 rate-limit, backs off and retries once."""
    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.1,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(
                title=title, source=source, summary=(summary or "")[:800]
            )},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        r = requests.post(GROQ_URL, headers=headers, json=payload, timeout=timeout)
        if r.status_code == 401:
            log.error("Groq API key invalid (401). Check config.")
            return {"_auth_error": True}
        if r.status_code == 429:
            # Respect Retry-After header if present, else back off 6s, then retry once
            wait = 6
            try:
                wait = int(float(r.headers.get("retry-after", wait)))
            except (ValueError, TypeError):
                pass
            wait = min(wait, 15)
            if _retry:
                log.warning(f"Groq rate limit (429). Waiting {wait}s and retrying once.")
                time.sleep(wait)
                return _call_groq(api_key, title, source, summary, timeout, _retry=False)
            log.warning("Groq rate limit (429) again — skipping this item.")
            return {}
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        return _parse_json(content)
    except Exception as e:
        log.warning(f"Groq call failed: {e}")
        return {}


def _groq_ready(api_key: str) -> bool:
    """True only for a real Groq key (gsk_...). Rejects xai-/placeholders."""
    if not api_key:
        return False
    k = api_key.strip()
    if not k.startswith("gsk_"):
        if k.startswith("xai-"):
            log.error("API key starts with 'xai-' (xAI/Grok key). Need a GROQ key (gsk_) from console.groq.com.")
        return False
    if "PASTE" in k.upper() or "YOUR" in k.upper() or "XXXX" in k.upper():
        return False
    return True


def enrich_with_groq(articles: list[dict], api_key: str,
                     min_impact: int = 2, max_calls: int = 40,
                     sleep_between: float = 0.5) -> list[dict]:
    """
    Add AI summaries to articles at or above `min_impact`.

    To respect the free tier and keep runtime sane:
      - only enriches impact >= min_impact (default: important + critical)
      - caps total calls at max_calls
      - sleeps between calls to stay within rate limits

    Adds keys: ai_summary, ai_so_what, ai_action, ai_deadline, ai_confidence
    """
    if not _groq_ready(api_key):
        log.info("Groq disabled (no valid key). Skipping AI summaries.")
        return articles

    eligible = [a for a in articles if a.get("impact", 0) >= min_impact]
    eligible = eligible[:max_calls]
    log.info(f"Groq enrichment → {len(eligible)} article(s) (impact >= {min_impact})")

    enriched_count = 0
    for art in eligible:
        result = _call_groq(
            api_key,
            art.get("titre", ""),
            art.get("source_nom", ""),
            art.get("resume", ""),
        )
        if result.get("_auth_error"):
            log.error("Stopping Groq enrichment — fix the API key.")
            break
        if result:
            art["ai_summary"]    = result.get("summary", "")
            art["ai_so_what"]    = result.get("so_what", "")
            art["ai_action"]     = result.get("action", "")
            art["ai_deadline"]   = result.get("deadline")
            art["ai_jurisdiction"] = result.get("jurisdiction", "")
            art["ai_entities"]   = result.get("entities", [])
            art["ai_relevance"]  = result.get("relevance", result.get("confidence", ""))
            enriched_count += 1
        time.sleep(sleep_between)

    log.info(f"Groq enrichment → {enriched_count} article(s) summarised")
    return articles


def build_exec_summary(articles: list[dict], api_key: str) -> str:
    """
    Generate a 3-sentence executive 'this week' summary from the
    critical + important items. Returns HTML-safe text, or "" on failure.
    """
    if not _groq_ready(api_key):
        return ""

    key_items = [a for a in articles if a.get("impact", 0) >= 2][:15]
    if not key_items:
        return ""

    bullet_list = "\n".join(
        f"- [{a.get('source_nom','?')}] {a.get('titre','')}" for a in key_items
    )
    prompt = (
        "You are briefing a Big Four EU/Belgian financial-services compliance, regulatory "
        "and risk team. From this week's items below, write a tight 3-4 sentence executive "
        "summary. Prioritise: (1) the most significant EU or Belgian regulatory development "
        "(new rules, guidelines, technical standards, supervisory actions); (2) any "
        "Belgium-specific item; (3) any major enforcement or financial-crime action. "
        "Mention crypto/payments/fintech only through a regulatory/compliance lens. "
        "Ignore pure market or business news. Be specific — name the regulation, regulator "
        "or firm. Plain text, no markdown, no bullet points.\n\n" + bullet_list
    )
    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.2,
        "max_tokens": 250,
        "messages": [
            {"role": "system", "content": "You are a concise senior regulatory analyst."},
            {"role": "user", "content": prompt},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        r = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log.warning(f"Exec summary failed: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════
#  PART 2 — TREND SPARKLINES
# ═══════════════════════════════════════════════════════════════

TRENDS_FILE = Path("trends.json")
TREND_WINDOW = 8          # weeks of history to consider
RISING_THRESHOLD = 30     # % above average to count as "rising"
RISING_MIN_COUNT = 2      # need at least this many items to flag rising
SPARK_BLOCKS = "▁▂▃▄▅▆▇█"


def _iso_week(dt: datetime) -> str:
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def _sparkline(values: list[int]) -> str:
    if not values or max(values) == 0:
        return SPARK_BLOCKS[0] * len(values)
    lo, hi = min(values), max(values)
    span = hi - lo or 1
    return "".join(SPARK_BLOCKS[min(7, int((v - lo) / span * 7))] for v in values)


def load_trends() -> dict:
    if TRENDS_FILE.exists():
        with open(TRENDS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_trends(trends: dict):
    # Prune to keep only the last 26 weeks per theme
    for theme in trends:
        weeks = sorted(trends[theme].keys())
        if len(weeks) > 26:
            for old in weeks[:-26]:
                del trends[theme][old]
    with open(TRENDS_FILE, "w", encoding="utf-8") as f:
        json.dump(trends, f, indent=2)


def record_week(articles: list[dict], trends: dict = None) -> dict:
    """
    Add this run's theme counts to the current ISO week in trends.json.
    Counts each article once per theme it carries.
    """
    if trends is None:
        trends = load_trends()
    current_week = _iso_week(datetime.now())

    week_counts = defaultdict(int)
    for art in articles:
        for theme in art.get("themes", []):
            week_counts[theme] += 1

    for theme, count in week_counts.items():
        trends.setdefault(theme, {})
        # Overwrite (not increment) so re-runs in the same week don't double-count
        trends[theme][current_week] = count

    save_trends(trends)
    return trends


def analyze_trends(trends: dict, window: int = TREND_WINDOW) -> list[dict]:
    """
    Compute trend metrics per theme over the trailing `window` weeks.
    Returns a list sorted by % change (most rising first).
    """
    current_week = _iso_week(datetime.now())
    results = []

    for theme, week_counts in trends.items():
        weeks_sorted = sorted(week_counts.keys())[-window:]
        if not weeks_sorted:
            continue
        values = [week_counts.get(w, 0) for w in weeks_sorted]
        this_week = week_counts.get(current_week, 0)
        prior = values[:-1] if len(values) > 1 else values
        avg = sum(prior) / len(prior) if prior else 0

        if avg == 0:
            pct = 100 if this_week > 0 else 0
        else:
            pct = round((this_week - avg) / avg * 100)

        if pct >= RISING_THRESHOLD and this_week >= RISING_MIN_COUNT:
            arrow, label, color = "▲", "RISING", "#B91C1C"
        elif pct <= -RISING_THRESHOLD:
            arrow, label, color = "▼", "COOLING", "#2563EB"
        else:
            arrow, label, color = "▬", "STABLE", "#6B7280"

        results.append({
            "theme": theme,
            "this_week": this_week,
            "avg": round(avg, 1),
            "pct": pct,
            "arrow": arrow,
            "label": label,
            "color": color,
            "spark": _sparkline(values),
            "values": values,
            "weeks": len(weeks_sorted),
        })

    results.sort(key=lambda x: -x["pct"])
    return results


def render_trends_html(trend_results: list[dict], top_n: int = 6) -> str:
    """
    Render the trend block as an email-safe HTML table.
    Only shows themes with data; explains the basis clearly.
    """
    active = [t for t in trend_results if t["this_week"] > 0 or t["pct"] != 0]
    if not active:
        return ""

    shown = active[:top_n]
    rows = ""
    for t in shown:
        pct_str = f"{t['pct']:+d}%" if t["avg"] > 0 else "new"
        rows += f'''<tr>
          <td style="padding:6px 8px;font-size:13px;color:#111;border-bottom:1px solid #F3F4F6">{t['theme']}</td>
          <td style="padding:6px 8px;font-size:15px;letter-spacing:1px;color:#374151;border-bottom:1px solid #F3F4F6;font-family:monospace">{t['spark']}</td>
          <td style="padding:6px 8px;font-size:13px;font-weight:600;color:{t['color']};border-bottom:1px solid #F3F4F6;white-space:nowrap">{t['arrow']} {t['label']}</td>
          <td style="padding:6px 8px;font-size:12px;color:#6B7280;border-bottom:1px solid #F3F4F6;white-space:nowrap">{t['this_week']} this wk · avg {t['avg']} · {pct_str}</td>
        </tr>'''

    weeks_span = max((t["weeks"] for t in shown), default=0)

    return f'''
    <div style="margin:8px 0 24px">
      <p style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;padding-bottom:6px;border-bottom:2px solid #F3F4F6">
        📈 Regulatory Activity Trends
      </p>
      <p style="font-size:11px;color:#9CA3AF;margin:6px 0 10px;line-height:1.5">
        Number of items tagged to each theme, per week, over the last {weeks_span} week(s).
        <b>▲ RISING</b> = this week is &gt;{RISING_THRESHOLD}% above the {weeks_span}-week average (min {RISING_MIN_COUNT} items).
        Sparkline shows the {weeks_span}-week shape (left = oldest, right = this week).
      </p>
      <table style="width:100%;border-collapse:collapse">{rows}</table>
    </div>'''


def build_trend_text(trend_results: list[dict], top_n: int = 4) -> str:
    """Short plain-text trend line for the subject/preview, e.g. 'AML ▲, MiCA ▼'."""
    rising = [t for t in trend_results if t["label"] == "RISING"][:top_n]
    if not rising:
        return ""
    return "Heating up: " + ", ".join(f"{t['theme']} {t['arrow']}" for t in rising)
