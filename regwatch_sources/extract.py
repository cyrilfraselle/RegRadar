"""Document text extraction with citable locators.

HTML  -> sections split at headings (and EUR-Lex "Article N" titles); each
         paragraph numbered within its section: cite as
         "Article 5, para 3" or "<heading>, para 3".
PDF   -> one section per page, paragraphs numbered within the page: cite
         as "p. 12, para 3". Uses pypdf (already in requirements.txt).

Size limits keep the repository small: text is stored, never binaries;
documents above MAX_CHARS keep their first MAX_CHARS characters of
paragraphs plus an outline (headings or page numbers) of the rest, with
the full binary's sha256 and URL so the original can be re-fetched.
"""
import io
import re

from bs4 import BeautifulSoup

MAX_CHARS = 150_000        # stored text per document
MAX_PDF_PAGES = 150        # pages read per PDF
MIN_PARA = 3               # characters; shorter fragments are dropped

_WS = re.compile(r"\s+")
_DROP = ("script, style, noscript, nav, header, footer, aside, form, button, "
         "[role=navigation], .breadcrumb, .cookie, #cookie, .ecl-site-header, "
         ".ecl-footer, .ecl-breadcrumb, .ecl-page-header__meta, .visually-hidden, "
         ".ecl-u-sr-only, .sr-only")
_ROOTS = ("#main-content", "main article", "main", "[role=main]", "article",
          ".region-content", "#content", "body")
_BLOCKS = ("p", "li", "td", "th", "blockquote", "dd", "dt", "pre")
_HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6")


def clean(text: str) -> str:
    return _WS.sub(" ", (text or "").replace("­", "").replace("\xa0", " ")).strip()


# ── language ──────────────────────────────────────────────────────
_STOP = {
    "en": {"the", "and", "of", "to", "in", "is", "that", "for", "shall", "be", "with", "by"},
    "fr": {"le", "la", "les", "et", "des", "du", "est", "que", "pour", "dans", "une", "sont"},
    "nl": {"de", "het", "een", "en", "van", "is", "dat", "voor", "met", "zijn", "op", "wordt"},
    "de": {"der", "die", "das", "und", "ist", "von", "zu", "mit", "für", "den", "nicht", "werden"},
}


def detect_language(text: str) -> str:
    words = re.findall(r"[a-zà-ÿ]+", (text or "")[:20000].lower())
    if len(words) < 20:
        return "und"
    scores = {lang: sum(1 for w in words if w in sw) for lang, sw in _STOP.items()}
    lang, best = max(scores.items(), key=lambda kv: kv[1])
    return lang if best >= 5 else "und"


# ── HTML ──────────────────────────────────────────────────────────

def _is_heading(el) -> bool:
    if el.name in _HEADINGS:
        return True
    cls = " ".join(el.get("class") or [])
    # EUR-Lex / CELLAR XHTML: "oj-ti-art" (Article 5), "ti-art", section titles
    return bool(re.search(r"(^|\s)(oj-)?(ti-art|ti-section-\d|ti-grseq-1|doc-ti)(\s|$)", cls))


def _is_subtitle(el) -> bool:
    cls = " ".join(el.get("class") or [])
    return bool(re.search(r"(^|\s)(oj-)?sti-art(\s|$)", cls))


def html_sections(html: str, root_selector: str = None) -> tuple:
    """Return (title, sections). sections = [{"heading", "paras": [str]}]."""
    soup = BeautifulSoup(html or "", "html.parser")
    title = ""
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        title = clean(og["content"])
    elif soup.title:
        title = clean(soup.title.get_text())
    for bad in soup.select(_DROP):
        bad.decompose()
    root = None
    for sel in ([root_selector] if root_selector else []) + list(_ROOTS):
        root = soup.select_one(sel)
        if root:
            break
    if root is None:
        return title, []
    sections = [{"heading": "", "paras": []}]
    seen = set()
    for el in root.find_all(list(_BLOCKS) + list(_HEADINGS)):
        # skip blocks nested in another block we already take (li > p)
        if el.find_parent(list(_BLOCKS)) is not None and el.name != "td":
            continue
        text = clean(el.get_text(" "))
        if len(text) < MIN_PARA:
            continue
        if _is_heading(el):
            sections.append({"heading": text[:300], "paras": []})
            continue
        if _is_subtitle(el) and sections[-1]["heading"] and not sections[-1]["paras"]:
            sections[-1]["heading"] = (sections[-1]["heading"] + " - " + text)[:300]
            continue
        key = text[:200]
        if key in seen and len(text) < 200:
            continue          # repeated boilerplate (menus that escaped _DROP)
        seen.add(key)
        sections[-1]["paras"].append(text)
    sections = [s for s in sections if s["paras"] or s["heading"]]
    if sections and not sections[0]["paras"] and not sections[0]["heading"]:
        sections = sections[1:]
    return title, sections


# ── PDF ───────────────────────────────────────────────────────────
_NUMBERED = re.compile(r"^(\(?[0-9ivxlc]{1,4}[.)]|\(?[a-z][.)]|[•\-–▪●]|Article \d|Section \d|\d+(\.\d+)+)\s", re.I)


