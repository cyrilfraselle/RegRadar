"""
Validate docs/data/items.json and docs/data/meta.json before they get
committed by the daily watch workflow. A JSON file truncated by a Groq
timeout or a dead RSS feed is still valid enough to `json.load` — only a
schema check catches it. Exits non-zero on any failure, which fails the
GitHub Actions step and blocks the commit/push.
"""

import json
import sys

ITEMS_PATH = "docs/data/items.json"
META_PATH = "docs/data/meta.json"

REQUIRED_ITEM_FIELDS = ("id", "title", "url", "date", "impact")


def fail(msg: str) -> None:
    print(f"VALIDATION FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path: str):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        fail(f"{path} does not exist")
    except json.JSONDecodeError as e:
        fail(f"{path} is not valid JSON: {e}")


def validate_items(items) -> None:
    if not isinstance(items, list):
        fail(f"{ITEMS_PATH} must be a JSON list, got {type(items).__name__}")
    if not items:
        fail(f"{ITEMS_PATH} is empty")

    for i, item in enumerate(items):
        if not isinstance(item, dict):
            fail(f"{ITEMS_PATH}[{i}] is not an object")
        for field in REQUIRED_ITEM_FIELDS:
            if not item.get(field) and item.get(field) != 0:
                fail(f"{ITEMS_PATH}[{i}] (id={item.get('id')!r}) missing required field {field!r}")
        impact = item.get("impact")
        if not isinstance(impact, int) or not (1 <= impact <= 3):
            fail(f"{ITEMS_PATH}[{i}] (id={item.get('id')!r}) has invalid impact {impact!r}, expected int 1..3")

    print(f"OK: {ITEMS_PATH} — {len(items)} items, all required fields present")


def validate_meta(meta, item_count: int) -> None:
    if not isinstance(meta, dict):
        fail(f"{META_PATH} must be a JSON object, got {type(meta).__name__}")
    if not meta.get("last_updated"):
        fail(f"{META_PATH} missing 'last_updated'")

    archive_size = meta.get("archive_size")
    if not isinstance(archive_size, int):
        fail(f"{META_PATH} 'archive_size' missing or not an int: {archive_size!r}")
    if archive_size != item_count:
        fail(f"{META_PATH} archive_size={archive_size} does not match {item_count} items in {ITEMS_PATH}")

    print(f"OK: {META_PATH} — last_updated={meta['last_updated']!r}, archive_size={archive_size}")


def main() -> None:
    items = load_json(ITEMS_PATH)
    meta = load_json(META_PATH)
    validate_items(items)
    validate_meta(meta, len(items))
    print("Validation passed.")


if __name__ == "__main__":
    main()
