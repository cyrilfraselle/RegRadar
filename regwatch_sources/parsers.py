"""Listing parsers. Each takes (source config, Response or body) and
returns a list of entries:

    {"url", "title", "date" (ISO date or "" when the source gives none),
     "summary", "category", "fields": {label: value}, "extra": {...}}

Parsers never invent a date: an entry without one keeps "" and the
engine records its first-seen time separately.
"""
import json
import re
from datetime import datetime
from urllib.parse import urljoin

import feedparser
from bs4 import BeautifulSoup

from .extract import clean

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}
MONTHS.update({m[:3]: i for m, i in list(MONTHS.items())})
MONTHS.update({"janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5,
               "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9,
               "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12})


def parse_date(text: str) -> str:
    """ISO date (YYYY-MM-DD) from common formats, or ''."""
    t = clean(text or "").lower()
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b", t)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zéû]+)\.?,?\s+(\d{4})\b", t)
    if m and m.group(2) in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"\b([a-z]+)\s+(\d{1,2}),\s+(\d{4})\b", t)
    if m and m.group(1) in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}"
    return ""


def _entry(url, title, date="", summary="", category="", fields=None, extra=None):
    return {"url": url, "title": clean(title)[:500], "date": date, "summary": clean(summary)[:600],
            "category": clean(category)[:120], "fields": fields or {}, "extra": extra or {}}


# ── RSS / Atom ────────────────────────────────────────────────────

def parse_rss(src: dict, body: bytes) -> list:
    feed = feedparser.parse(body)
    if src.get("params", {}).get("digest"):
        return _rss_digest(src, feed)
    out = []
    for e in feed.entries:
        title, link = e.get("title", "").strip(), e.get("link", "")
        if not (title and link):
            continue
        date = ""
        for k in ("published_parsed", "updated_parsed"):
            if getattr(e, k, None):
                date = datetime(*getattr(e, k)[:6]).date().isoformat()
                break
        summary = BeautifulSoup(e.get("summary", "") or "", "html.parser").get_text(" ", strip=True)
        cats = [t.get("term", "") for t in e.get("tags", [])] if e.get("tags") else []
        out.append(_entry(link, title, date, summary, ", ".join(c for c in cats if c)))
    return out


def _rss_digest(src, feed) -> list:
    """EBA's feed: each entry is a daily e-mail alert bundling links under
    section headings. Split into one entry per link (heading = category)."""
    out, seen = [], set()
    for e in feed.entries:
        date = datetime(*e.published_parsed[:6]).date().isoformat() if getattr(e, "published_parsed", None) else ""
        soup = BeautifulSoup(e.get("summary", "") or "", "html.parser")
        for field in soup.select("div.field"):
            label = field.select_one(".field__label")
            section = label.get_text(strip=True) if label else ""
            for a in field.select("a[href]"):
                link, title = a["href"], a.get_text(" ", strip=True).lstrip("​")
                if title and link not in seen:
                    seen.add(link)
                    out.append(_entry(link, title, date, "", section))
    return out


# ── HTML listings (CSS-configured) ────────────────────────────────

def parse_html_list(src: dict, body: bytes, base_url: str) -> list:
    p = src["params"]
    soup = BeautifulSoup(body, "html.parser")
    root = soup.select_one(p.get("root", "main")) or soup
    out = []
    for item in root.select(p["item"])[: p.get("max_items", 60)]:
        t_el = item.select_one(p["title"]) if p.get("title") else None
        a_el = item.select_one(p.get("link", "a[href]"))
        if t_el is None:
            t_el = a_el
        if t_el is None or a_el is None or not a_el.get("href"):
            continue
        date = ""
        if p.get("date"):
            d_el = item.select_one(p["date"])
            if d_el is not None:
                date = parse_date(d_el.get("datetime", "") or d_el.get_text(" "))
        fields = {}
        for dt in item.select("dt"):
            dd = dt.find_next_sibling("dd")
            if dd is not None:
                tm = dd.find("time")
                val = clean(dd.get_text(" "))
                fields[clean(dt.get_text(" "))] = {"text": val, "date": parse_date(tm.get("datetime", "") if tm else val)}
        summary = ""
        if p.get("summary"):
            s_el = item.select_one(p["summary"])
            summary = s_el.get_text(" ") if s_el else ""
        category = ""
        if p.get("category"):
            c_el = item.select_one(p["category"])
            category = c_el.get_text(" ") if c_el else ""
        out.append(_entry(urljoin(base_url, a_el["href"]), t_el.get_text(" "), date, summary,
                          category, fields))
    return out


