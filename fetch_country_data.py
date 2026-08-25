"""
═══════════════════════════════════════════════════════════════════
  FETCH COUNTRY DATA — refresh indicators from primary sources
═══════════════════════════════════════════════════════════════════

  RUN LOCALLY (your PC). Some of these sites block datacenter IPs,
  same as EUR-Lex, so this will not work from GitHub Actions.

      pip install requests beautifulsoup4 pandas openpyxl pycountry
      python fetch_country_data.py --cpi ~/Downloads/CPI2025.xlsx \
                                   --ocindex ~/Downloads/ocindex_2025.xlsx

  DESIGN PRINCIPLES
  ─────────────────
  1. Each source fails INDEPENDENTLY. If FATF works but CPI breaks, the
     previous CPI values are KEPT and flagged `stale`. We never silently
     zero an indicator — a silently-wrong country risk model is worse
     than no model at all.
  2. manual_overrides.json always wins. Scrapers break; you shouldn't be
     blocked by that.
  3. A CHANGE LOG is written every run. That is the artefact that tells
     you a model review is due.

  ⚠️  SCRAPERS ARE BRITTLE. These sites redesign. On failure the script
     says so loudly, keeps the old value, and carries on.
═══════════════════════════════════════════════════════════════════
"""

import json
import sys
from datetime import date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DATA_FILE = Path("docs/data/country-risk.json")
CHANGELOG_FILE = Path("docs/data/country-risk-changelog.json")
OVERRIDES_FILE = Path("manual_overrides.json")

UA = {"User-Agent": "Mozilla/5.0 (compatible; RegRadar/1.0; country risk research)"}
TODAY = date.today().isoformat()

FATF_HUB = "https://www.fatf-gafi.org/en/publications/High-risk-and-other-monitored-jurisdictions.html"
EU_HRTC_URL = "https://finance.ec.europa.eu/financial-crime/high-risk-third-countries_en"

ALIASES = {
    "korea, dpr": "PRK", "north korea": "PRK", "dprk": "PRK",
    "democratic people's republic of korea": "PRK",
    "korea, rep.": "KOR", "south korea": "KOR",
    "cote d'ivoire": "CIV", "côte d'ivoire": "CIV", "ivory coast": "CIV",
    "turkiye": "TUR", "türkiye": "TUR", "turkey": "TUR",
    "congo, dem. rep.": "COD", "dr congo": "COD",
    "democratic republic of the congo": "COD",
    "congo, rep.": "COG", "laos": "LAO", "lao pdr": "LAO",
    "vietnam": "VNM", "viet nam": "VNM", "syria": "SYR", "iran": "IRN",
    "venezuela": "VEN", "tanzania": "TZA", "bolivia": "BOL",
    "moldova": "MDA", "russia": "RUS", "united states": "USA",
    "uae": "ARE", "united arab emirates": "ARE", "myanmar": "MMR",
    "czech republic": "CZE", "czechia": "CZE",
    "british virgin islands": "VGB", "virgin islands (british)": "VGB",
    "trinidad & tobago": "TTO", "trinidad and tobago": "TTO",
    "hong kong": "HKG", "cayman islands": "CYM",
}


def iso3(name):
    if not name:
        return None
    key = name.strip().lower().rstrip(".")
    if key in ALIASES:
        return ALIASES[key]
    try:
        import pycountry
        try:
            return pycountry.countries.lookup(name).alpha_3
        except LookupError:
            try:
                m = pycountry.countries.search_fuzzy(name)
                return m[0].alpha_3 if m else None
            except LookupError:
                return None
    except ImportError:
        return None


