"""
═══════════════════════════════════════════════════════════════════
  DASHBOARD DATA v1 — Export engine output to JSON for the website
  Companion module for regulatory_watch.py

  WHAT THIS DOES
  ──────────────
  Takes the scored + enriched articles from a watch cycle and writes
  clean JSON files into a /docs/data folder. These files are the
  "data layer" the website reads. Nothing here touches collection,
  scoring, or email — it's a pure, additive export step.

  FILES PRODUCED (in docs/data/)
  ──────────────────────────────
  • items.json      — the full accumulated archive (grows over time,
                      deduplicated). This powers the dashboard + archive.
  • meta.json       — summary stats + timeline + trends + exec summary
                      for the most recent run (powers the dashboard header).

  WHY A /docs FOLDER?
  ───────────────────
  GitHub Pages can serve a site straight from a /docs folder on the main
  branch — the simplest possible hosting. The website HTML will live in
  /docs and its data in /docs/data, so everything the site needs is in
  one place.
═══════════════════════════════════════════════════════════════════
"""

import json
import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

# Where the website + its data live (served by GitHub Pages later)
DOCS_DIR = Path("docs")
DATA_DIR = DOCS_DIR / "data"
ITEMS_FILE = DATA_DIR / "items.json"
META_FILE = DATA_DIR / "meta.json"

# Keep the archive bounded so the JSON stays fast to load in a browser
MAX_ARCHIVE_ITEMS = 2000


def _ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _article_to_record(art: dict) -> dict:
    """
    Convert an internal article dict into a clean, JSON-safe record
    for the website. Only the fields the front end needs, nothing else.
    """
    date = art.get("date")
    if isinstance(date, datetime):
        date_iso = date.isoformat()
    else:
        date_iso = str(date) if date else ""

    return {
        "id": art.get("id", ""),
        "title": art.get("titre", ""),
        "url": art.get("lien", ""),
        "date": date_iso,
        "source": art.get("source_nom", ""),
        "source_id": art.get("source_id", ""),
        "country": art.get("pays", ""),
        "color": art.get("couleur", "#888"),
        "impact": art.get("impact", 0),
        "themes": art.get("themes", []),
        # AI-enriched fields (may be empty if Groq is off)
        "summary": art.get("ai_summary", art.get("resume", "")),
        "so_what": art.get("ai_so_what", ""),
        "action": art.get("ai_action", ""),
        "deadline": art.get("ai_deadline", ""),
        "jurisdiction": art.get("ai_jurisdiction", ""),
        "entities": art.get("ai_entities", []),
        "relevance": art.get("ai_relevance", ""),
    }


def _load_existing_archive() -> list[dict]:
    """Load the existing items.json archive, or return [] if none yet."""
    if ITEMS_FILE.exists():
        try:
            with open(ITEMS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"Could not read existing items.json ({e}); starting fresh.")
    return []


def export_dashboard_data(articles: list[dict],
                          exec_summary: str = "",
                          timeline: list[dict] = None,
                          trends: list[dict] = None):
    """
    Merge this run's articles into the persistent archive and write the
    JSON files the website reads.

    Args:
        articles    : this cycle's scored + enriched article dicts
        exec_summary : the plain-text "this week in brief" string
        timeline    : list of upcoming-date dicts (from intelligence_v4)
        trends      : list of trend-result dicts (from enrichment_v3)
    """
    _ensure_dirs()

    # 1. Merge new items into the archive, deduplicated by id
    existing = _load_existing_archive()
    by_id = {rec["id"]: rec for rec in existing if rec.get("id")}

    new_count = 0
    for art in articles:
        rec = _article_to_record(art)
        if not rec["id"]:
            continue
        if rec["id"] not in by_id:
            new_count += 1
        by_id[rec["id"]] = rec  # new or updated

    # Sort newest first, cap the archive size
    merged = sorted(by_id.values(),
                    key=lambda r: r.get("date", ""), reverse=True)
    merged = merged[:MAX_ARCHIVE_ITEMS]

    with open(ITEMS_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    log.info(f"Dashboard: items.json written ({len(merged)} total, {new_count} new)")

    # 2. Build the meta file (header stats + this run's extras)
    this_run = [_article_to_record(a) for a in articles]
    meta = {
        "last_updated": datetime.now().isoformat(),
        "last_run_counts": {
            "total": len(this_run),
            "critical": sum(1 for r in this_run if r["impact"] == 3),
            "important": sum(1 for r in this_run if r["impact"] == 2),
            "info": sum(1 for r in this_run if r["impact"] == 1),
        },
        "archive_size": len(merged),
        "exec_summary": exec_summary or "",
        "timeline": timeline or [],
        "trends": trends or [],
    }
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    log.info("Dashboard: meta.json written")

    return {"archive_size": len(merged), "new_items": new_count}