def parse_html_links(src: dict, body: bytes, base_url: str) -> list:
    """Links inside the main content whose href matches `href_pattern` (and
    optionally whose text matches `text_pattern`). Date: first date found
    in the link's closest block."""
    p = src["params"]
    soup = BeautifulSoup(body, "html.parser")
    root = soup.select_one(p.get("root", "main")) or soup
    href_re = re.compile(p.get("href_pattern", "."), re.I)
    text_re = re.compile(p.get("text_pattern", "."), re.I)
    out, seen = [], set()
    for a in root.select("a[href]"):
        href, text = a["href"], clean(a.get_text(" "))
        if len(text) < p.get("min_title", 25) or not href_re.search(href) or not text_re.search(text):
            continue
        url = urljoin(base_url, href)
        if url in seen:
            continue
        seen.add(url)
        block = a.find_parent(["li", "article", "div", "tr"]) or a
        out.append(_entry(url, text, parse_date(block.get_text(" ")), "", p.get("category", "")))
    return out


# ── AMLA regulatory instruments tracker ───────────────────────────

def parse_amla_instruments(src: dict, body: bytes, base_url: str) -> list:
    """Rows of the 'Instruments under consultation / consultations closed'
    table: type, legal basis, mandate, status, document links. The entry
    hash includes the status, so 'Consultation closed' -> 'Final report
    published' is detected as a change."""
    soup = BeautifulSoup(body, "html.parser")
    out = []
    for table in soup.select("main table") or soup.select("table"):
        head = [clean(th.get_text(" ")).lower() for th in table.select("tr")[0].select("th,td")] if table.select("tr") else []
        if "status" not in head:
            continue
        for tr in table.select("tr")[1:]:
            cells = [clean(td.get_text(" ")) for td in tr.select("td")]
            if len(cells) < 4:
                continue
            links = [(urljoin(base_url, a["href"]), clean(a.get_text(" "))) for a in tr.select("a[href]")]
            kind, basis, mandate, status = cells[0], cells[1], cells[2], " ".join(cells[3:])
            main = next((u for u, t in links if "final report" in t.lower()), "") or \
                (links[0][0] if links else base_url + "#" + re.sub(r"[^a-z0-9]+", "-", mandate.lower())[:80])
            out.append(_entry(main, mandate, "", f"{kind} under {basis}. Status: {status}", kind,
                              {"Type": {"text": kind}, "Legal basis": {"text": basis},
                               "Status": {"text": status}},
                              {"links": [{"url": u, "label": t} for u, t in links],
                               "legal_basis": basis, "status": status}))
    return out


# ── Page snapshot (the page itself is the entry) ──────────────────

def parse_page_snapshot(src: dict, body: bytes, base_url: str) -> list:
    soup = BeautifulSoup(body, "html.parser")
    title = ""
    h1 = soup.select_one("main h1") or soup.select_one("h1")
    if h1:
        title = h1.get_text(" ")
    elif soup.title:
        title = soup.title.get_text(" ")
    date = ""
    m = re.search(r"(last update|last updated|page updated|dernière mise à jour)\s*:?\s*([^\n<]{6,40})",
                  soup.get_text("\n"), re.I)
    if m:
        date = parse_date(m.group(2))
    return [_entry(base_url, title or src["name"], date, "", src.get("type", ""),
                   extra={"snapshot": True})]


# ── EU Publications Office CELLAR (SPARQL) ────────────────────────

CELLAR_SPARQL = "https://publications.europa.eu/webapi/rdf/sparql"
_PREFIX = "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n"
_ENG = "<http://publications.europa.eu/resource/authority/language/ENG>"

QUERY_RELATED = _PREFIX + """
SELECT DISTINCT ?celex ?pub ?rel ?basecelex ?title ?eif ?deadline ?type ?eli ?modified WHERE {
  VALUES ?basecelex { %(bases)s }
  ?b cdm:resource_legal_id_celex ?bc . FILTER(STR(?bc) = ?basecelex)
  ?work ?rel ?b .
  FILTER(?rel IN (cdm:resource_legal_based_on_resource_legal, cdm:resource_legal_amends_resource_legal,
                  cdm:resource_legal_corrects_resource_legal, cdm:resource_legal_implements_resource_legal))
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:official-journal-act_date_publication ?pub .
  FILTER(?pub >= "%(since)s"^^xsd:date)
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?eif . }
  OPTIONAL { ?work cdm:resource_legal_date_deadline ?deadline . }
  OPTIONAL { ?work cdm:work_has_resource-type ?type . }
  OPTIONAL { ?work cdm:resource_legal_eli ?eli . }
  OPTIONAL { ?work cdm:lastModificationDate ?modified . }
  OPTIONAL { ?expr cdm:expression_belongs_to_work ?work ; cdm:expression_uses_language %(eng)s ;
             cdm:expression_title ?title . }
} ORDER BY DESC(?pub) LIMIT %(limit)s
"""

