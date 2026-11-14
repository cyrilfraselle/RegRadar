"""Quality gates for the deterministic tagger and the story clustering.

Fails when precision or recall on the labelled sets drops below the
thresholds stored in each golden file's _meta. Run:
    python tests/test_topic_precision.py
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from regwatch_sources.dedupe import same_story_raw  # noqa: E402
from regwatch_sources.tagging import Tagger, score  # noqa: E402

GOLDEN = ROOT / "tests/golden"


class QualityGates(unittest.TestCase):
    tagger = Tagger(path=ROOT / "docs/data/sources/topic-tags.json")

    def check_topics(self, name):
        g = json.loads((GOLDEN / name).read_text(encoding="utf-8"))
        r = score(self.tagger, g["cases"])
        th = g["_meta"]["thresholds"]
        print(f"{name}: precision {r['precision']} recall {r['recall']} on {r['cases']} cases")
        self.assertGreaterEqual(r["precision"], th["precision"], r["errors"][:5])
        self.assertGreaterEqual(r["recall"], th["recall"], r["errors"][:5])

    def test_golden(self):
        self.check_topics("topic_golden.json")

    def test_heldout(self):
        self.check_topics("topic_heldout.json")

    def test_duplicate_pairs(self):
        g = json.loads((GOLDEN / "duplicate_pairs.json").read_text(encoding="utf-8"))
        tp = fp = fn = 0
        for p in g["pairs"]:
            pr = same_story_raw(p["a"]["title"], p["b"]["title"])
            tp += pr and p["same_story"]
            fp += pr and not p["same_story"]
            fn += (not pr) and p["same_story"]
        precision, recall = tp / (tp + fp), tp / (tp + fn)
        print(f"duplicate_pairs: precision {precision:.3f} recall {recall:.3f} on {len(g['pairs'])} pairs")
        self.assertGreaterEqual(precision, g["_meta"]["thresholds"]["precision"])
        self.assertGreaterEqual(recall, g["_meta"]["thresholds"]["recall"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
