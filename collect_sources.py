"""RegWatch engine v2: collect the sources in docs/data/sources/registry.json.

    python collect_sources.py                    # normal run (what CI does)
    python collect_sources.py --only amla-news,amla-instruments --max-docs 2
    python collect_sources.py --no-docs          # listings only
    python collect_sources.py --coverage-only    # rerun the recall check
    python collect_sources.py --force            # ignore weekly polling

Independent of regulatory_watch.py: it reads docs/data/items.json only to
cluster the legacy archive into feed.json, and never writes it.
"""
import argparse
import json
import logging
import sys

from regwatch_sources.run import Engine


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default="", help="comma-separated source ids")
    ap.add_argument("--max-docs", type=int, default=None, help="documents to extract this run")
    ap.add_argument("--budget", type=int, default=None, help="HTTP request budget this run")
    ap.add_argument("--no-docs", action="store_true")
    ap.add_argument("--no-coverage", action="store_true")
    ap.add_argument("--coverage-only", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    eng = Engine(only=[x for x in a.only.split(",") if x], max_docs=a.max_docs, budget=a.budget,
                 docs=not a.no_docs, force=a.force, coverage=not a.no_coverage)
    run = eng.run_all(coverage_only=a.coverage_only)
    print(json.dumps({k: v for k, v in run.items() if k != "errors"}, indent=1))
    for e in run["errors"]:
        print("ERROR", e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
