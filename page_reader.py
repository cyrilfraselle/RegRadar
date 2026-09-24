"""
Page reader — fetches a publication's own web page and extracts a short,
readable description of it.

RSS feeds and scraped listings give a title and, at best, a truncated
teaser; several give nothing (NBB supervision page, EBA digests). The page
itself almost always carries a proper description: an og:description or
meta description written by the regulator, or an opening paragraph. That
text is what the reader sees under "What happened", and it is the input
the AI summary works from — a title alone is not enough to summarise.

PDFs (ECB speeches and publications, many consultation papers) are read
too: the opening text of the first pages.

Deliberately skipped:
  - Google News links (redirect pages, no content without JavaScript)
  - EUR-Lex (the title IS the full description of the act)
"""
import io
import logging
import re

import requests
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en;q=0.9,fr;q=0.8",
    # No "br": requests cannot decode Brotli without the optional package.
    "Accept-Encoding": "gzip, deflate",
}

SKIP_HOSTS = ("news.google.", "eur-lex.europa.eu")
MAX_CHARS = 700

# Boilerplate that some sites put in every page's meta description —
# the same slogan on every page says nothing about this one.
_GENERIC = (
    "cookies", "javascript", "skip to main content", "this website",
    "official website", "we use", "subscribe",
    "european banking supervisors contribute to keeping",   # ECB Banking Supervision
    "in view of the upcoming eu institutional cycle",       # EIOPA
)


def _clean(text: str) -> str:
    # Some sites (Commission press corner) escape their meta text: "\\n", "\\'".
    text = (text or "").replace("\\n", " ").replace("\\'", "'").replace('\\"', '"')
    text = re.sub(r"\s*\[\s*\d{1,3}\s*\]", "", text)        # footnote marks: "[ 1 ]"
    return re.sub(r"\s+", " ", text).strip()


def _looks_generic(text: str, title: str) -> bool:
    t = text.lower()
    if len(t) < 60:
        return True
    if any(g in t[:120] for g in _GENERIC):
        return True
    # A "description" that only repeats (or truncates) the title adds nothing.
    ti = _clean(title).lower()
    return t in ti or (ti in t and len(t) < len(ti) + 40)


def _cut(text: str, limit: int = MAX_CHARS) -> str:
    """Trim to whole sentences where possible."""
    text = _clean(text)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    dot = cut.rfind(". ")
    return (cut[:dot + 1] if dot > limit * 0.5 else cut.rsplit(" ", 1)[0] + "…")


def extract_description(html: str, title: str = "") -> str:
    soup = BeautifulSoup(html, "html.parser")

    # 1. The page's own description, if it is specific to this page.
    for attrs in ({"property": "og:description"}, {"name": "description"},
                  {"name": "twitter:description"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            text = _clean(tag["content"])
            if not _looks_generic(text, title):
                return _cut(text)

    # 2. Otherwise the opening paragraphs of the main content.
    for bad in soup.select("script, style, nav, header, footer, aside, form, "
                           "[role=navigation], .breadcrumb, .cookie, #cookie"):
        bad.decompose()
    root = soup.select_one("main article, article, main, [role=main], #main-content, .content") or soup.body
    if not root:
        return ""
    parts, total = [], 0
    for p in root.find_all(["p", "li"], limit=60):
        text = _clean(p.get_text(" "))
        if len(text) < 60 or _looks_generic(text, title):
            continue
        parts.append(text)
        total += len(text)
        if total >= MAX_CHARS:
            break
    return _cut(" ".join(parts))


def extract_pdf(data: bytes, title: str = "") -> str:
    """Opening prose of a PDF: skips the cover lines (logos, names, dates,
    page headers) and keeps the first real sentences."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        text = " ".join((page.extract_text() or "") for page in reader.pages[:3])
    except Exception as e:
        log.debug(f"page_reader: pdf: {e}")
        return ""
    lines = [_clean(l) for l in text.splitlines()]
    # Prose lines are long; cover-page lines are short fragments.
    body = " ".join(l for l in lines if len(l) >= 50)
    body = re.sub(r"\s+", " ", body)
    if len(body) < 80 or _looks_generic(body[:200], title):
        return ""
    return _cut(body)


def read_page(url: str, title: str = "", timeout: int = 25) -> dict:
    """Read the publication at `url`.

    Returns {"text": str, "kind": "page" | "pdf" | ""}:
      - "page": a clean description from the web page — fit to show to a
        reader as "What happened".
      - "pdf": opening text of the document. Useful input for an AI
        summary, but too raw (cover pages, contents lists) to show as is.
    """
    empty = {"text": "", "kind": ""}
    if not url or any(h in url for h in SKIP_HOSTS):
        return empty
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "")
        if "pdf" in ctype or url.lower().split("?")[0].endswith(".pdf"):
            return {"text": extract_pdf(r.content, title), "kind": "pdf"}
        if "html" not in ctype:
            return empty
        text = extract_description(r.text, title)
        if text:
            return {"text": text, "kind": "page"}
        # Pages that are only a card around a download (NBB decisions and
        # circulars): the substance is in the attached PDF.
        pdf = _first_pdf_link(r.text, r.url)
        if pdf:
            p = requests.get(pdf, headers=HEADERS, timeout=timeout)
            p.raise_for_status()
            return {"text": extract_pdf(p.content, title), "kind": "pdf"}
        return empty
    except Exception as e:
        log.debug(f"page_reader: {url}: {e}")
        return empty


def _first_pdf_link(html: str, base: str) -> str:
    from urllib.parse import urljoin
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("main") or soup.body
    if not root:
        return ""
    for a in root.select("a[href]"):
        href = a["href"]
        if ".pdf" in href.lower():
            return urljoin(base, href)
    return ""