def fetch_fatf():
    """Returns {iso3: 'black'|'grey'} or None. Discovers current statement URLs."""
    print("→ FATF black & grey lists…")
    try:
        hub = requests.get(FATF_HUB, headers=UA, timeout=30)
        hub.raise_for_status()
        soup = BeautifulSoup(hub.text, "html.parser")
        black_url = grey_url = None
        for a in soup.find_all("a", href=True):
            low = a["href"].lower()
            if "call-for-action" in low and not black_url:
                black_url = requests.compat.urljoin(FATF_HUB, a["href"])
            if "increased-monitoring" in low and not grey_url:
                grey_url = requests.compat.urljoin(FATF_HUB, a["href"])
        if not (black_url and grey_url):
            print("  ! Could not locate the two FATF statement links.")
            return None

        result = {}
        SKIP = ("fatf", "jurisdiction", "action", "monitoring", "statement",
                "plenary", "read", "more", "publication", "high-risk", "increased")
        for url, status in ((black_url, "black"), (grey_url, "grey")):
            r = requests.get(url, headers=UA, timeout=30)
            r.raise_for_status()
            s = BeautifulSoup(r.text, "html.parser")
            found = 0
            for el in s.select("h2, h3, h4, strong, b, li a"):
                txt = el.get_text(strip=True)
                if 3 < len(txt) < 40 and not any(w in txt.lower() for w in SKIP):
                    code = iso3(txt)
                    if code:
                        result[code] = status
                        found += 1
            print(f"  {status}: {found} jurisdiction(s)")
        if not result:
            print("  ! Parsed the pages but extracted nothing — layout changed.")
            return None
        return result
    except Exception as e:
        print(f"  ! FATF fetch failed: {type(e).__name__}: {str(e)[:90]}")
        return None


def fetch_eu_hrtc():
    """Returns set of iso3 on the EU high-risk third country list, or None."""
    print("→ EU high-risk third countries…")
    try:
        r = requests.get(EU_HRTC_URL, headers=UA, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        codes = set()
        for el in soup.select("li, td"):
            txt = el.get_text(strip=True)
            if 3 < len(txt) < 45:
                code = iso3(txt)
                if code:
                    codes.add(code)
        if len(codes) < 5:
            print(f"  ! Only {len(codes)} matched — layout likely changed.")
            return None
        print(f"  {len(codes)} jurisdiction(s)")
        return codes
    except Exception as e:
        print(f"  ! EU HRTC fetch failed: {type(e).__name__}: {str(e)[:90]}")
        return None


# ═══════════════════════════════════════════════════════════════════
#  AUTOMATION HELPERS (stdlib only, so CI needs no extra wheels)
# ═══════════════════════════════════════════════════════════════════

COUNTRY_CODES_CSV = ("https://raw.githubusercontent.com/datasets/country-codes/"
                     "master/data/country-codes.csv")
# Pinned to the published year rather than "latest": CPI 2025 is not out
# yet (403), and a silently-wrong year is worse than a known-old one.
CPI_XLSX_URL = "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx"
CPI_YEAR = 2024


def _xlsx_rows(blob: bytes):
    """Minimal .xlsx reader: yields rows as lists of strings.

    Deliberately stdlib — pandas + openpyxl are heavy for CI and this
    only needs a flat sheet. Handles shared strings and inline strings,
    and honours cell references so blank cells don't shift columns.
    """
    import zipfile, io, re as _r
    from xml.etree import ElementTree as ET

    def ns_of(root):
        """Take the namespace from the document instead of assuming it.
        Office writes either the transitional schema
        (schemas.openxmlformats.org/...) or the strict one
        (purl.oclc.org/ooxml/...). Transparency International's CPI
        workbook uses strict, so a hardcoded transitional namespace
        silently matched nothing and parsed zero rows."""
        m = _r.match(r"\{([^}]+)\}", root.tag)
        return "{%s}" % m.group(1) if m else ""

    z = zipfile.ZipFile(io.BytesIO(blob))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        SNS = ns_of(root)
        for si in root.findall(f"{SNS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{SNS}t")))
    # Workbooks put the data wherever they like — CPI's first sheet is a
    # cover page. Walk every sheet; the caller decides what it recognises.
    # Exclude xl/worksheets/_rels/*.xml, which also match the prefix.
    sheets = sorted(n for n in z.namelist()
                    if _r.match(r"xl/worksheets/sheet\d+\.xml$", n))
    for sheet in sheets:
      sroot = ET.fromstring(z.read(sheet))
      NS = ns_of(sroot)
      for row in sroot.iter(f"{NS}row"):
        cells, maxcol = {}, 0
        for c in row.findall(f"{NS}c"):
            ref = c.get("r") or ""
            m = _r.match(r"([A-Z]+)", ref)
            idx = 0
            for ch in (m.group(1) if m else "A"):
                idx = idx * 26 + (ord(ch) - 64)
            idx -= 1
            v = c.find(f"{NS}v")
            if c.get("t") == "s" and v is not None:
                try:
                    val = shared[int(v.text)]
                except (ValueError, IndexError):
                    val = ""
            elif c.get("t") == "inlineStr":
                val = "".join(t.text or "" for t in c.iter(f"{NS}t"))
            else:
                val = (v.text if v is not None else "") or ""
            cells[idx] = val.strip()
            maxcol = max(maxcol, idx)
        yield [cells.get(i, "") for i in range(maxcol + 1)]


