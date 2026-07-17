"""
═══════════════════════════════════════════════════════════════════
  PARSE LAWS — Génère les données "Read the Law" depuis CELLAR
═══════════════════════════════════════════════════════════════════

  SOURCE : CELLAR, l'API officielle du Publications Office de l'UE.
  Pas de scraping, pas d'anti-bot, pas de clé, pas de compte.
  Contrairement à la page HTML EUR-Lex (qui renvoie un challenge
  anti-bot 202 aux IP datacenter), CELLAR est fait pour être interrogé
  par des machines → devrait marcher AUSSI depuis GitHub Actions.

  INSTALLATION (une fois) :
      pip3 install requests beautifulsoup4

  UTILISATION :
      python3 parse_laws.py            # les 5 régulations, EN/FR/NL
      python3 parse_laws.py --debug    # sauve le XHTML brut pour diagnostic

  Les fichiers sont écrits dans docs/data/laws/ ; pousse-les sur GitHub.
  Si un acte sort "0 article", relance avec --debug et envoie le
  fichier debug_cellar_*.html pour ajuster le parsing (comme on l'a
  fait pour les scrapers pays).
═══════════════════════════════════════════════════════════════════
"""

import json
import sys
import time
from pathlib import Path

# ── Les régulations à parser ─────────────────────────────────────
# Ajoute/retire des lignes ici. Trouve le CELEX sur eur-lex.europa.eu
# (affiché en haut de chaque document, ex: 32022R2554 pour DORA).
REGULATIONS = [
    # ── AML / CFT ──
    {"celex": "32024R1624", "name": "AMLR",     "full_name": "Anti-Money Laundering Regulation",             "topic": "AML/CFT"},
    {"celex": "32024L1640", "name": "AMLD6",    "full_name": "6th Anti-Money Laundering Directive",          "topic": "AML/CFT"},
    {"celex": "32024R1620", "name": "AMLAR",    "full_name": "Anti-Money Laundering Authority Regulation",   "topic": "AML/CFT"},
    {"celex": "32023R1113", "name": "TFR",      "full_name": "Transfer of Funds Regulation (recast)",        "topic": "AML/CFT"},
    # ── Operational resilience / ICT ──
    {"celex": "32022R2554", "name": "DORA",     "full_name": "Digital Operational Resilience Act",           "topic": "Operational Resilience"},
    {"celex": "32022L2555", "name": "NIS2",     "full_name": "NIS2 Directive (network & information security)","topic": "Operational Resilience"},
    # ── Markets & instruments ──
    {"celex": "32023R1114", "name": "MiCA",     "full_name": "Markets in Crypto-Assets Regulation",          "topic": "Crypto"},
    {"celex": "32014L0065", "name": "MiFID II", "full_name": "Markets in Financial Instruments Directive II", "topic": "Markets"},
    {"celex": "32014R0600", "name": "MiFIR",    "full_name": "Markets in Financial Instruments Regulation",   "topic": "Markets"},
    {"celex": "32014R0596", "name": "MAR",      "full_name": "Market Abuse Regulation",                      "topic": "Markets"},
    # ── Prudential ──
    {"celex": "32013R0575", "name": "CRR",      "full_name": "Capital Requirements Regulation",             "topic": "Capital"},
    {"celex": "32013L0036", "name": "CRD IV",   "full_name": "Capital Requirements Directive IV",           "topic": "Capital"},
    # ── Payments ──
    {"celex": "32015L2366", "name": "PSD2",     "full_name": "Payment Services Directive 2",                "topic": "Payments"},
    {"celex": "32009L0110", "name": "EMD2",     "full_name": "E-Money Directive 2",                         "topic": "Payments"},
    # ── Data ──
    {"celex": "32016R0679", "name": "GDPR",     "full_name": "General Data Protection Regulation",          "topic": "Data Protection"},
]

LANGUAGES = ["EN", "FR", "NL"]   # langues à récupérer depuis CELLAR
LANG3 = {"EN": "eng", "FR": "fra", "NL": "nld"}
OUT_DIR = Path("docs/data/laws")
EURLEX_URL = "https://eur-lex.europa.eu/legal-content/{}/TXT/?uri=CELEX:{}"
CELLAR_URL = "https://publications.europa.eu/resource/celex/{}"
DEBUG = "--debug" in sys.argv


