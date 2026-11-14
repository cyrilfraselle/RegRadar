"""The legacy pipeline (regulatory_watch.py) must not list a source whose
robots.txt forbids crawling (strategy/scraper-audit.md, 2026-11-14).

Offline: the SOURCES literal is read with ast, so the test does not need
feedparser, gspread or network access.

Run: python -m unittest discover -s tests -p "test_*.py"
"""
import ast
import sys
import unittest
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SRC = (ROOT / "regulatory_watch.py").read_text(encoding="utf-8")
FORBIDDEN = ("eur-lex.europa.eu", "news.google.com")


def legacy_sources():
    tree = ast.parse(SRC)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "SOURCES" for t in node.targets) \
                and isinstance(node.value, ast.List):
            return ast.literal_eval(node.value)
    raise AssertionError("SOURCES list not found")


class LegacySourcesRespectRobots(unittest.TestCase):
    def test_no_forbidden_host_in_sources(self):
        srcs = legacy_sources()
        self.assertTrue(srcs)
        for s in srcs:
            host = urlsplit(s["url"]).netloc
            self.assertFalse(any(host.endswith(h) for h in FORBIDDEN), s["id"])
            self.assertFalse(s["id"].startswith(("gnews_", "eurlex_")), s["id"])

    def test_sixteen_regulator_sources_remain(self):
        # 18 regulator feeds in the audit minus the 2 EUR-Lex feeds.
        self.assertEqual(len(legacy_sources()), 16)

    def test_refined_google_news_list_is_retired(self):
        import classification_v3
        self.assertEqual(classification_v3.REFINED_GNEWS_SOURCES, [])
        self.assertNotIn("REFINED_GNEWS_SOURCES", SRC)

    def test_runtime_guard_checks_robots_before_each_source(self):
        self.assertIn('DISALLOWED_HOSTS = ("eur-lex.europa.eu", "news.google.com")', SRC)
        body = SRC.split("def collecter_toutes_sources", 1)[1].split("\ndef ", 1)[0]
        self.assertLess(body.index("robots_allows(source[\"url\"])"), body.index("lire_flux_rss(source)"))

    def test_robots_matching_used_by_the_guard(self):
        from regwatch_sources.fetch import Robots
        self.assertFalse(Robots("User-agent: *\nDisallow: /").allowed("https://eur-lex.europa.eu/x"))
        self.assertTrue(Robots("User-agent: *\nDisallow: /admin").allowed("https://www.fsma.be/en/rss.xml"))
        self.assertFalse(Robots("", 503).allowed("https://example.org/feed"))


if __name__ == "__main__":
    unittest.main()
