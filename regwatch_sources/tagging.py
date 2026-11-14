"""Deterministic topic tagging.

Rules live in docs/data/sources/topic-tags.json: each tag has regex
`patterns` and optional `exclude` patterns. A tag applies to a text when
at least one pattern matches and no exclude pattern matches. Every
assignment can be explained by the pattern that fired (`explain`).
"""
import json
import re
from pathlib import Path

TAGS_FILE = Path("docs/data/sources/topic-tags.json")


class Tagger:
    def __init__(self, rules: dict = None, path: Path = TAGS_FILE):
        if rules is None:
            rules = json.loads(Path(path).read_text(encoding="utf-8"))
        self.tags = []
        for t in rules["tags"]:
            self.tags.append({
                "id": t["id"], "label": t.get("label", t["id"]),
                "pats": [re.compile(p, re.I) for p in t.get("patterns", [])],
                "excl": [re.compile(p, re.I) for p in t.get("exclude", [])],
            })
        self.ids = [t["id"] for t in self.tags]

    def explain(self, text: str) -> dict:
        """{tag_id: matched snippet} for every tag that applies."""
        text = text or ""
        out = {}
        for t in self.tags:
            if any(x.search(text) for x in t["excl"]):
                continue
            for p in t["pats"]:
                m = p.search(text)
                if m:
                    out[t["id"]] = m.group(0)
                    break
        return out

    def tag(self, text: str) -> list:
        hits = self.explain(text)
        return [i for i in self.ids if i in hits]

    def tag_document(self, title: str, sections: list, min_paras: int = 2) -> dict:
        """Tag each section (any hit in its heading or paragraphs) and the
        document as a whole: a topic applies to the document when it is
        in the title or fires in at least `min_paras` paragraphs.

        Returns {"topics": [...], "topic_counts": {id: paragraphs},
        and sets section["topics"] in place."""
        counts = {}
        for s in sections:
            stags = set(self.tag(s.get("heading", "")))
            for p in s.get("paras", []):
                pt = self.tag(p["text"])
                if pt:
                    p["topics"] = pt
                for t in pt:
                    counts[t] = counts.get(t, 0) + 1
                stags.update(pt)
            s["topics"] = [i for i in self.ids if i in stags]
        in_title = set(self.tag(title))
        topics = [i for i in self.ids if i in in_title or counts.get(i, 0) >= min_paras]
        return {"topics": topics, "topic_counts": counts}


def score(tagger: Tagger, cases: list) -> dict:
    """Micro precision / recall of tag assignments on labelled cases."""
    tp = fp = fn = 0
    errors = []
    for c in cases:
        pred = set(tagger.tag(c["text"]))
        exp = set(c["expected"])
        tp += len(pred & exp)
        fp += len(pred - exp)
        fn += len(exp - pred)
        if pred != exp:
            errors.append({"text": c["text"][:120], "expected": sorted(exp), "got": sorted(pred)})
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    return {"cases": len(cases), "tp": tp, "fp": fp, "fn": fn,
            "precision": round(precision, 3), "recall": round(recall, 3), "errors": errors}