def _fetch_cellar(celex: str, lang: str) -> str | None:
    """
    Récupère le texte intégral d'un acte via CELLAR (API officielle du
    Publications Office). Pas de scraping, pas d'anti-bot, pas de clé.
    Content negotiation : on demande le XHTML dans la langue voulue.
    """
    import requests
    url = CELLAR_URL.format(celex)
    headers = {
        "Accept": "application/xhtml+xml",
        "Accept-Language": LANG3.get(lang, "eng"),
        "User-Agent": "RegRadar/1.0 (regulatory watch; contact via GitHub)",
    }
    try:
        r = requests.get(url, headers=headers, timeout=60)
        if r.status_code != 200 or len(r.text) < 5000:
            print(f"    ! CELLAR HTTP {r.status_code}, {len(r.text)} chars")
            return None
        if DEBUG:
            Path(f"debug_cellar_{celex}_{lang}.html").write_text(r.text, encoding="utf-8")
        return r.text
    except Exception as e:
        print(f"    ! CELLAR fetch échoué: {type(e).__name__}: {str(e)[:70]}")
        return None


def _parse_articles_from_html(html: str) -> tuple[str, list]:
    """
    Extrait le titre de l'acte, les articles et les chapitres depuis le
    XHTML CELLAR (structure ELI). Chaque article = <div id="art_N">, son
    titre = <div id="art_N.tit_1">. Chaque chapitre = <div id="cpt_X">,
    titre = <div id="cpt_X.tit_1">.
    """
    from bs4 import BeautifulSoup
    import re
    soup = BeautifulSoup(html, "html.parser")

    # Titre de l'acte
    title = ""
    t = soup.find("div", id="tit_1")
    if t:
        title = t.get_text(" ", strip=True)
    if not title:
        for sel in [".eli-main-title", ".doc-ti", "title", "h1"]:
            el = soup.select_one(sel)
            if el and el.get_text(strip=True):
                title = el.get_text(" ", strip=True)
                break

    # Carte article → chapitre : pour chaque chapitre, quels articles il contient
    # Les actes de l'UE se structurent en TITRES (tis_X), en CHAPITRES
    # (cpt_X ou tis_X.cpt_Y quand nichés dans un titre), ou les deux. On
    # repère tous les conteneurs de regroupement et, pour chaque article,
    # on prend le regroupement le plus profond qui le contient.
    art_to_chapter = {}

    def _label(gid):
        # extrait le numéro romain/arabe de la division la plus à droite
        last = gid.split(".")[-1]
        m = re.search(r"(?:tis|tit|cpt)_([IVXLC0-9]+)", last, re.I)
        kind = "Title" if last.lower().startswith("tis") else "Chapter"
        return f"{kind} {m.group(1)}" if m else last

    groupings = []  # (dom_id, depth) — depth: title=1, chapter=2
    # Titres : tis_X (exact)
    for tis in soup.find_all("div", id=re.compile(r"^tis_[IVXLC0-9]+$", re.I)):
        groupings.append((tis.get("id"), 1))
    # Chapitres : cpt_X (exact) OU tis_X.cpt_Y (nichés) — chiffres romains ou arabes
    for cpt in soup.find_all("div", id=re.compile(r"^(?:tis_[IVXLC0-9]+\.)?cpt_[IVXLC0-9]+$", re.I)):
        groupings.append((cpt.get("id"), 2))

    def _grouping_title(gid):
        tel = soup.find("div", id=f"{gid}.tit_1")
        gtitle = tel.get_text(" ", strip=True) if tel else ""
        lbl = _label(gid)
        return f"{lbl} — {gtitle}" if gtitle else lbl

    # Pour chaque article, choisir le regroupement le plus profond qui le contient
    for div in soup.find_all("div", id=re.compile(r"^art_\d+$")):
        art_id = div.get("id")
        best = None  # (gid, depth)
        for gid, depth in groupings:
            g = soup.find("div", id=gid)
            if g and g.find("div", id=art_id):
                if best is None or depth > best[1]:
                    best = (gid, depth)
        if best:
            art_to_chapter[art_id] = _grouping_title(best[0])

    # Articles : uniquement les id='art_N' EXACTS (pas art_N.tit_1)
    articles = []
    for div in soup.find_all("div", id=re.compile(r"^art_\d+$")):
        art_dom_id = div.get("id")
        num_m = re.search(r"art_(\d+)", art_dom_id)
        if not num_m:
            continue
        art_id = num_m.group(1)
        tit_el = soup.find("div", id=f"{art_dom_id}.tit_1")
        atitle = tit_el.get_text(" ", strip=True) if tit_el else ""
        # texte de l'article, nettoyé ; on retire le "Article N" et le titre en tête
        text = div.get_text("\n", strip=True)
        text = re.sub(r"^Article\s+\d+\s*\n", "", text)
        if atitle:
            text = re.sub(r"^" + re.escape(atitle) + r"\s*\n", "", text)
        text = re.sub(r"\n{2,}", "\n", text).strip()
        articles.append({
            "id": art_id,
            "title": atitle,
            "text": text,
            "chapter": art_to_chapter.get(art_dom_id, ""),
        })

    return title, articles


