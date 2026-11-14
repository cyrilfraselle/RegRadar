"""Engine orchestration: one run = poll due sources, detect changes,
extract documents, tag, propose, extract deadlines, check coverage, build
the ranked feed and write metrics.

Files written under docs/data/sources/ (all generated except
registry.json's config fields and topic-tags.json):
  registry.json   runtime block per source (health, last success)
  state.json      HTTP validators (ETag / Last-Modified / sha256), pending docs, run log
  entries.json    every listing entry seen: first/last seen, hash, change history
  docs/<id>.json  extracted documents with sections and locators
  index.json      document index (metadata only)
  proposals.json  proposal stubs for human review (never obligations)
  deadlines.json  dated events with source links and confidence
  coverage.json   recall check against the authorities' own listing pages
  feed.json       ranked story cards (primary first, news clustered beneath)
  metrics.json    this run's numbers
"""
import hashlib
import json
import logging
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import classify, extract
from .dedupe import canonical_url, cluster, normalise_title, same_story_raw
from .fetch import BudgetExceeded, Fetcher, now_iso
from .parsers import PARSERS, cellar_query, parse_date, parse_html_list
from .tagging import Tagger, score

log = logging.getLogger("regwatch_sources")

DATA = Path("docs/data/sources")
DOCS = DATA / "docs"
MAX_ENTRIES_PER_SOURCE = 400
MAX_HISTORY = 6
MAX_PROPOSALS = 300
FEED_DAYS = 120
FEED_MAX_CARDS = 400
NEWS_SHARE_CAP = 0.2
CORPUS_WARN_BYTES = 40_000_000

NORMATIVE = re.compile(r"\b(shall|must|should|are required to|is required to|have to|has to|"
                       r"may not|shall not|doivent|doit|moeten|moet)\b", re.I)
OBLIGATION_TOPICS = {"CDD": {"cdd", "cdd-natural-person", "cdd-legal-entity"},
                     "UBO": {"beneficial-ownership"}, "Transaction Monitoring": {"ongoing-monitoring"},
                     "EDD": {"simplified-edd"}, "PEP": {"pep"}, "STR/SAR": {"reporting-str"}}
ATTACH_PREFER = re.compile(r"consultation paper|final report|draft (rts|its|guidelines|regulatory|implementing)|"
                           r"guidelines|report|circular|communication|decision|opinion|thematic note", re.I)
ATTACH_AVOID = re.compile(r"privacy|record of processing|ropa|respondents|factsheet|template|annex|"
                          r"form|track changes|cookie", re.I)


# ── io helpers ────────────────────────────────────────────────────