QUERY_OJ_RECENT = _PREFIX + """
SELECT DISTINCT ?celex ?pub ?title ?eif ?deadline ?type ?eli ?modified WHERE {
  ?work cdm:official-journal-act_date_publication ?pub .
  FILTER(?pub >= "%(since)s"^^xsd:date)
  ?work cdm:official-journal-act_part_of_collection_document
        <http://publications.europa.eu/resource/authority/document-collection/OJ-L> .
  ?work cdm:resource_legal_id_celex ?celex .
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?eif . }
  OPTIONAL { ?work cdm:resource_legal_date_deadline ?deadline . }
  OPTIONAL { ?work cdm:work_has_resource-type ?type . }
  OPTIONAL { ?work cdm:resource_legal_eli ?eli . }
  OPTIONAL { ?work cdm:lastModificationDate ?modified . }
  ?expr cdm:expression_belongs_to_work ?work ; cdm:expression_uses_language %(eng)s ;
        cdm:expression_title ?title .
} ORDER BY DESC(?pub) LIMIT %(limit)s
"""


def cellar_query(src: dict, since: str) -> str:
    p = src["params"]
    q = QUERY_RELATED if p["query"] == "related" else QUERY_OJ_RECENT
    return q % {"bases": " ".join(f'"{c}"' for c in p.get("base_celex", [])),
                "since": since, "eng": _ENG, "limit": int(p.get("limit", 300))}


def eurlex_url(celex: str) -> str:
    return "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:" + celex


def parse_cellar(src: dict, body: bytes) -> list:
    data = json.loads(body)
    by_celex = {}
    rel_label = {"based_on": "based on", "amends": "amends", "corrects": "corrects",
                 "implements": "implements"}
    for b in data.get("results", {}).get("bindings", []):
        v = {k: x.get("value", "") for k, x in b.items()}
        celex = v["celex"]
        e = by_celex.get(celex)
        if e is None:
            rtype = v.get("type", "").rsplit("/", 1)[-1]
            corrig = bool(re.search(r"R\(\d+\)$", celex))
            title = v.get("title", "") or (f"Corrigendum to {celex.split('R(')[0]}" if corrig else celex)
            e = _entry(eurlex_url(celex), title, v.get("pub", "")[:10], "", rtype,
                       {"OJ publication": {"text": v.get("pub", "")[:10], "date": v.get("pub", "")[:10]},
                        "Entry into force": {"text": v.get("eif", "")[:10], "date": v.get("eif", "")[:10]},
                        "Deadline (CELLAR)": {"text": v.get("deadline", "")[:10], "date": v.get("deadline", "")[:10]}},
                       {"celex": celex, "eli": v.get("eli", ""), "resource_type": rtype,
                        "corrigendum": corrig, "relations": [], "cellar_modified": v.get("modified", ""),
                        "fetch_url": "http://publications.europa.eu/resource/celex/" + celex})
            by_celex[celex] = e
        if v.get("rel"):
            rel = v["rel"].rsplit("#", 1)[-1].replace("resource_legal_", "").replace("_resource_legal", "")
            r = f"{rel_label.get(rel, rel)} {v.get('basecelex', '')}"
            if r not in e["extra"]["relations"]:
                e["extra"]["relations"].append(r)
    for e in by_celex.values():
        if e["extra"]["relations"]:
            e["summary"] = "; ".join(e["extra"]["relations"])
    return list(by_celex.values())


PARSERS = {
    "rss": lambda src, resp: parse_rss(src, resp.body),
    "html_list": lambda src, resp: parse_html_list(src, resp.body, resp.final_url),
    "html_links": lambda src, resp: parse_html_links(src, resp.body, resp.final_url),
    "amla_instruments": lambda src, resp: parse_amla_instruments(src, resp.body, resp.final_url),
    "page_snapshot": lambda src, resp: parse_page_snapshot(src, resp.body, resp.url),
    "cellar_sparql": lambda src, resp: parse_cellar(src, resp.body),
}
