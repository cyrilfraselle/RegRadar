"""Offline tests for the RegWatch engine v2 (no network).

Run: python -m unittest discover -s tests -p "test_*.py"
"""
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from regwatch_sources import extract, classify  # noqa: E402
from regwatch_sources.dedupe import canonical_url, cluster, identifier, same_story_raw  # noqa: E402
from regwatch_sources.fetch import Fetcher, Robots  # noqa: E402
from regwatch_sources.parsers import parse_cellar, parse_date, parse_rss, parse_amla_instruments  # noqa: E402
from regwatch_sources.run import Engine, coverage_check  # noqa: E402


def make_pdf(pages):
    """A tiny valid PDF with one text line per paragraph (stdlib only)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        ops = ["BT", "/F1 11 Tf", "72 760 Td", "14 TL"]
        for ln in lines:
            ops.append("(" + ln.replace("(", "\\(").replace(")", "\\)") + ") Tj T*" if ln else "T*")
        ops.append("ET")
        stream = "\n".join(ops)
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
        content_n = len(objs)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_n} 0 R "
                    f"/Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"
    out, offs = io.BytesIO(), []
    out.write(b"%PDF-1.4\n")
    for i, o in enumerate(objs, 1):
        offs.append(out.tell())
        out.write(f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1"))
    x = out.tell()
    out.write(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
    for o in offs:
        out.write(f"{o:010d} 00000 n \n".encode())
    out.write(f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF".encode())
    return out.getvalue()


class FakeResp:
    def __init__(self, status=200, body=b"", headers=None, url=""):
        self.status_code, self._body, self.headers, self.url = status, body, headers or {}, url

    def iter_content(self, n):
        for i in range(0, len(self._body), n):
            yield self._body[i:i + n]

    @property
    def text(self):
        return self._body.decode("utf-8", "replace")

    def close(self):
        pass


class FakeSession:
    """Routes URL -> list of responses (consumed in order, last one repeats)."""

    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def get(self, url, headers=None, **kw):
        self.calls.append(("GET", url, dict(headers or {})))
        seq = self.routes.get(url) or [FakeResp(404, b"")]
        r = seq.pop(0) if len(seq) > 1 else seq[0]
        r.url = r.url or url
        return r

    post = get


def fetcher(routes, **kw):
    routes.setdefault("https://ex.test/robots.txt", [FakeResp(200, b"User-agent: *\nDisallow: /private\n")])
    return Fetcher({}, session=FakeSession(routes), sleep=lambda s: None, **kw)


class RobotsTest(unittest.TestCase):
    def test_wildcards_longest_match_and_delay(self):
        r = Robots("User-agent: *\nCrawl-delay: 10\nDisallow: /*?*\nAllow: /a?ok\nDisallow: /x$\n")
        self.assertFalse(r.allowed("https://h/page?q=1"))
        self.assertTrue(r.allowed("https://h/a?ok"))
        self.assertTrue(r.allowed("https://h/page"))
        self.assertFalse(r.allowed("https://h/x"))
        self.assertTrue(r.allowed("https://h/xy"))
        self.assertEqual(r.crawl_delay(), 10)

    def test_disallow_all_and_status_rules(self):
        self.assertFalse(Robots("User-agent: *\nDisallow: /\n").allowed("https://eur-lex.europa.eu/x"))
        self.assertTrue(Robots("", 404).allowed("https://h/x"))
        self.assertFalse(Robots("", 503).allowed("https://h/x"))


class FetchTest(unittest.TestCase):
    def test_conditional_304_and_retry(self):
        url = "https://ex.test/feed"
        f = fetcher({url: [FakeResp(503), FakeResp(200, b"<rss/>", {"ETag": '"v1"'}), FakeResp(304)]})
        r1 = f.get(url)
        self.assertTrue(r1.ok)
        self.assertEqual(f.stats["retries"], 1)
        r2 = f.get(url)
        self.assertTrue(r2.not_modified)
        self.assertEqual(f.session.calls[-1][2].get("If-None-Match"), '"v1"')

    def test_robots_block_and_budget(self):
        f = fetcher({}, budget=3)
        self.assertIn("robots", f.get("https://ex.test/private/doc").error)
        from regwatch_sources.fetch import BudgetExceeded
        with self.assertRaises(BudgetExceeded):
            for _ in range(5):
                f.get("https://ex.test/p")

    def test_challenge_page_is_an_error(self):
        url = "https://ex.test/c"
        f = fetcher({url: [FakeResp(200, b"<html><title>Just a moment...</title></html>")]})
        self.assertIn("soft failure", f.get(url).error)


class ExtractTest(unittest.TestCase):
    def test_html_sections_and_locators(self):
        html = ("<html><body><nav>menu</nav><main><h1>Title</h1><p class='oj-ti-art'>Article 5</p>"
                "<p class='oj-sti-art'>Customer due diligence</p><p>Obliged entities shall identify the customer.</p>"
                "<p>They shall verify the identity.</p></main></body></html>").encode()
        ex = extract.extract(html, "text/html", "https://ex.test/a")
        sec = [s for s in ex["sections"] if s["heading"].startswith("Article 5")][0]
        self.assertEqual(sec["heading"], "Article 5 - Customer due diligence")
        self.assertEqual(sec["paras"][1]["loc"], "Article 5, para 2")

    def test_pdf_pages_and_paragraphs(self):
        pdf = make_pdf([["Cover page"], ["1. First paragraph of page two.", "", "2. Second paragraph on page two."]])
        ex = extract.extract(pdf, "application/pdf", "https://ex.test/a.pdf")
        self.assertEqual(ex["pages_total"], 2)
        p2 = ex["sections"][1]["paras"]
        self.assertEqual(len(p2), 2)
        self.assertEqual(p2[1]["loc"], "p. 2, para 2")
        self.assertIn("Second paragraph", p2[1]["text"])

    def test_size_cap(self):
        secs = [{"heading": f"h{i}", "paras": ["x" * 1000] * 10} for i in range(30)]
        res = extract.finalize(secs, max_chars=25_000)
        self.assertTrue(res["truncated"])
        self.assertLessEqual(res["chars_stored"], 25_000)
        self.assertTrue(res["outline_of_rest"])


class ParserTest(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(parse_date("8 May 2026, 23:59 (CEST)"), "2026-05-08")
        self.assertEqual(parse_date("29/10/2026"), "2026-10-29")
        self.assertEqual(parse_date("13 NOVEMBER 2026"), "2026-11-13")
        self.assertEqual(parse_date("no date"), "")

    def test_rss_without_date_keeps_empty(self):
        rss = b"<rss><channel><item><title>T</title><link>https://ex.test/1</link></item></channel></rss>"
        self.assertEqual(parse_rss({"params": {}}, rss)[0]["date"], "")

    def test_cellar_corrigendum(self):
        body = json.dumps({"results": {"bindings": [{"celex": {"value": "32024R1624R(04)"}, "pub": {"value": "2026-06-26"},
                           "rel": {"value": "http://x#resource_legal_corrects_resource_legal"}, "basecelex": {"value": "32024R1624"}}]}}).encode()
        e = parse_cellar({"params": {}}, body)[0]
        self.assertTrue(e["extra"]["corrigendum"])
        self.assertIn("AMLR", e["title"])
        self.assertEqual(e["summary"], "corrects 32024R1624")

    def test_amla_instruments_status(self):
        html = (b"<main><table><tr><th>Type</th><th>Legal Basis</th><th>Mandate</th><th>Status</th></tr>"
                b"<tr><td>RTS</td><td>AMLR 28(1)</td><td>Draft RTS on CDD</td><td><a href='/d/f.pdf'>Final report published</a></td></tr>"
                b"</table></main>")
        e = parse_amla_instruments({}, html, "https://www.amla.europa.eu/x")[0]
        self.assertEqual(e["url"], "https://www.amla.europa.eu/d/f.pdf")
        self.assertEqual(classify.doc_status(e, classify.doc_type(e, {"type": "rts_its_draft"})),
                         "final (submitted to the Commission)")


class DedupeTest(unittest.TestCase):
    def test_identifier_rules(self):
        self.assertEqual(identifier("OJ:L_202602165: Council Implementing Regulation (EU) 2026/2165"), "2026/2165")
        self.assertEqual(identifier("CELEX:32026R2165: x"), "2026/2165")
        self.assertTrue(same_story_raw("OJ:L_202602165: A", "CELEX:32026R2165: B"))
        self.assertFalse(same_story_raw("Council Regulation (EU) 2026/2490 amending", "Council Regulation (EU) 2026/2491 amending"))
        self.assertFalse(same_story_raw("Press release on the suspension of trading in Nyrstar",
                                        "Press release on the reopening of trading in Nyrstar"))

    def test_primary_documents_need_same_subject(self):
        from regwatch_sources.dedupe import same_primary_document
        self.assertFalse(same_primary_document("Draft Implementing Technical Standards on FIU reporting to the EPPO",
                                               "Draft Implementing Technical Standards on AMLA reporting to the EPPO"))
        self.assertTrue(same_primary_document("Consultation on the draft RTS on Customer Due Diligence",
                                              "Draft Regulatory Technical Standards on Customer Due Diligence."))

    def test_cluster_syndicated(self):
        items = [{"title": "Binance’s EU services face scrutiny over licensing exemption - TradingView", "url": "u1", "date": "2026-11-01"},
                 {"title": "Binance’s EU services face scrutiny over licensing exemption: Report - Cryptonews.net", "url": "u2", "date": "2026-11-02"},
                 {"title": "EBA publishes guidelines on something else", "url": "u3", "date": "2026-11-02"}]
        groups = sorted(len(g) for g in cluster(items))
        self.assertEqual(groups, [1, 2])

    def test_canonical_url(self):
        self.assertEqual(canonical_url("https://www.Ex.test/a/?utm_source=x&id=2#f"), "https://ex.test/a?id=2")


class RankTest(unittest.TestCase):
    def test_primary_outranks_news(self):
        news = {"is_news": True, "topics": ["cdd", "pep", "sanctions", "crypto-assets", "training"], "date": "2026-11-14"}
        weak = {"is_news": False, "in_scope": True, "type": "supervisory_communication", "topics": [], "date": "2026-01-01"}
        self.assertGreater(classify.rank(weak, "2026-11-14"), classify.rank(news, "2026-11-14"))
        self.assertEqual(classify.tier(news), "info")

    def test_text_deadlines(self):
        secs = [{"paras": [{"text": "The consultation runs until 8 May 2026. Other text.", "loc": "p. 1, para 1"}]}]
        d = classify.text_deadlines(secs)
        self.assertEqual(d[0]["date"], "2026-05-08")
        self.assertEqual(d[0]["kind"], "consultation closes")


class CoverageTest(unittest.TestCase):
    def test_recall_and_period(self):
        ours = [{"url": "https://ex.test/a", "title": "EBA publishes final Guidelines on X", "date": "2026-10-01"}]
        listing = [{"url": "https://ex.test/a/", "title": "x", "date": "2026-10-02"},
                   {"url": "https://ex.test/b", "title": "EBA consults on Y", "date": "2026-10-05"},
                   {"url": "https://ex.test/old", "title": "old", "date": "2025-01-01"}]
        c = coverage_check("s", "ref", listing, ours)
        self.assertEqual((c["in_period"], c["matched"], c["recall"]), (2, 1, 0.5))
        self.assertEqual(c["missed"][0]["url"], "https://ex.test/b")


class EngineTest(unittest.TestCase):
    """End to end on a temporary data dir: new, unchanged (304), changed, withdrawn."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "docs").mkdir()
        shutil.copy(ROOT / "docs/data/sources/topic-tags.json", self.tmp / "topic-tags.json")
        reg = {"_meta": {"budget": {"requests_per_run": 50, "docs_per_run": 5, "default_delay_s": 0}},
               "sources": [{"id": "t-list", "authority": "T", "name": "T", "type": "guideline", "jurisdiction": "EU",
                            "parser": "rss", "status": "working", "url": "https://ex.test/feed", "polling": "daily",
                            "scope": "all", "max_docs": 5, "complete_listing": True}]}
        (self.tmp / "registry.json").write_text(json.dumps(reg))

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def rss(self, items):
        body = "".join(f"<item><title>{t}</title><link>{l}</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate></item>" for t, l in items)
        return f"<rss><channel>{body}</channel></rss>".encode()

    def engine(self, routes):
        return Engine(data_dir=self.tmp, fetcher=fetcher(routes), today="2026-11-14", coverage=False,
                      legacy_items=self.tmp / "none.json", golden_dir=ROOT / "tests/golden")

    def test_lifecycle(self):
        page = (b"<html><main><h1>Guidelines on customer due diligence</h1>"
                b"<p>Obliged entities shall apply customer due diligence measures to every customer.</p>"
                b"<p>They shall identify politically exposed persons.</p></main></html>")
        feed1 = self.rss([("Guidelines on customer due diligence", "https://ex.test/doc1")])
        r = self.engine({"https://ex.test/feed": [FakeResp(200, feed1, {"ETag": '"a"'})],
                         "https://ex.test/doc1": [FakeResp(200, page, {"Content-Type": "text/html"})]}).run_all()
        self.assertEqual((r["new"], r["docs_new"], r["proposals_new"]), (1, 1, 1))
        doc = json.loads(next((self.tmp / "docs").glob("*.json")).read_text())
        self.assertIn("cdd", doc["topics"])
        self.assertEqual(doc["sections"][0]["paras"][0]["loc"].split(", ")[-1], "para 1")
        prop = json.loads((self.tmp / "proposals.json").read_text())["proposals"][0]
        self.assertEqual(prop["review_status"], "needs-review")
        self.assertTrue(prop["quotes"][0]["text"].startswith("Obliged entities shall"))
        # second run: feed answers 304 -> nothing new
        r = self.engine({"https://ex.test/feed": [FakeResp(304)]}).run_all()
        self.assertEqual((r["new"], r["changed"]), (0, 0))
        # third run: the item disappears from a complete listing -> withdrawn
        feed3 = self.rss([("Another guideline on record keeping", "https://ex.test/doc2")])
        r = self.engine({"https://ex.test/feed": [FakeResp(200, feed3)],
                         "https://ex.test/doc2": [FakeResp(200, page, {"Content-Type": "text/html"})]}).run_all()
        self.assertEqual((r["new"], r["withdrawn"]), (1, 1))
        metrics = json.loads((self.tmp / "metrics.json").read_text())
        self.assertEqual(metrics["entries"]["withdrawn"], 1)
        self.assertIn("topic_golden", metrics["quality"])


if __name__ == "__main__":
    unittest.main()
