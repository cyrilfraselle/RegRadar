"""Story clustering and near-duplicate detection.

Method (documented so it can be checked):
1. Normalise a title: drop the trailing " - Outlet" / " | Outlet" suffix
   that news aggregators append, drop wire prefixes (UPDATED, BREAKING,
   EXCLUSIVE, UPDATE n, PRESS RELEASE), lower-case, fold accents, keep
   letters and digits only, drop a short stop-word list.
2. Exact duplicate: identical normalised title, or identical canonical URL.
3. Near duplicate (same story): two items within WINDOW_DAYS of each other
   whose normalised titles share enough content: Jaccard similarity of
   word sets >= JACCARD, or containment (shared words / words of the
   shorter title) >= CONTAINMENT with at least MIN_SHARED shared words.
   Numbers are kept, so "2026/2490" and "2026/2491" are different acts.
4. Identifier rules override similarity: when both titles carry their own
   act number (CELEX:3YYYYxNNNN, OJ:L_YYYYNNNNN or the first YYYY/NNNN)
   or a dd/mm/yyyy date, equal identifiers mean the same story and
   different identifiers mean different stories (EU acts share long
   boilerplate titles). Titles that differ by an opposing event word
   (suspension / reopening of trading) are different stories.
5. Clusters are the connected components (union-find) of those links.
   Each cluster gets one card: the primary-source item first (highest
   rank), the other items listed beneath as "also reported by".

Thresholds were set on tests/golden/duplicate_pairs.json (real pairs from
docs/data/items.json, labelled by hand); tests/test_dedupe.py checks them.
"""
import re
import unicodedata
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

WINDOW_DAYS = 10
JACCARD = 0.4
CONTAINMENT = 0.8
MIN_SHARED = 4

_PREFIX = re.compile(r"^\s*((updated?|breaking|exclusive|update \d+|press release|news|watch|video|"
                     r"live|opinion|analysis)\s*[:\-–|]\s*)+", re.I)
_SUFFIX = re.compile(r"\s+[-–|]\s+[^-–|]{2,60}$")
_STOP = set("a an the of on in for to and or by with at from as is are be its it this that new "
            "le la les de des du et en un une pour sur au aux de het een van voor en op".split())
_TRACKING = ("utm_", "oc", "fbclid", "gclid", "mc_cid", "mc_eid")


def canonical_url(url: str) -> str:
    try:
        p = urlsplit((url or "").strip())
    except ValueError:
        return url or ""
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
         if not any(k.lower().startswith(t) for t in _TRACKING)]
    path = re.sub(r"/+$", "", p.path) or "/"
    return urlunsplit((p.scheme.lower() or "https", p.netloc.lower().removeprefix("www."),
                       path, urlencode(q), ""))


def normalise_title(title: str, strip_outlet: bool = True) -> str:
    t = title or ""
    t = _PREFIX.sub("", t)
    if strip_outlet:
        t = _SUFFIX.sub("", t)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    t = re.sub(r"[^a-z0-9/]+", " ", t)
    return " ".join(w for w in t.split() if w not in _STOP)


def similarity(a: str, b: str) -> dict:
    wa, wb = set(a.split()), set(b.split())
    if not wa or not wb:
        return {"jaccard": 0.0, "containment": 0.0, "shared": 0}
    shared = len(wa & wb)
    return {"jaccard": shared / len(wa | wb),
            "containment": shared / min(len(wa), len(wb)), "shared": shared}


_CELEX = re.compile(r"CELEX:\d(\d{4})[A-Z]{1,2}(\d{1,5})")
_OJ = re.compile(r"OJ:L_(\d{4})(\d{5})")
_ACT = re.compile(r"(?<![\d/])((?:19|20)\d{2})/(\d{1,5})(?![\d])")
_DMY = re.compile(r"\b(\d{1,2}) ?/ ?(\d{1,2}) ?/ ?(\d{4})\b")
_OPPOSED = [("suspension", "reopening"), ("suspends", "reopens"), ("adds", "removes")]


def identifier(raw: str) -> str:
    """The item's own act number or dated-issue key, or ''."""
    raw = raw or ""
    for rx in (_CELEX, _OJ):
        m = rx.search(raw)
        if m:
            return f"{m.group(1)}/{int(m.group(2))}"
    m = _ACT.search(raw)
    if m:
        return f"{m.group(1)}/{int(m.group(2))}"
    m = _DMY.search(raw)
    if m:
        return f"{int(m.group(1))}/{int(m.group(2))}/{m.group(3)}"
    return ""


def same_story_raw(ta: str, tb: str) -> bool:
    """Decision on raw titles: identifier rules, then normalised similarity."""
    ia, ib = identifier(ta), identifier(tb)
    if ia and ib:
        return ia == ib
    la, lb = (ta or "").lower(), (tb or "").lower()
    for x, y in _OPPOSED:
        if (x in la and y in lb) or (y in la and x in lb):
            return False
    return same_story(normalise_title(ta), normalise_title(tb))


def same_story(a: str, b: str) -> bool:
    """a, b are normalised titles."""
    if a == b and a:
        return True
    s = similarity(a, b)
    if s["jaccard"] >= JACCARD and s["shared"] >= 3:
        return True
    return s["containment"] >= CONTAINMENT and s["shared"] >= MIN_SHARED


def _date(x):
    try:
        return datetime.fromisoformat(str(x)[:19])
    except ValueError:
        return None


def cluster(items: list, title_key="title", date_key="date", url_key="url") -> list:
    """Return a list of clusters (lists of indexes into `items`)."""
    n = len(items)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[max(ri, rj)] = min(ri, rj)

    norm = [normalise_title(it.get(title_key, "")) for it in items]
    dates = [_date(it.get(date_key)) for it in items]
    by_url, by_title = {}, {}
    for i, it in enumerate(items):
        u = canonical_url(it.get(url_key, ""))
        if u and u in by_url:
            union(i, by_url[u])
        by_url.setdefault(u, i)
        if norm[i] and norm[i] in by_title and \
                identifier(items[i].get(title_key, "")) == identifier(items[by_title[norm[i]]].get(title_key, "")):
            union(i, by_title[norm[i]])
        by_title.setdefault(norm[i], i)
    order = sorted(range(n), key=lambda i: dates[i] or datetime.min)
    for a_pos, i in enumerate(order):
        for j in order[a_pos + 1:]:
            if dates[i] and dates[j] and (dates[j] - dates[i]).days > WINDOW_DAYS:
                break
            if find(i) != find(j) and same_story_raw(items[i].get(title_key, ""),
                                                     items[j].get(title_key, "")):
                union(i, j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())