def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def dump(path: Path, data, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    txt = json.dumps(data, ensure_ascii=False, separators=(",", ":")) if compact \
        else json.dumps(data, ensure_ascii=False, indent=1)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(txt + "\n", encoding="utf-8")
    tmp.replace(path)


def h(s: str, n=12) -> str:
    return hashlib.sha1((s or "").encode("utf-8")).hexdigest()[:n]


def entry_id(src: dict, e: dict) -> str:
    celex = e.get("extra", {}).get("celex")
    if celex:
        return "celex-" + re.sub(r"[^0-9A-Za-z]+", "", celex)
    return f"{src['id']}-{h(canonical_url(e['url']))}"


def entry_hash(e: dict) -> str:
    core = {"t": e.get("title"), "d": e.get("date"), "s": e.get("summary"),
            "f": {k: v.get("text") for k, v in (e.get("fields") or {}).items()},
            "st": e.get("extra", {}).get("status"), "snap": e.get("extra", {}).get("text_sha")}
    return h(json.dumps(core, sort_keys=True, ensure_ascii=False), 16)


def due(src: dict, today: datetime, force: bool) -> bool:
    if force:
        return True
    last = (src.get("runtime") or {}).get("last_success")
    if not last or src.get("polling", "daily") == "daily":
        return True
    try:
        return today - datetime.fromisoformat(last[:19]) >= timedelta(days=6.5)
    except ValueError:
        return True


def pct(vals, p):
    v = sorted(vals)
    if not v:
        return None
    k = (len(v) - 1) * p / 100
    lo = int(k)
    hi = min(lo + 1, len(v) - 1)
    return round(v[lo] + (v[hi] - v[lo]) * (k - lo), 1)


# ── the run ───────────────────────────────────────────────────────

class Engine:
    def __init__(self, data_dir: Path = DATA, fetcher: Fetcher = None, today: str = None,
                 only=None, max_docs=None, budget=None, docs=True, force=False,
                 coverage=True, legacy_items: Path = Path("docs/data/items.json"),
                 golden_dir: Path = Path("tests/golden")):
        self.dir = Path(data_dir)
        self.docs_dir = self.dir / "docs"
        self.registry = load(self.dir / "registry.json", {"_meta": {}, "sources": []})
        self.state = load(self.dir / "state.json", {"http": {}, "pending_docs": [], "runs": []})
        self.entries = {e["id"]: e for e in load(self.dir / "entries.json", {"entries": []}).get("entries", [])}
        meta = self.registry.get("_meta", {})
        bud = meta.get("budget", {})
        self.fetcher = fetcher or Fetcher(self.state.setdefault("http", {}), meta.get("user_agent") or "RegWatchBot/2.0", budget or bud.get("requests_per_run", 220),
                                          bud.get("default_delay_s", 1.5))
        if fetcher is not None:
            fetcher.cache = self.state.setdefault("http", {})
        self.today = today or date.today().isoformat()
        self.now = now_iso()
        self.only = set(only or [])
        self.max_docs = bud.get("docs_per_run", 24) if max_docs is None else max_docs
        self.do_docs = docs
        self.force = force
        self.do_coverage = coverage
        self.legacy_items = legacy_items
        self.golden_dir = golden_dir
        self.tagger = Tagger(path=self.dir / "topic-tags.json")
        self.run = {"started": self.now, "sources_polled": 0, "sources_skipped": 0,
                    "new": 0, "changed": 0, "withdrawn": 0, "docs_new": 0, "docs_changed": 0,
                    "docs_unchanged": 0, "doc_errors": 0, "proposals_new": 0, "errors": []}
        self.touched_docs = []

    # sources ----------------------------------------------------
    def sources(self, status="working"):
        return [s for s in self.registry["sources"] if s.get("status") == status
                and (not self.only or s["id"] in self.only)]

    def poll(self, src) -> list:
        """Fetch and parse one source. Returns entries, or None when the
        listing is unchanged (HTTP 304)."""
        if src.get("rate_limit_s"):
            from urllib.parse import urlsplit
            for u in [src.get("url")] + src.get("urls", []):
                if u:
                    self.fetcher.set_delay(urlsplit(u).netloc, src["rate_limit_s"])
        if src["parser"] == "cellar_sparql":
            since = (date.fromisoformat(self.today) - timedelta(days=src["params"].get("lookback_days", 30))).isoformat()
            r = self.fetcher.get(src["url"], data={"query": cellar_query(src, since)},
                                 headers={"Accept": "application/sparql-results+json"},
                                 cache_key=src["id"] + ":sparql")
            if not r.ok:
                raise RuntimeError(r.error)
            return PARSERS["cellar_sparql"](src, r)
        if src["parser"] == "page_snapshot":
            out = []
            for u in src.get("urls") or [src["url"]]:
                r = self.fetcher.get(u, conditional=False)
                if not r.ok:
                    raise RuntimeError(f"{u}: {r.error}")
                e = PARSERS["page_snapshot"](src, r)[0]
                ex = extract.extract(r.body, r.content_type, r.final_url)
                text = extract.plain_text(ex)
                e["extra"]["text_sha"] = h(text, 16)
                e["extra"]["_extracted"] = ex
                e["extra"]["_binary"] = {"sha256": r.sha, "bytes": len(r.body)}
                e["summary"] = (ex["sections"][0]["paras"][0]["text"] if ex["sections"] and ex["sections"][0]["paras"] else "")[:300]
                out.append(e)
            return out
        r = self.fetcher.get(src["url"])
        if r.not_modified:
            return None
        if not r.ok:
            raise RuntimeError(r.error)
        return PARSERS[src["parser"]](src, r)

    def process_entries(self, src, parsed):
        seen_ids = set()
        excl = re.compile(src["params"]["exclude_title"], re.I) if src.get("params", {}).get("exclude_title") else None
        counts = {"seen": 0, "new": 0, "changed": 0}
        for e in parsed:
            if excl and excl.search(e["title"]):
                continue
            eid = entry_id(src, e)
            if eid in seen_ids:
                continue
            seen_ids.add(eid)
            counts["seen"] += 1
            extracted = e["extra"].pop("_extracted", None)
            binary = e["extra"].pop("_binary", None)
            hsh = entry_hash(e)
            text_for_tags = " ".join([e["title"], e.get("summary", ""), e.get("category", "")])
            topics = self.tagger.tag(text_for_tags)
            dtype = classify.doc_type(e, src)
            status = classify.doc_status(e, dtype, self.today)
            in_scope = src.get("scope", "all") == "all" or bool(topics)
            old = self.entries.get(eid)
            change = "new" if old is None else ("changed" if old.get("hash") != hsh else "unchanged")
            if old is not None and old.get("change") == "withdrawn" and change == "unchanged":
                change = "changed"      # it came back
            rec = {
                "id": eid, "source": src["id"], "authority": src["authority"], "jurisdiction": src.get("jurisdiction", ""),
                "url": e["url"], "title": e["title"], "date": e.get("date", ""), "summary": e.get("summary", ""),
                "category": e.get("category", ""), "fields": e.get("fields", {}), "extra": e.get("extra", {}),
                "type": dtype, "status": status, "topics": topics, "in_scope": in_scope,
                "first_seen": old.get("first_seen") if old else self.now, "last_seen": self.now,
                "hash": hsh, "change": change, "doc_id": (old or {}).get("doc_id", ""),
                "history": (old or {}).get("history", []),
            }
            if change in ("new", "changed"):
                rec["history"] = (rec["history"] + [{"at": self.now, "change": change, "hash": hsh}])[-MAX_HISTORY:]
                counts[change] += 1
                if in_scope:
                    if extracted is not None:
                        self.store_doc(src, rec, extracted, binary, rec["url"])
                    elif self.do_docs and src.get("max_docs", 3) > 0:
                        if eid not in self.state["pending_docs"]:
                            self.state["pending_docs"].append(eid)
            elif extracted is not None and in_scope and not rec["doc_id"]:
                self.store_doc(src, rec, extracted, binary, rec["url"])
            self.entries[eid] = rec
        # withdrawn: only meaningful when the listing is complete
        if src.get("complete_listing") and parsed is not None:
            for eid, rec in self.entries.items():
                if rec["source"] == src["id"] and eid not in seen_ids and rec.get("change") != "withdrawn":
                    rec["change"] = "withdrawn"
                    rec["history"] = (rec.get("history", []) + [{"at": self.now, "change": "withdrawn"}])[-MAX_HISTORY:]
                    self.run["withdrawn"] += 1
        self.run["new"] += counts["new"]
        self.run["changed"] += counts["changed"]
        return counts

    # documents --------------------------------------------------
    def fetch_doc(self, src, rec):
        url = rec["extra"].get("fetch_url") or rec["url"]
        headers = {}
        if rec["extra"].get("fetch_url"):
            headers = {"Accept": "application/xhtml+xml, text/html;q=0.9", "Accept-Language": "eng"}
        r = self.fetcher.get(url, conditional=bool(rec.get("doc_id")), headers=headers)
        if r.not_modified:
            self.run["docs_unchanged"] += 1
            return
        if not r.ok:
            if rec["extra"].get("corrigendum") and r.status == 404:
                # Corrigenda often concern only some language versions;
                # CELLAR then has no English text. Not an error.
                rec["doc_note"] = "no English text in CELLAR (the corrigendum may concern other language versions)"
                return
            raise RuntimeError(r.error)
        ex = extract.extract(r.body, r.content_type, r.final_url)
        doc = self.store_doc(src, rec, ex, {"sha256": r.sha, "bytes": len(r.body)}, r.final_url)
        if ex["format"] == "html" and (src.get("extract_attachments") or ex["chars_stored"] < 1500):
            links = [(u, l) for u, l in extract.pdf_links(r.text, r.final_url) if not ATTACH_AVOID.search(l + " " + u)]
            links.sort(key=lambda ul: 0 if ATTACH_PREFER.search(ul[1] + " " + ul[0]) else 1)
            for u, label in links[:1]:
                ra = self.fetcher.get(u, conditional=False)
                if not ra.ok:
                    self.run["errors"].append(f"{rec['id']} attachment {u}: {ra.error}")
                    continue
                exa = extract.extract(ra.body, ra.content_type, ra.final_url)
                arec = dict(rec, id="att-" + h(canonical_url(u)), url=u, title=exa.get("title") or label or rec["title"],
                            doc_id="")
                adoc = self.store_doc(src, arec, exa, {"sha256": ra.sha, "bytes": len(ra.body)}, ra.final_url,
                                      parent=doc["id"])
                doc.setdefault("attachments", []).append({"doc_id": adoc["id"], "url": u, "label": label})
                dump(self.docs_dir / f"{doc['id']}.json", doc, compact=True)

    def store_doc(self, src, rec, ex, binary, fetched_url, parent=None):
        doc_id = rec["id"]
        path = self.docs_dir / f"{doc_id}.json"
        old = load(path, None)
        tags = self.tagger.tag_document(rec["title"], ex["sections"])
        text = extract.plain_text(ex)
        version = hashlib.sha256(text.encode("utf-8")).hexdigest()
        pub = rec.get("date") or (rec.get("fields", {}).get("OJ publication") or {}).get("date", "")
        doc = {
            "id": doc_id, "source": src["id"], "authority": src["authority"], "jurisdiction": src.get("jurisdiction", ""),
            "title": rec["title"] or ex.get("title", ""), "url": rec["url"], "fetched_url": fetched_url,
            "publication_date": pub, "type": rec["type"], "status": rec["status"],
            "language": extract.detect_language(text), "version_hash": version,
            "retrieved": self.now, "format": ex["format"], "pages_total": ex.get("pages_total"),
            "chars_total": ex["chars_total"], "chars_stored": ex["chars_stored"], "truncated": ex["truncated"],
            "outline_of_rest": ex["outline_of_rest"], "binary_sha256": (binary or {}).get("sha256", ""),
            "binary_bytes": (binary or {}).get("bytes", 0), "topics": tags["topics"],
            "topic_counts": tags["topic_counts"], "deadlines": classify.text_deadlines(ex["sections"]),
            "parent": parent, "attachments": (old or {}).get("attachments", []) if old and old.get("version_hash") == version else [],
            "versions": ((old or {}).get("versions", []) + ([{"hash": old["version_hash"], "retrieved": old["retrieved"]}] if old and old.get("version_hash") != version else []))[-MAX_HISTORY:],
            "sections": ex["sections"],
            "note": "Extracted text for citation. Locators: 'p. N, para M' (PDF) or '<heading>, para M' (HTML). Check the original at `url`.",
        }
        if rec["extra"].get("celex"):
            doc["celex"] = rec["extra"]["celex"]
            doc["eli"] = rec["extra"].get("eli", "")
        change = "new" if old is None else ("changed" if old.get("version_hash") != version else "unchanged")
        if change == "unchanged":
            doc["retrieved_first"] = old.get("retrieved_first", old.get("retrieved"))
            self.run["docs_unchanged"] += 1
        else:
            doc["retrieved_first"] = (old or {}).get("retrieved_first", self.now)
            self.run["docs_" + change] += 1
            self.touched_docs.append((doc, old, change, rec.get("in_scope", True)))
        dump(path, doc, compact=True)
        if parent is None:
            rec["doc_id"] = doc_id
        return doc

    def process_docs(self):
        if not self.do_docs:
            return
        prio = {"legislation": 0, "rts_its_draft": 1, "consultation": 2, "guideline": 3,
                "enforcement": 4, "faq": 5, "supervisory_communication": 6}
        pending = [self.entries[i] for i in self.state.get("pending_docs", []) if i in self.entries]
        pending.sort(key=lambda r: (prio.get(r["type"], 9), -(int(re.sub(r"\D", "", r.get("date") or "0")[:8] or 0))))
        per_source, done, left = {}, 0, []
        srcs = {s["id"]: s for s in self.registry["sources"]}
        for rec in pending:
            src = srcs.get(rec["source"])
            if not src:
                continue
            if done >= self.max_docs or per_source.get(src["id"], 0) >= src.get("max_docs", 3):
                left.append(rec["id"])
                continue
            try:
                self.fetch_doc(src, rec)
                done += 1
                per_source[src["id"]] = per_source.get(src["id"], 0) + 1
            except BudgetExceeded:
                left.append(rec["id"])
                self.run["errors"].append("request budget reached during document extraction")
                left += [r["id"] for r in pending[pending.index(rec) + 1:]]
                break
            except Exception as e:
                self.run["doc_errors"] += 1
                self.run["errors"].append(f"doc {rec['id']}: {str(e)[:200]}")
                rec["doc_error"] = str(e)[:200]
        self.state["pending_docs"] = list(dict.fromkeys(left))

    # proposals --------------------------------------------------
    def proposals(self):
        path = self.dir / "proposals.json"
        data = load(path, {"_meta": {}, "proposals": []})
        props = {p["id"]: p for p in data.get("proposals", [])}
        obligations = load(Path("docs/data/obligations.json"), {}).get("obligations", [])
        for doc, old, change, in_scope in self.touched_docs:
            if not in_scope or not doc["topics"]:
                continue
            pid = f"prop-{doc['id']}-{doc['version_hash'][:8]}"
            if pid in props:
                continue
            paras = [(s, p) for s in doc["sections"] for p in s["paras"]]
            what = {"summary": "new document"}
            candidates = paras
            if change == "changed" and old:
                old_set = {p["text"] for s in old.get("sections", []) for p in s.get("paras", [])}
                new_set = {p["text"] for _s, p in paras}
                added = [(s, p) for s, p in paras if p["text"] not in old_set]
                removed = [t for t in old_set if t not in new_set]
                what = {"summary": f"{len(added)} paragraphs added, {len(removed)} removed",
                        "removed_samples": [t[:300] for t in removed[:3]]}
                candidates = added
            quotes = []
            for s, p in candidates:
                tp = p.get("topics") or []
                if tp and NORMATIVE.search(p["text"]):
                    quotes.append({"text": p["text"][:1200], "loc": p["loc"], "topics": tp,
                                   "why": "normative wording (" + NORMATIVE.search(p["text"]).group(0) + ") on " + ", ".join(tp)})
            quotes.sort(key=lambda q: -len(q["topics"]))
            text = extract.plain_text(doc)
            cited = set()
            basis = " ".join(str(v) for v in [doc["title"]] + [x.get("text", "") for x in (self.entries.get(doc["id"], {}).get("fields") or {}).values()])
            for m in re.finditer(r"AMLR\s+(?:Art(?:icle)?\.?\s*)?(\d+)", basis + " " + text[:60000]):
                cited.add(m.group(1))
            for m in re.finditer(r"Article\s+(\d+)(?:\(\d+\))?\s+(?:of\s+)?(?:the\s+)?(?:AMLR|Regulation \(EU\) 2024/1624)", text[:200000]):
                cited.add(m.group(1))
            touch = []
            for o in obligations:
                art = re.search(r"Art\.?\s*(\d+)", o.get("legal_basis", ""))
                why = []
                if art and art.group(1) in cited:
                    why.append(f"cites AMLR Art. {art.group(1)}")
                if OBLIGATION_TOPICS.get(o.get("topic"), set()) & set(doc["topics"]):
                    why.append(f"topic {o.get('topic')}")
                if why:
                    touch.append({"obligation_id": o["id"], "why": why})
            touch.sort(key=lambda t: (not any(w.startswith("cites") for w in t["why"]), t["obligation_id"]))
            props[pid] = {
                "id": pid, "created": self.now, "doc_id": doc["id"], "source": doc["source"],
                "authority": doc["authority"], "title": doc["title"], "url": doc["url"],
                "type": doc["type"], "status": doc["status"], "change": change, "what_changed": what,
                "topics": doc["topics"], "may_touch": {"obligations": touch[:12], "topics": doc["topics"]},
                "quotes": quotes[:6], "review_status": "needs-review",
            }
            self.run["proposals_new"] += 1
        keep = sorted(props.values(), key=lambda p: p["created"], reverse=True)[:MAX_PROPOSALS]
        dump(path, {"_meta": {
            "purpose": "Proposal stubs: inputs for human and fact-checker review of possible new or changed obligations. NOT obligations, never auto-published.",
            "method": "One stub per new or changed in-scope document version. Quotes are verbatim paragraphs (with locators) that carry normative wording and a topic tag; for a changed document only added paragraphs are quoted. 'may_touch' lists register obligations whose article the document cites or whose topic it shares.",
            "generated": self.now, "count": len(keep)}, "proposals": keep})

    # deadlines --------------------------------------------------
    def deadlines(self):
        out = {}

        def add(date_, kind, title, url, doc_id, confidence, method, quote="", loc="", source=""):
            if not date_ or not re.match(r"\d{4}-\d{2}-\d{2}$", date_):
                return
            did = h(f"{kind}|{date_}|{doc_id or url}|{title[:80]}")
            out[did] = {"id": did, "date": date_, "kind": kind, "title": title[:300], "source_doc_id": doc_id,
                        "source": source, "url": url, "confidence": confidence, "method": method,
                        **({"quote": quote} if quote else {}), **({"loc": loc} if loc else {})}

        app = load(Path("docs/data/applicability.json"), {})
        for r in app.get("regulations", []):
            if r.get("applies_from"):
                add(r["applies_from"], "application date", f"{r.get('name')} ({r.get('full_name', '')}) applies",
                    f"law.html?celex={r.get('celex')}", "", "high", "structured: docs/data/applicability.json applies_from",
                    source="applicability.json")
        for o in load(Path("docs/data/obligations.json"), {}).get("obligations", []):
            if o.get("deadline"):
                add(o["deadline"], "application date", f"{o['id']}: {o.get('legal_basis', '')} applies",
                    o.get("source_url", ""), "", "high", "structured: docs/data/obligations.json deadline",
                    source="obligations.json")
        for p in sorted(Path("docs/data/laws").glob("*_EN.json")):
            law = load(p, {})
            eif = (law.get("dates") or {}).get("entry_into_force", "")
            if eif:
                add(eif, "entry into force", f"{law.get('name', p.stem)} enters into force",
                    law.get("url", ""), "", "high", f"structured: {p.as_posix()} dates.entry_into_force",
                    source="laws")
        for e in self.entries.values():
            if e.get("change") == "withdrawn":
                continue
            dl = classify.consultation_deadline(e)
            if dl and e["type"] == "consultation":
                add(dl, "consultation closes", e["title"], e["url"], e.get("doc_id", ""), "high",
                    f"structured: '{[k for k in e['fields'] if k.lower().startswith(('deadline', 'closing'))][0]}' field on {e['source']}",
                    source=e["source"])
            f = e.get("fields") or {}
            if e["source"].startswith("eurlex") and e.get("in_scope"):
                eif = (f.get("Entry into force") or {}).get("date", "")
                add(eif, "entry into force", e["title"], e["url"], e.get("doc_id", ""), "high",
                    "structured: CELLAR resource_legal_date_entry-into-force", source=e["source"])
                dl = (f.get("Deadline (CELLAR)") or {}).get("date", "")
                if dl and e.get("extra", {}).get("resource_type", "").startswith("DIR") and not dl.startswith("9999"):
                    add(dl, "transposition deadline", e["title"], e["url"], e.get("doc_id", ""), "medium",
                        "structured: CELLAR resource_legal_date_deadline on a directive", source=e["source"])
        for p in self.docs_dir.glob("*.json"):
            d = load(p, {})
            for dl in d.get("deadlines", []):
                add(dl["date"], dl["kind"], d.get("title", ""), d.get("url", ""), d.get("id", ""), "medium",
                    "text pattern (regwatch_sources/classify.py TEXT_PATTERNS)", dl.get("quote", ""), dl.get("loc", ""),
                    source=d.get("source", ""))
        items = sorted(out.values(), key=lambda x: (x["date"], x["kind"]))
        dump(self.dir / "deadlines.json", {"_meta": {
            "purpose": "Dated events for a compliance calendar, each with a source link. Never guessed: 'high' = a structured field, 'medium' = a stated text pattern with the quoted sentence.",
            "kinds": ["consultation closes", "application date", "transposition deadline", "reporting deadline", "entry into force"],
            "generated": self.now, "count": len(items)}, "deadlines": items})
        return len(items)

    # coverage ---------------------------------------------------
    def coverage(self):
        """Recall against each authority's own human-facing listing page."""
        checks = []
        srcs = {s["id"]: s for s in self.registry["sources"]}
        pairs = [(s, s["coverage"]) for s in self.sources() if s.get("coverage")]
        if "amla-consultations" in srcs and (not self.only or "amla-consultations" in self.only):
            pairs.append((srcs["amla-consultations"], {"from_source": "amla-consultations-list"}))
        for src, cov in pairs:
            try:
                if cov.get("from_source"):
                    ref = [e for e in self.entries.values() if e["source"] == cov["from_source"]]
                    listing = [{"url": e["url"], "title": e["title"], "date": e.get("date", "")} for e in ref]
                    ref_name = cov["from_source"]
                else:
                    r = self.fetcher.get(cov["url"], conditional=False)
                    if not r.ok:
                        raise RuntimeError(r.error)
                    listing = parse_html_list({"params": cov["params"]}, r.body, r.final_url)
                    ref_name = cov["url"]
            except BudgetExceeded:
                break
            except Exception as e:
                checks.append({"source": src["id"], "reference": cov.get("url", cov.get("from_source")), "error": str(e)[:200]})
                continue
            ours = [e for e in self.entries.values() if e["authority"] == src["authority"] and e["source"] != cov.get("from_source")]
            checks.append(coverage_check(src["id"], ref_name, listing, ours))
        prev = load(self.dir / "coverage.json", {"checks": []}).get("checks", [])
        done = {c["source"] for c in checks}
        checks += [c for c in prev if c["source"] not in done]
        dump(self.dir / "coverage.json", {"_meta": {
            "purpose": "Recall check: items on the authority's own listing page compared with what the engine ingested from that authority (any source), over the period both cover.",
            "method": "Listing items dated before our oldest entry for the authority are out of period and not counted. A listing item is matched when an ingested entry has the same canonical URL, the same normalised title, or passes the story-similarity rule of regwatch_sources/dedupe.py.",
            "rerun": "python collect_sources.py --only <source ids> --coverage-only",
            "generated": self.now}, "checks": sorted(checks, key=lambda c: c["source"])})
        return checks

    # feed -------------------------------------------------------
    def feed(self):
        items = []
        for e in self.entries.values():
            if e.get("change") == "withdrawn" or not e.get("in_scope"):
                continue
            items.append({"id": e["id"], "title": e["title"], "url": e["url"], "date": (e.get("date") or e["first_seen"])[:10],
                          "authority": e["authority"], "source": e["source"], "type": e["type"], "status": e["status"],
                          "topics": e["topics"], "in_scope": True, "is_news": False, "doc_id": e.get("doc_id", ""),
                          "origin": "engine"})
        legacy = load(self.legacy_items, [])
        for it in legacy:
            news = it.get("source_id", "").startswith("gnews_") or it.get("doc_type", "").startswith("news")
            topics = self.tagger.tag(it.get("title", "") + " " + (it.get("summary", "") or "")[:400])
            items.append({"id": "legacy-" + it.get("id", ""), "title": it.get("title", ""), "url": it.get("url", ""),
                          "date": (it.get("date") or "")[:10], "authority": it.get("source", ""), "source": it.get("source_id", ""),
                          "type": legacy_type(it), "status": it.get("legal_status", ""), "topics": topics,
                          "in_scope": bool(topics), "is_news": news, "legacy_impact": it.get("impact"),
                          "origin": "legacy items.json"})
        cutoff = (date.fromisoformat(self.today) - timedelta(days=FEED_DAYS)).isoformat()
        items = [i for i in items if i["date"] >= cutoff]
        for i in items:
            i["rank"] = classify.rank(i, self.today)
            i["tier"] = classify.tier(i)
        groups = cluster(items)
        cards = []
        for g in groups:
            members = sorted((items[k] for k in g), key=lambda i: (-i["rank"], i["is_news"]))
            lead = members[0]
            cards.append({"lead": lead, "also": [{"title": m["title"], "url": m["url"], "authority": m["authority"],
                                                    "date": m["date"], "is_news": m["is_news"]} for m in members[1:]],
                          "size": len(members), "rank": lead["rank"], "tier": lead["tier"],
                          "news_only": all(m["is_news"] for m in members)})
        cards.sort(key=lambda c: -c["rank"])
        primary = [c for c in cards if not c["news_only"]]
        news = [c for c in cards if c["news_only"]]
        cap = int(NEWS_SHARE_CAP / (1 - NEWS_SHARE_CAP) * len(primary))
        dropped = max(0, len(news) - cap)
        cards = sorted(primary + news[:cap], key=lambda c: -c["rank"])[:FEED_MAX_CARDS]
        tiers = {}
        for c in cards:
            tiers[c["tier"]] = tiers.get(c["tier"], 0) + 1
        dump(self.dir / "feed.json", {"_meta": {
            "purpose": "Ranked story cards: one card per story, the primary source first, other outlets beneath. Built from engine entries and the legacy RegWatch archive (docs/data/items.json, read only).",
            "ranking": "regwatch_sources/classify.py rank(): band (2 in-scope primary, 1 other primary, 0 news) x 100 + score; score = type weight (legislation 85 ... supervisory communication 30; news 15), +5 open/final/in force, +2 per topic (max 10), -1 per week of age (max 20). Primary always outranks news.",
            "tiers": "critical = in-scope legislation, standards, guidelines, enforcement or an open consultation from a primary source; important = other in-scope primary; info = the rest and all news.",
            "news_cap": f"news-only cards are at most {int(NEWS_SHARE_CAP * 100)}% of the feed; {dropped} lower-ranked news cards dropped this run",
            "window_days": FEED_DAYS, "generated": self.now, "cards": len(cards), "tiers": tiers}, "cards": cards})
        return {"cards": len(cards), "tiers": tiers, "news_cards": min(len(news), cap), "news_dropped": dropped,
                "clustered_items": sum(c["size"] for c in cards)}

    # main -------------------------------------------------------
    def run_all(self, coverage_only=False):
        t0 = time.monotonic()
        today_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        for src in self.sources():
            if coverage_only:
                break
            rt = src.setdefault("runtime", {})
            if not due(src, today_dt, self.force):
                rt["last_status"] = "skipped (not due)"
                self.run["sources_skipped"] += 1
                continue
            rt["last_run"] = self.now
            before = dict(self.fetcher.stats)
            try:
                parsed = self.poll(src)
                if parsed is None:
                    rt.update(last_status="not modified", last_success=self.now, consecutive_failures=0, last_error="")
                else:
                    c = self.process_entries(src, parsed)
                    rt.update(last_status="ok" if c["seen"] else "empty", last_success=self.now,
                              consecutive_failures=0, last_error="", entries_seen=c["seen"],
                              entries_new=c["new"], entries_changed=c["changed"])
                self.run["sources_polled"] += 1
            except BudgetExceeded as e:
                rt.update(last_status="skipped (budget)", last_error=str(e))
                self.run["errors"].append(f"{src['id']}: {e}")
                break
            except Exception as e:
                rt["consecutive_failures"] = rt.get("consecutive_failures", 0) + 1
                rt.update(last_status="error", last_error=str(e)[:300])
                self.run["errors"].append(f"{src['id']}: {str(e)[:200]}")
            rt["requests"] = self.fetcher.stats["requests"] - before["requests"]
            rt["health"] = health(src)
        if not coverage_only:
            self.process_docs()
            self.proposals()
        n_deadlines = self.deadlines()
        cov = self.coverage() if self.do_coverage else []
        feed = self.feed()
        self.run["duration_s"] = round(time.monotonic() - t0, 1)
        self.write(n_deadlines, cov, feed)
        return self.run

    def write(self, n_deadlines, cov, feed):
        by_src = {}
        for e in self.entries.values():
            by_src.setdefault(e["source"], []).append(e)
        kept = []
        for sid, lst in by_src.items():
            lst.sort(key=lambda e: (e.get("date") or e["first_seen"]), reverse=True)
            kept += lst[:MAX_ENTRIES_PER_SOURCE]
        kept.sort(key=lambda e: (e.get("date") or e["first_seen"]), reverse=True)
        dump(self.dir / "entries.json", {"_meta": {"purpose": "Every listing entry the engine has seen, with change history (new, changed, withdrawn). Generated.",
                                                   "generated": self.now, "count": len(kept)}, "entries": kept})
        idx = []
        size = 0
        for p in sorted(self.docs_dir.glob("*.json")):
            size += p.stat().st_size
            d = load(p, {})
            idx.append({k: d.get(k) for k in ("id", "source", "authority", "title", "url", "publication_date", "type",
                                              "status", "language", "version_hash", "retrieved", "format", "pages_total",
                                              "chars_stored", "truncated", "topics", "parent")})
            idx[-1]["paragraphs"] = sum(len(s.get("paras", [])) for s in d.get("sections", []))
        dump(self.dir / "index.json", {"_meta": {"purpose": "Index of extracted documents in docs/data/sources/docs/. Generated.",
                                                 "generated": self.now, "count": len(idx), "corpus_bytes": size}, "documents": idx})
        self.state["runs"] = (self.state.get("runs", []) + [{k: v for k, v in self.run.items() if k != "errors"} |
                                                            {"errors": len(self.run["errors"]), "requests": self.fetcher.stats["requests"]}])[-30:]
        dump(self.dir / "state.json", self.state)
        dump(self.dir / "registry.json", self.registry)
        self.metrics(idx, size, n_deadlines, cov, feed)

    def metrics(self, idx, corpus_bytes, n_deadlines, cov, feed):
        srcs = self.registry["sources"]
        working = [s for s in srcs if s.get("status") == "working"]
        first_run = (self.state.get("runs") or [{}])[0].get("started")
        cutoff = datetime.fromisoformat(self.now[:19]) - timedelta(days=30)
        lag_run, lag_30 = [], []
        for e in self.entries.values():
            if not e.get("date") or e["extra"].get("snapshot") or e["source"] == "amla-instruments":
                continue
            try:
                fs = datetime.fromisoformat(e["first_seen"][:19])
                lag = (fs - datetime.fromisoformat(e["date"][:10])).total_seconds() / 3600
            except ValueError:
                continue
            if e["first_seen"] == self.now and self.now != first_run:
                lag_run.append(lag)
            if fs >= cutoff and e["first_seen"] != first_run:
                lag_30.append(lag)
        golden = {}
        for name in ("topic_golden", "topic_heldout"):
            g = load(self.golden_dir / f"{name}.json", None)
            if g:
                r = score(self.tagger, g["cases"])
                golden[name] = {k: r[k] for k in ("cases", "precision", "recall")}
        dup = load(self.golden_dir / "duplicate_pairs.json", None)
        if dup:
            tp = fp = fn = 0
            for p in dup["pairs"]:
                pr = same_story_raw(p["a"]["title"], p["b"]["title"])
                tp += pr and p["same_story"]
                fp += pr and not p["same_story"]
                fn += (not pr) and p["same_story"]
            golden["duplicate_pairs"] = {"pairs": len(dup["pairs"]), "precision": round(tp / (tp + fp), 3) if tp + fp else 1.0,
                                         "recall": round(tp / (tp + fn), 3) if tp + fn else 1.0}
        health_counts = {}
        for s in working:
            hl = (s.get("runtime") or {}).get("health", "unknown")
            health_counts[hl] = health_counts.get(hl, 0) + 1
        st = self.fetcher.stats
        m = {
            "_meta": {"purpose": "Numbers for this run of the RegWatch engine v2. Generated; see strategy/scraper-audit.md for definitions.",
                      "generated": self.now},
            "run": {"duration_s": self.run["duration_s"], "requests": st["requests"], "bytes": st["bytes"],
                    "not_modified_304": st["not_modified"], "retries": st["retries"], "http_errors": st["errors"],
                    "robots_blocked": st["robots_blocked"], "politeness_wait_s": round(st["slept_s"], 1),
                    "budget": self.fetcher.budget, "errors": self.run["errors"][:40]},
            "sources": {"registered": len(srcs), "working": len(working),
                        "planned": sum(s.get("status") == "planned" for s in srcs),
                        "blocked": sum(s.get("status") == "blocked" for s in srcs),
                        "excluded": sum(s.get("status") == "excluded" for s in srcs),
                        "polled_this_run": self.run["sources_polled"], "skipped_not_due": self.run["sources_skipped"],
                        "health": health_counts},
            "entries": {"total": len(self.entries), "in_scope": sum(1 for e in self.entries.values() if e.get("in_scope")),
                        "new": self.run["new"], "changed": self.run["changed"], "withdrawn": self.run["withdrawn"],
                        "pending_docs": len(self.state.get("pending_docs", []))},
            "documents": {"total": len(idx), "new": self.run["docs_new"], "changed": self.run["docs_changed"],
                          "unchanged": self.run["docs_unchanged"], "errors": self.run["doc_errors"],
                          "paragraphs": sum(d.get("paragraphs", 0) for d in idx), "corpus_bytes": corpus_bytes,
                          "corpus_warning": corpus_bytes > CORPUS_WARN_BYTES},
            "freshness_hours": {
                "this_run": {"n": len(lag_run), "p50": pct(lag_run, 50), "p90": pct(lag_run, 90)},
                "last_30_days": {"n": len(lag_30), "p50": pct(lag_30, 50), "p90": pct(lag_30, 90)},
                "definition": "first_seen (engine) minus the publication date the source states (date only, so up to 24 h of the figure is the date's own precision). Entries found on the engine's first run are excluded from last_30_days because they are backfill."},
            "proposals_new": self.run["proposals_new"], "deadlines": n_deadlines,
            "coverage": [{k: c.get(k) for k in ("source", "recall", "in_period", "matched", "error")} for c in cov],
            "feed": feed,
            "quality": golden,
            "false_alert_rate": "not measured (needs reviewer verdicts on proposals; proposals.json review_status will provide them)",
        }
        dump(self.dir / "metrics.json", m)


def legacy_type(it: dict) -> str:
    d = it.get("doc_type", "")
    return {"regulation": "legislation", "directive": "legislation", "national_law": "legislation",
            "rts_its": "rts_its_draft", "circular": "guideline", "guideline": "guideline", "qa": "faq",
            "consultation": "consultation", "proposal": "consultation", "enforcement": "enforcement"}.get(d, "supervisory_communication")


def health(src: dict) -> str:
    rt = src.get("runtime") or {}
    if rt.get("consecutive_failures", 0) >= 3:
        return "failing"
    if rt.get("last_status") == "error":
        return "degraded"
    if rt.get("last_status") in ("ok", "not modified", "empty"):
        return "healthy"
    return rt.get("health", "unknown")


def coverage_check(source_id, reference, listing, ours) -> dict:
    dated = [e.get("date") for e in ours if e.get("date")]
    oldest = min(dated) if dated else ""
    our_urls = {canonical_url(e["url"]) for e in ours}
    our_titles = {normalise_title(e["title"]) for e in ours}
    in_period, matched, missed = 0, 0, []
    for it in listing:
        d = it.get("date") or ""
        if oldest and d and d < oldest:
            continue
        in_period += 1
        if canonical_url(it["url"]) in our_urls or normalise_title(it["title"]) in our_titles or \
                any(same_story_raw(it["title"], e["title"]) for e in ours):
            matched += 1
        else:
            missed.append({"title": it["title"], "url": it["url"], "date": d})
    return {"source": source_id, "reference": reference, "checked": now_iso(), "period_from": oldest,
            "listing_items": len(listing), "in_period": in_period, "matched": matched,
            "recall": round(matched / in_period, 3) if in_period else None, "missed": missed[:50]}