def parse_one(reg: dict, lang: str = "EN") -> dict | None:
    """Parse une régulation depuis CELLAR (API officielle), dans une langue donnée."""
    celex = reg["celex"]
    print(f"  → {reg['name']} ({celex}) [{lang}]… ", end="", flush=True)

    html = _fetch_cellar(celex, lang)
    if not html:
        print("échec fetch")
        return None

    doc_title, articles_raw = _parse_articles_from_html(html)
    if not articles_raw:
        print("0 article (structure XHTML non reconnue — relance avec --debug)")
        return None

    # Normaliser les articles + détecter refs croisées
    articles = []
    for a in articles_raw:
        text = (a.get("text") or "").strip()
        articles.append({
            "id": str(a.get("id", "")).strip(),
            "title": (a.get("title") or "").strip(),
            "text": text,
            "refs": _extract_refs(a.get("references", [])),
            "chapter": a.get("chapter", ""),
            "law_refs": _extract_law_refs(text),
        })

    definitions = _extract_definitions(articles)
    chapters = _build_chapters(articles)

    result = {
        "celex": celex,
        "name": reg["name"],
        "full_name": reg["full_name"],
        "topic": reg["topic"],
        "title": (doc_title or reg["full_name"]).strip(),
        "lang": lang,
        "url": EURLEX_URL.format(lang, celex),
        "source": "CELLAR (Publications Office of the EU)",
        "dates": _extract_dates_cellar(celex),
        "definitions": definitions,
        "chapters": chapters,
        "articles": articles,
    }
    print(f"✅ {len(articles)} articles, {len(definitions)} définitions, {len(chapters)} chapitres")
    return result


def _extract_dates_cellar(celex: str) -> dict:
    """Récupère les dates clés via SPARQL CELLAR (publication, en vigueur, application)."""
    import requests
    q = f"""
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT ?dd ?inforce ?app WHERE {{
      ?w cdm:resource_legal_id_celex "{celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
      OPTIONAL {{ ?w cdm:work_date_document ?dd }}
      OPTIONAL {{ ?w cdm:resource_legal_date_entry-into-force ?inforce }}
      OPTIONAL {{ ?w cdm:resource_legal_date_application ?app }}
    }} LIMIT 1
    """
    try:
        r = requests.get("https://publications.europa.eu/webapi/rdf/sparql",
                         params={"query": q, "format": "application/sparql-results+json"},
                         headers={"Accept": "application/sparql-results+json"}, timeout=45)
        if r.status_code == 200:
            b = r.json().get("results", {}).get("bindings", [])
            if b:
                row = b[0]
                return {
                    "published": row.get("dd", {}).get("value", ""),
                    "entry_into_force": row.get("inforce", {}).get("value", ""),
                    "application": row.get("app", {}).get("value", ""),
                }
    except Exception:
        pass
    return {"published": "", "entry_into_force": "", "application": ""}