def fetch_country_list():
    """Every ISO 3166-1 country, so coverage is not capped by whatever
    happened to be seeded by hand. Returns [{code, iso3, name, region}]."""
    print("→ ISO 3166-1 country list…")
    try:
        import csv, io
        r = requests.get(COUNTRY_CODES_CSV, headers=UA, timeout=45)
        r.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(r.text)))
        out = []
        for x in rows:
            a2 = (x.get("ISO3166-1-Alpha-2") or "").strip()
            a3 = (x.get("ISO3166-1-Alpha-3") or "").strip()
            name = ((x.get("UNTERM English Short") or "").strip()
                    or (x.get("official_name_en") or "").strip()
                    or (x.get("CLDR display name") or "").strip())
            region = (x.get("Region Name") or "").strip()
            if len(a2) == 2 and len(a3) == 3 and name:
                out.append({"code": a2, "iso3": a3, "name": name,
                            "region": region or "—"})
        print(f"  {len(out)} countries")
        return out or None
    except Exception as e:
        print(f"  ! country list failed: {type(e).__name__}: {str(e)[:80]}")
        return None


def fetch_cpi_auto():
    """CPI without a manual download. The spreadsheet is served publicly
    and, unlike FATF, is reachable from a datacenter IP — so this is the
    one heavyweight indicator that genuinely automates."""
    print(f"→ Transparency International CPI {CPI_YEAR} (auto)…")
    try:
        r = requests.get(CPI_XLSX_URL, headers=UA, timeout=90)
        r.raise_for_status()
        if not r.content[:2] == b"PK":
            print("  ! not an xlsx (soft-404?) — keeping previous values")
            return None
        rows = list(_xlsx_rows(r.content))
        hdr_i = next((i for i, row in enumerate(rows)
                      if any(c.strip().upper() == "ISO3" for c in row)), None)
        if hdr_i is None:
            print("  ! no ISO3 header found — keeping previous values")
            return None
        hdr = [c.strip().lower() for c in rows[hdr_i]]
        iso_c = next(i for i, c in enumerate(hdr) if c == "iso3")
        score_c = next((i for i, c in enumerate(hdr)
                        if "score" in c and "rank" not in c), None)
        if score_c is None:
            print("  ! no score column — keeping previous values")
            return None
        out = {}
        for row in rows[hdr_i + 1:]:
            if len(row) <= max(iso_c, score_c):
                continue
            code = row[iso_c].strip().upper()
            try:
                sc = float(row[score_c])
            except (TypeError, ValueError):
                continue
            if len(code) == 3 and 0 <= sc <= 100:
                out[code] = round(sc)
        print(f"  {len(out)} country score(s)")
        return out or None
    except Exception as e:
        print(f"  ! CPI auto-fetch failed: {type(e).__name__}: {str(e)[:80]}")
        return None


def fetch_cpi(path=None):
    """
    Returns {iso3: 0-100} or None.
    Download from https://www.transparency.org/en/cpi and pass --cpi <path>.
    Licence: CC BY-ND 4.0 — attribution required; do not publish a modified
    version of the index itself. Using it as a model input and citing it is fine.
    """
    print("→ Transparency International CPI…")
    if not path:
        print("  · skipped (pass --cpi <file>)")
        return None
    try:
        import pandas as pd
        p = Path(path)
        df = pd.read_excel(p) if p.suffix in (".xlsx", ".xls") else pd.read_csv(p)
        cols = {c.lower().strip(): c for c in df.columns}
        iso_col = next((cols[c] for c in cols if "iso" in c), None)
        score_col = next((cols[c] for c in cols if "score" in c and "rank" not in c), None)
        name_col = next((cols[c] for c in cols
                         if c in ("country", "country / territory", "jurisdiction")), None)
        if not score_col:
            print("  ! No score column. Columns:", list(df.columns)[:8])
            return None
        out = {}
        for _, row in df.iterrows():
            code = None
            if iso_col and isinstance(row[iso_col], str):
                code = row[iso_col].strip().upper()
            elif name_col:
                code = iso3(str(row[name_col]))
            try:
                sc = float(row[score_col])
            except (TypeError, ValueError):
                continue
            if code and len(code) == 3 and 0 <= sc <= 100:
                out[code] = round(sc)
        print(f"  {len(out)} country score(s)")
        return out or None
    except Exception as e:
        print(f"  ! CPI parse failed: {type(e).__name__}: {str(e)[:90]}")
        return None