def pdf_paragraphs(page_text: str) -> list:
    """Split one page's extracted text into paragraphs.

    pypdf yields lines; a paragraph ends at a blank line, before a
    numbered or bulleted line, or after a line that ends a sentence and is
    clearly shorter than the page's typical line."""
    lines = [l.rstrip() for l in (page_text or "").splitlines()]
    widths = sorted(len(l) for l in lines if len(l.strip()) > 20)
    typical = widths[int(len(widths) * 0.8)] if widths else 80
    paras, cur = [], []
    for raw in lines:
        line = raw.strip()
        if not line:
            if cur:
                paras.append(" ".join(cur))
                cur = []
            continue
        if cur and _NUMBERED.match(line):
            paras.append(" ".join(cur))
            cur = []
        cur.append(line)
        if line.endswith((".", ":", ";", "?", "!")) and len(line) < typical * 0.75:
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    out = []
    for p in paras:
        p = clean(re.sub(r"(\w)-\s+(\w)", r"\1\2", p))   # undo end-of-line hyphenation
        if len(p) >= MIN_PARA and not re.fullmatch(r"\d{1,4}", p):  # drop bare page numbers
            out.append(p)
    return out


def pdf_sections(data: bytes) -> tuple:
    """Return (title, sections, pages_total). One section per page."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    pages_total = len(reader.pages)
    title = ""
    try:
        if reader.metadata and reader.metadata.title:
            title = clean(str(reader.metadata.title))
    except Exception:
        pass
    sections = []
    for i, page in enumerate(reader.pages[:MAX_PDF_PAGES]):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        sections.append({"heading": "", "page": i + 1, "paras": pdf_paragraphs(text)})
    return title, sections, pages_total


# ── common ────────────────────────────────────────────────────────

def finalize(sections: list, max_chars: int = MAX_CHARS) -> dict:
    """Number sections and paragraphs, apply the size cap and return
    {"sections": [...], "chars_total", "chars_stored", "truncated",
    "outline_of_rest": [...]}."""
    out, stored, total, truncated, rest = [], 0, 0, False, []
    for si, s in enumerate(sections, 1):
        paras = s.get("paras", [])
        total += sum(len(p) for p in paras)
        if truncated:
            rest.append(s.get("heading") or (f"p. {s['page']}" if s.get("page") else f"section {si}"))
            continue
        kept = []
        for p in paras:
            if stored + len(p) > max_chars:
                truncated = True
                break
            kept.append(p)
            stored += len(p)
        sec = {"id": f"s{si}", "heading": s.get("heading", "")}
        if s.get("page"):
            sec["page"] = s["page"]
        sec["paras"] = [{"n": n, "text": t, "loc": locator(sec, n)} for n, t in enumerate(kept, 1)]
        if kept or sec["heading"]:
            out.append(sec)
    return {"sections": out, "chars_total": total, "chars_stored": stored,
            "truncated": truncated, "outline_of_rest": rest[:200]}


def locator(section: dict, para_n: int) -> str:
    """Human citation for a paragraph: "p. 12, para 3" or
    "Article 5, para 3"."""
    if section.get("page"):
        return f"p. {section['page']}, para {para_n}"
    h = section.get("heading") or ""
    m = re.match(r"(Article \d+[a-z]?)", h)
    head = m.group(1) if m else (h[:80] if h else section.get("id", ""))
    return f"{head}, para {para_n}"


def extract(body: bytes, content_type: str, url: str, root_selector: str = None) -> dict:
    """Dispatch on content type. Returns
    {"format": "pdf"|"html", "title", "pages_total", ...finalize()}."""
    is_pdf = "pdf" in (content_type or "") or url.lower().split("?")[0].endswith(".pdf") \
        or (body or b"")[:5] == b"%PDF-"
    if is_pdf:
        title, sections, pages = pdf_sections(body)
        res = finalize(sections)
        res.update({"format": "pdf", "title": title, "pages_total": pages})
        return res
    html = body.decode("utf-8", "replace") if isinstance(body, bytes) else body
    title, sections = html_sections(html, root_selector)
    res = finalize(sections)
    res.update({"format": "html", "title": title, "pages_total": None})
    return res


def plain_text(doc_or_sections) -> str:
    secs = doc_or_sections.get("sections", []) if isinstance(doc_or_sections, dict) else doc_or_sections
    return "\n".join(p["text"] for s in secs for p in s.get("paras", []))


def pdf_links(html: str, base: str) -> list:
    """(url, label) of PDF / document-download links inside the main content."""
    from urllib.parse import urljoin
    soup = BeautifulSoup(html or "", "html.parser")
    for bad in soup.select(_DROP):
        bad.decompose()
    root = None
    for sel in _ROOTS:
        root = soup.select_one(sel)
        if root:
            break
    out, seen = [], set()
    for a in (root.select("a[href]") if root else []):
        href = a["href"]
        if ".pdf" in href.lower() or "/document/download/" in href or "/files/" in href and href.lower().endswith(".pdf"):
            u = urljoin(base, href)
            if u not in seen:
                seen.add(u)
                out.append((u, clean(a.get_text(" "))[:200]))
    return out