def _extract_refs(references) -> list:
    """Extrait les numéros d'articles référencés (best-effort)."""
    refs = []
    for r in (references or []):
        # Les références sont souvent du texte libre ; on garde simple
        if isinstance(r, str) and "Article" in r:
            import re
            m = re.search(r"Article\s+(\d+)", r)
            if m:
                refs.append(m.group(1))
    return list(dict.fromkeys(refs))[:6]  # dédup, max 6



def _extract_definitions(articles: list) -> list:
    """Extrait les définitions depuis l'article intitulé 'Definitions'."""
    import re
    defs = []
    for a in articles:
        if "definition" in (a.get("title","").lower()):
            text = a.get("text","")
            # Format typique : (1) 'terme' means définition;
            for m in re.finditer(r"[\u2018\u2019'\"]([^\u2018\u2019'\"]+)[\u2018\u2019'\"]\s+means\s+([^;]+)", text):
                term = m.group(1).strip()
                definition = m.group(2).strip()
                if term and definition and len(term) < 60:
                    defs.append({"term": term, "definition": definition + "."})
            break
    return defs[:200]


def _extract_law_refs(text: str) -> list:
    """Détecte les références à d'autres règlements/directives EU dans le texte."""
    import re
    refs = []
    seen = set()
    # Regulation (EU) No 575/2013  →  CELEX 32013R0575
    for m in re.finditer(r"Regulation \(EU\)(?:\s+No)?\s+(\d+)/(\d{4})", text):
        num, year = m.group(1), m.group(2)
        celex = f"3{year}R{int(num):04d}"
        if celex not in seen:
            seen.add(celex)
            refs.append({"celex": celex, "text": m.group(0), "label": m.group(0)})
    # Directive 2013/36/EU  →  CELEX 32013L0036
    for m in re.finditer(r"Directive (\d{4})/(\d+)/E[UC]", text):
        year, num = m.group(1), m.group(2)
        celex = f"3{year}L{int(num):04d}"
        if celex not in seen:
            seen.add(celex)
            refs.append({"celex": celex, "text": m.group(0), "label": m.group(0)})
    return refs


def _build_chapters(articles: list) -> list:
    """Regroupe les articles par chapitre (le libellé complet est déjà sur chaque article)."""
    chapters = []
    current = None
    for a in articles:
        ch = a.get("chapter", "")
        if ch and (not current or current["title"] != ch):
            current = {"id": str(len(chapters) + 1), "title": ch, "articles": []}
            chapters.append(current)
        if current:
            current["articles"].append(a["id"])
    return chapters



def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Parsing {len(REGULATIONS)} régulation(s) depuis CELLAR…\n")

    index = []
    for reg in REGULATIONS:
        langs_ok = []
        base_result = None
        for lang in LANGUAGES:
            try:
                result = parse_one(reg, lang)
            except Exception as e:
                print(f"  ! {reg['name']} [{lang}] a levé une exception: {type(e).__name__}: {str(e)[:70]}")
                result = None
            if result is not None:
                out_file = OUT_DIR / f"{reg['celex']}_{lang}.json"
                json.dump(result, open(out_file, "w", encoding="utf-8"),
                          ensure_ascii=False, indent=2)
                langs_ok.append(lang)
                if lang == "EN" or base_result is None:
                    base_result = result
            time.sleep(1)  # politesse envers CELLAR

        available = len(langs_ok) > 0
        index.append({
            "celex": reg["celex"],
            "name": reg["name"],
            "full_name": reg["full_name"],
            "topic": reg["topic"],
            "dates": base_result.get("dates", {}) if base_result else {},
            "articles": len(base_result["articles"]) if base_result else 0,
            "langs": langs_ok or ["EN"],
            "available": available,
        })

    json.dump(index, open(OUT_DIR / "index.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    ok = sum(1 for i in index if i["available"])
    print(f"\n✅ Terminé : {ok}/{len(REGULATIONS)} régulations parsées.")
    print(f"   Fichiers dans {OUT_DIR}/")
    print(f"   Pousse-les sur GitHub pour mettre à jour le site.")
    if ok < len(REGULATIONS):
        print("\n⚠️  Les régulations à 0 article : EUR-Lex a peut-être changé de format,")
        print("    ou bloqué la requête. Réessaie plus tard, ou vérifie le CELEX.")


if __name__ == "__main__":
    main()