def fetch_ocindex(path=None):
    """
    Returns {iso3: {criminality, resilience, human_trafficking, ...}} or None.
    Download from https://ocindex.net/downloads and pass --ocindex <path>.
    Licence: GI-TOC. Attribution required. CHECK THE DOWNLOAD TERMS before
    redistributing the data itself.
    """
    print("→ GI-TOC Organized Crime Index…")
    if not path:
        print("  · skipped (pass --ocindex <file>)")
        return None
    try:
        import pandas as pd
        df = pd.read_excel(path)
        cols = {c.lower().strip(): c for c in df.columns}
        name_col = next((cols[c] for c in cols if c in ("country", "countries")), None)
        if not name_col:
            print("  ! No country column. Columns:", list(df.columns)[:8])
            return None
        wanted = {
            "criminality": "criminality",
            "resilience": "resilience",
            "human trafficking": "human_trafficking",
            "financial crimes": "financial_crimes",
            "cyber-dependent crimes": "cyber_crimes",
            "arms trafficking": "arms_trafficking",
            "anti-money laundering": "aml_resilience",
        }
        out = {}
        for _, row in df.iterrows():
            code = iso3(str(row[name_col]))
            if not code:
                continue
            rec = {}
            for label, key in wanted.items():
                col = cols.get(label)
                if col is not None:
                    try:
                        rec[key] = round(float(row[col]), 2)
                    except (TypeError, ValueError):
                        pass
            if rec:
                out[code] = rec
        print(f"  {len(out)} country record(s)")
        return out or None
    except Exception as e:
        print(f"  ! OC Index parse failed: {type(e).__name__}: {str(e)[:90]}")
        return None


def diff(prev, new):
    pi = {c.get("iso3") or c.get("code"): c for c in prev}
    changes = []
    for c in new:
        code = c.get("iso3") or c.get("code")
        old = pi.get(code)
        if not old:
            changes.append({"country": c["name"], "change": "added to dataset"})
            continue
        oi, ni = old.get("indicators", {}), c.get("indicators", {})
        if oi.get("fatf") != ni.get("fatf"):
            changes.append({"country": c["name"], "indicator": "FATF",
                            "from": oi.get("fatf") or "not listed",
                            "to": ni.get("fatf") or "not listed"})
        if bool(oi.get("eu_hrtc")) != bool(ni.get("eu_hrtc")):
            changes.append({"country": c["name"], "indicator": "EU high-risk",
                            "from": "listed" if oi.get("eu_hrtc") else "not listed",
                            "to": "listed" if ni.get("eu_hrtc") else "not listed"})
        oc, nc = oi.get("cpi"), ni.get("cpi")
        if oc and nc and abs(oc - nc) >= 3:
            changes.append({"country": c["name"], "indicator": "CPI",
                            "from": oc, "to": nc})
    return changes


def main():
    args = sys.argv[1:]
    cpi_path = args[args.index("--cpi") + 1] if "--cpi" in args else None
    oc_path = args[args.index("--ocindex") + 1] if "--ocindex" in args else None

    prev = json.load(open(DATA_FILE, encoding="utf-8")) if DATA_FILE.exists() else {}
    prev_countries = prev.get("countries", [])
    sources = dict(prev.get("sources", {}))

    print(f"\nRefreshing country risk data — {TODAY}\n" + "=" * 52)
    fatf, eu = fetch_fatf(), fetch_eu_hrtc()
    # Prefer a manually supplied file (lets you use a newer CPI than the
    # pinned one); otherwise fetch it ourselves.
    cpi = fetch_cpi(cpi_path) if cpi_path else fetch_cpi_auto()
    oc = fetch_ocindex(oc_path)

    stale = [k for k, v in (("fatf", fatf), ("eu_hrtc", eu),
                            ("cpi", cpi), ("ocindex", oc)) if v is None]

    # ── Country universe ────────────────────────────────────────────
    # Previously this iterated `prev_countries`, so the file could only
    # ever contain whatever was seeded by hand — 90 countries, with no
    # way to grow. Start from the full ISO 3166-1 list and merge the
    # existing records onto it, so coverage is a property of the data
    # rather than of what someone typed once.
    universe = fetch_country_list()
    prev_by = {}
    for c in prev_countries:
        k = c.get("iso3") or iso3(c["name"])
        if k:
            prev_by[k] = c

    if universe:
        base = []
        for u in universe:
            old = prev_by.get(u["iso3"])
            if old:
                rec = dict(old)
                rec.setdefault("region", u["region"])
                base.append(rec)
            else:
                base.append({"code": u["code"], "name": u["name"],
                             "region": u["region"], "iso3": u["iso3"],
                             "indicators": {},
                             "regulator": {"supervisor": "—", "fiu": "—",
                                           "egmont": False}})
        added = len(base) - len(prev_by)
        print(f"  · country universe: {len(base)} "
              f"({added:+d} vs previous {len(prev_countries)})")
    else:
        # Country list unavailable: keep exactly what we had rather than
        # dropping countries. Same principle as the indicators.
        print("  · country list unavailable — keeping previous set")
        base = list(prev_countries)
        stale.append("country_list")

    new_countries = []
    for c in base:
        code = c.get("iso3") or iso3(c["name"])
        ind = dict(c.get("indicators", {}))
        if fatf is not None:
            ind["fatf"] = fatf.get(code)
        if eu is not None:
            ind["eu_hrtc"] = code in eu
        if cpi is not None and code in cpi:
            ind["cpi"] = cpi[code]
        if oc is not None and code in oc:
            ind.update(oc[code])
        rec = dict(c)
        rec["iso3"] = code
        rec["indicators"] = ind
        new_countries.append(rec)

    if OVERRIDES_FILE.exists():
        ov = json.load(open(OVERRIDES_FILE, encoding="utf-8"))
        by = {c["iso3"]: c for c in new_countries if c.get("iso3")}
        n = 0
        for code, patch in ov.items():
            if code in by:
                by[code]["indicators"].update(patch)
                n += 1
        print(f"\n→ Applied {n} manual override(s)")

    changes = diff(prev_countries, new_countries)
    if changes:
        print(f"\n{'=' * 52}\nCHANGES SINCE LAST RUN ({len(changes)})\n{'=' * 52}")
        for ch in changes:
            if "indicator" in ch:
                print(f"  {ch['country']}: {ch['indicator']} {ch['from']} → {ch['to']}")
            else:
                print(f"  {ch['country']}: {ch['change']}")
        print("\n  ⚠️  Material changes should trigger a country risk model review.")
    else:
        print("\n→ No material changes since last run.")

    CHANGELOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    json.dump({"generated": TODAY, "changes": changes},
              open(CHANGELOG_FILE, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    for key, ok, name, url in [
        ("fatf", fatf is not None, "FATF public statements (black & grey lists)", FATF_HUB),
        ("eu_hrtc", eu is not None, "EU list of high-risk third countries", EU_HRTC_URL),
        ("cpi", cpi is not None, "Transparency International CPI", "https://www.transparency.org/en/cpi"),
        ("ocindex", oc is not None, "GI-TOC Global Organized Crime Index", "https://ocindex.net/downloads"),
    ]:
        e = sources.get(key, {})
        e["name"], e["url"] = name, url
        if ok:
            e["as_of"], e["status"] = TODAY, "fetched"
        else:
            e["status"] = "STALE — fetch failed, previous values retained"
        sources[key] = e

    out = {
        "as_of": TODAY,
        "stale_indicators": stale,
        "sources": sources,
        "disclaimer": "Verify against primary sources before operational use. "
                      "Indicators in stale_indicators failed to refresh and retain "
                      "their previous values.",
        "countries": new_countries,
    }
    json.dump(out, open(DATA_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"\n{'=' * 52}")
    print(f"✅ {len(new_countries)} countries → {DATA_FILE}")
    if stale:
        print(f"⚠️  STALE (previous values kept): {', '.join(stale)}")
        print("   Fix the scraper, or patch via manual_overrides.json")
    print(f"📋 Change log → {CHANGELOG_FILE}")


if __name__ == "__main__":
    main()
