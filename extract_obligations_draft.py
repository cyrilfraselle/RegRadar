#!/usr/bin/env python3
"""Deterministic bulk extractor of DRAFT obligation units (stdlib only).

Reads docs/data/laws/<celex>_EN.json and writes
  docs/data/obligations-draft.json        (draft records, status 'draft')
  docs/data/obligations-review-queue.json (priority-ordered ids for promotion)
It never reads or writes docs/data/obligations.json except to look up verified ids.

Rules (documented in strategy/obligations-bulk.md, summarised here):
 SKIP-ARTICLE  articles that only define, scope or enter into force (SKIP_ARTICLES, SKIP_TITLE).
 UNIT          a numbered paragraph is split into plain lines and sentences; a sentence that ends a
               line followed by lettered/numbered points is a LEAD-IN. A unit is
                 (a) a sentence with an obligation marker (lead-in + its points, joined verbatim), or
                 (b) when the lead-in has no marker, each top-level point that has a marker (-pt<x>).
 MARKER        shall / must / is|are prohibited|required|obliged / be required to, minus
               carve-outs: 'This Regulation shall apply', 'shall not apply|prohibit|preclude|affect|
               prejudice', 'shall be considered|deemed|understood|construed|interpreted'.
 SKIP-SENTENCE rulemaking mandates (AMLA/Commission/EBA shall develop or adopt RTS, ITS, delegated or
               implementing acts, guidelines) are not duties of obliged entities: counted, not emitted.
 BINDS         the actor term nearest before the marker; else any term in the sentence; else the
               paragraph/lead-in; else 'unspecified'.
Nothing is paraphrased: 'text' is a verbatim substring of the article (whitespace normalised).
"""
import json, re, os, sys, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, "docs", "data")
VERSION = 1

LAWS = [  # celex, id prefix, short name, binds-filter
    ("32024R1624", "AMLR", "AMLR", None),
    ("32023R1113", "TFR", "TFR", "obliged_entity"),
    ("32024L1640", "AMLD6", "AMLD6", "obliged_entity"),
]
SKIP_ARTICLES = {  # (celex, article): reason
    ("32024R1624", "1"): "subject matter only",
    ("32024R1624", "2"): "definitions only",
    ("32024R1624", "3"): "list of obliged entities (scope; used for applicability hints)",
}
SKIP_TITLE = re.compile(r"^(Subject matter|Definitions?|Scope|Exercise of the delegation|Committee procedure|Review|Reports?|"
                        r"Relation to|Entry into force|Repeal|Amendments? to|Transposition|Transitional|Evaluation|"
                        r"Amendment of|Final provisions|Addressees)", re.I)

MARKER = re.compile(r"\b(shall|must)\b|\b(?:is|are)\s+(?:prohibited|required|obliged|not permitted)\b|\bbe required to\b", re.I)
CARVEOUT = re.compile(
    r"(?:this (?:regulation|directive|article|paragraph|chapter|section)|paragraph\s+\d+|point\s+\([a-z]\))\s+shall\s+(?:apply|enter|be binding)"
    r"|shall not constitute|shall be (?:permitted|able|allowed|entitled|free) to|shall be (?:the|those) natural person|shall not (?:apply|prohibit|preclude|affect|prejudice|be construed|be understood|be interpreted)"
    r"|shall (?:be )?(?:considered|deemed|understood|construed|interpreted|mean)\b", re.I)
RULEMAKING = re.compile(r"^(?:that|those|the|such)\s+(?:draft\s+)?(?:delegated acts?|implementing acts?|implementing technical standards|regulatory technical standards|guidelines)\b", re.I)
COMMISSION_POWER = re.compile(r"by means of (?:an? )?(?:implementing|delegated) act|(?:identified|designated|adopted|determined) by the Commission", re.I)
PROCEDURAL = re.compile(r"examination procedure|shall be adopted in accordance|shall enter into force|shall be assisted by a committee|committee referred to", re.I)
MANDATE = re.compile(r"regulatory technical standards|implementing technical standards|implementing acts?|delegated acts?|"
                     r"\bguidelines\b|draft (?:regulatory|implementing)|\bis empowered to adopt", re.I)

# who it binds: (id, regex). Order is irrelevant; nearest to the marker wins.
ACTORS = [
    ("obliged_entity", r"obliged entit|credit institution|financial institution|payment service provider|crypto-asset service provider|"
                       r"parent undertaking|providers? of gambling|compliance (?:manager|officer|function)|senior management|\\bCASPs?\\b|investment firm|intermediary|institution\b|insurance (?:undertaking|intermediar)|"
                       r"\bthey\b(?=\s+shall)"),
    ("member_state", r"member states?"),
    ("supervisor", r"supervisor|competent authorit|self-regulatory bod"),
    ("fiu", r"\bFIUs?\b|financial intelligence unit"),
    ("amla", r"\bAMLA\b|\bthe authority\b|\bauthority shall"),
    ("commission", r"\bthe commission\b"),
    ("legal_entity", r"legal entit|legal arrangement|trustee|nominee|corporate and other|\bbeneficial owners? shall|\bsettlors?\b"),
    ("register", r"central register|registers?\b"),
    ("law_enforcement", r"europol|eppo|olaf|law enforcement"),
]
# applicability hints: ONLY entity terms that the unit text names explicitly (ids of applicability.json)
ENTITY_TERMS = [
    ("bank", r"credit institution"),
    ("casp", r"crypto-asset service provider|\bCASPs?\b"),
    ("pi", r"payment institution|payment service provider"),
    ("emi", r"electronic money"),
    ("invfirm", r"investment firm"),
    ("fund", r"collective investment|management compan|\bUCITS\b|alternative investment fund"),
    ("insurer", r"insurance undertaking|life insurance|insurance intermediar"),
]
# topic rules for articles not mapped in topics.json (parent topic ids of topics.json)
TOPIC_RULES = [
    ("pep", r"politically exposed|prominent public|family members"),
    ("third", r"third countr|correspondent"),
    ("crypto", r"crypto|anonymous|self-hosted|cash payments|bearer"),
    ("bo", r"beneficial|trustee|nominee|legal entit|legal arrangement"),
    ("str", r"suspici|FIU|disclosure|refrain|threshold-based|tipping"),
    ("rec", r"record|personal data|data protection"),
    ("train", r"awareness|integrity|training|employees"),
    ("gov", r"risk assessment|policies|compliance function|group|outsourc|internal|breaches|branches"),
    ("cdd", r"due diligence|customer|identif|reliance|monitoring|verification|discrepanc"),
]
CHAPTER_TOPIC = {"IV": "bo", "V": "str", "VI": "str", "VII": "rec", "VIII": "crypto", "II": "gov", "III": "cdd"}

NBSP = " "
def norm(t):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), (NBSP, " "), ("‑", "-"), ("‐", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip()

POINT = re.compile(r"^\(([a-z]{1,4}|\d{1,3})\)$")
PARA = re.compile(r"^(\d{1,3})\.[\s ]+")
SENT = re.compile(r"(?<=[a-z0-9\)\]’”%])\.\s+(?=[A-Z“‘(])")

def split_sentences(line):
    out, start = [], 0
    for m in SENT.finditer(line):
        before = line[start:m.start()]
        if re.search(r"(?:\be\.g|\bi\.e|\bNo|\bNos|\bArt)$", before):
            continue
        out.append(line[start:m.start() + 1]); start = m.end()
    out.append(line[start:])
    return [s for s in out if s.strip()]

def split_paragraphs(text):
    """-> list of (k or None, [lines]) ; paragraph numbers must run 1,2,3..."""
    lines = text.split("\n")
    paras, cur, expect = [], None, 1
    for ln in lines:
        m = PARA.match(ln)
        if m and int(m.group(1)) == expect:
            cur = [int(m.group(1)), [ln[m.end():]]]; paras.append(cur); expect += 1
        elif cur is None:
            cur = [None, [ln]]; paras.append(cur)
        else:
            cur[1].append(ln)
    return paras

def blocks(lines):
    """-> list of ('line', text) | ('point', letter, text) ; nested markers are kept as flat tokens."""
    out, i = [], 0
    while i < len(lines):
        ln = lines[i].strip()
        m = POINT.match(ln)
        if m and i + 1 < len(lines):
            out.append(("point", m.group(1), lines[i + 1].strip())); i += 2
        else:
            if ln: out.append(("line", ln))
            i += 1
    return out

def is_roman(x): return x in ("i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x")

def top_points(toks):
    tops, last = [], None
    for t in toks:
        m = t[1]
        if m.isdigit():
            level = "d"
        else:
            level = "a"
            if is_roman(m) and not (last == chr(ord(m[0]) - 1) and len(m) == 1 and m in ("i", "v", "x")) and tops:
                level = "r"
            if m == "i" and last == "h": level = "a"
        first_level = tops[0]["level"] if tops else level
        if tops and level != first_level:
            tops[-1]["nested"].append(t)
        else:
            tops.append({"m": m, "level": level, "text": t[2], "nested": []})
            last = m if len(m) == 1 else last
    return tops

def pt_text(p):
    parts = ["(%s) %s" % (p["m"], p["text"])]
    for n in p["nested"]: parts.append("(%s) %s" % (n[1], n[2]))
    return " ".join(parts)

def has_marker(s):
    return bool(MARKER.search(s)) and not CARVEOUT.search(s)

def binds_of(sentence, context=""):
    m = MARKER.search(sentence)
    prefix = sentence[:m.start()] if m else sentence
    def nearest(txt):
        best = None
        for aid, rx in ACTORS:
            for mm in re.finditer(rx, txt, re.I):
                if best is None or mm.start() > best[0]: best = (mm.start(), aid)
        return best[1] if best else None
    a = nearest(prefix)
    if a: return [a], "subject"
    hits = [aid for aid, rx in ACTORS if re.search(rx, sentence, re.I)]
    if hits: return hits[:2], "sentence"
    if context:
        a = nearest(context)
        if a: return [a], "context"
    return ["unspecified"], "unspecified"

def entity_hints(text):
    ids = [i for i, rx in ENTITY_TERMS if re.search(rx, text, re.I)]
    return ids

def load_topics():
    t = json.load(open(os.path.join(D, "topics.json")))
    m = {}
    for top in t["topics"]:
        for ch in top.get("children", []):
            for ex in ch.get("extracts", []):
                m.setdefault((ex["celex"], ex["article"]), []).append(
                    {"topic": top["id"], "subtopic": ch["id"], "paragraph": ex.get("paragraph"), "obligations": ch.get("obligations", [])})
            for fld in ("amla_mandates", "mandates"):
                for ex in ch.get(fld, []) or []:
                    pass
    return m

def rule_topics(celex, art_title, chapter):
    tags = []
    for tid, rx in TOPIC_RULES:
        if re.search(rx, art_title, re.I): tags.append(tid); break
    if not tags:
        m = re.match(r"Chapter ([IVX]+)", chapter or "")
        if m and m.group(1) in CHAPTER_TOPIC: tags.append(CHAPTER_TOPIC[m.group(1)])
    if celex == "32023R1113" and "crypto" not in tags: tags.append("crypto")
    return tags

def extract_law(celex, prefix, short, binds_filter, tmap, verified):
    law = json.load(open(os.path.join(D, "laws", celex + "_EN.json")))
    recs, stats = [], {"articles": len(law["articles"]), "articles_skipped": [], "articles_with_units": 0,
                       "sentences_skipped_mandate": 0, "units": 0, "filtered_out_by_binds": 0}
    for art in law["articles"]:
        aid, title = art["id"], " ".join(art["title"].split())
        key = (celex, aid)
        if key in SKIP_ARTICLES:
            stats["articles_skipped"].append({"article": aid, "title": title, "rule": SKIP_ARTICLES[key]}); continue
        if SKIP_TITLE.match(title):
            stats["articles_skipped"].append({"article": aid, "title": title, "rule": "title rule SKIP_TITLE (procedural / final provisions)"}); continue
        mapped = tmap.get(key, [])
        n_art = 0
        for k, lines in split_paragraphs(art["text"]):
            toks = blocks(lines)
            sn = 0
            def emit(sid, ptm, text, ctx):
                nonlocal n_art
                text = norm(text)
                binds, basis = binds_of(text, ctx)
                if RULEMAKING.search(text):
                    stats["sentences_skipped_mandate"] += 1; return
                if COMMISSION_POWER.search(text):
                    stats["sentences_skipped_mandate"] += 1; return
                if PROCEDURAL.search(text):
                    stats["sentences_skipped_procedural"] = stats.get("sentences_skipped_procedural", 0) + 1; return
                if MANDATE.search(text) and binds[0] in ("commission", "amla"):
                    stats["sentences_skipped_mandate"] += 1; return
                if binds_filter and binds_filter not in binds:
                    stats["filtered_out_by_binds"] += 1; return
                rid = "%s-art%s-p%s" % (prefix, aid, k if k else 1)
                if sid > 1: rid += "-s%d" % sid
                if ptm: rid += "-pt%s" % ptm
                tags = [x["subtopic"] for x in mapped if x["paragraph"] in (None, str(k) if k else None)] or []
                parents = sorted({x["topic"] for x in mapped if x["paragraph"] in (None, str(k) if k else None)})
                if mapped and not tags: parents = sorted({x["topic"] for x in mapped}); tags = []
                tsrc = "topics.json" if mapped else "rule"
                if not mapped: parents = rule_topics(celex, title, art.get("chapter", ""))
                recs.append({
                    "id": rid, "law": short, "celex": celex, "article": aid, "title": title,
                    "locator": {"article": aid, "paragraph": str(k) if k else None, "point": ptm, "sentence": sid,
                                "text": "%s Art. %s%s%s" % (short, aid, "(%d)" % k if k else "", "(%s)" % ptm if ptm else "")},
                    "text": text, "binds": binds, "binds_basis": basis,
                    "topics": parents, "subtopics": sorted(set(tags)), "topic_source": tsrc,
                    "applies_to_hint": entity_hints(text),
                    "verified_ids": [v for v in verified if v == "%s-art%s" % (prefix, aid)],
                    "status": "draft"})
                n_art += 1
            i = 0
            while i < len(toks):
                t = toks[i]
                if t[0] != "line": i += 1; continue
                j = i + 1; pts = []
                while j < len(toks) and toks[j][0] == "point": pts.append(toks[j]); j += 1
                sents = split_sentences(t[1])
                for si, s in enumerate(sents):
                    sn += 1
                    last = si == len(sents) - 1
                    if last and pts:
                        tops = top_points(pts)
                        full = s + " " + " ".join(pt_text(p) for p in tops)
                        if has_marker(s):
                            emit(sn, None, full if len(full) <= 3000 else s, "")
                        else:
                            for p in tops:
                                pt = pt_text(p)
                                if has_marker(pt) or has_marker(p["text"]):
                                    emit(sn, p["m"], p["text"] if not p["nested"] else " ".join([p["text"]] + ["(%s) %s" % (n[1], n[2]) for n in p["nested"]]), s)
                    elif has_marker(s):
                        emit(sn, None, s, "")
                i = j
        if n_art: stats["articles_with_units"] += 1
    stats["units"] = len(recs)
    return recs, stats

def main():
    tmap = load_topics()
    verified = [o["id"] for o in json.load(open(os.path.join(D, "obligations.json")))["obligations"]]
    allrecs, perlaw = [], {}
    for celex, prefix, short, bf in LAWS:
        recs, st = extract_law(celex, prefix, short, bf, tmap, verified)
        allrecs += recs; perlaw[short] = st
    ids = [r["id"] for r in allrecs]
    assert len(ids) == len(set(ids)), "duplicate ids"
    law_order = {s: i for i, (_, _, s, _) in enumerate(LAWS)}
    def sortkey(r):
        L = r["locator"]
        return (law_order[r["law"]], int(r["article"]), int(L["paragraph"] or 0), L["sentence"], L["point"] or "")
    allrecs.sort(key=sortkey)
    today = datetime.date.today().isoformat()
    out = {"_meta": {
        "name": "Draft obligations (bulk extraction)", "version": VERSION, "generated": today,
        "status": "draft, not reviewed",
        "method": "Deterministic rule-based extraction by extract_obligations_draft.py from docs/data/laws/<celex>_EN.json. "
                  "A unit is a sentence (or lead-in with its points, or a single point) containing an obligation marker. "
                  "'text' is verbatim from the law (whitespace normalised), never paraphrased. binds, topics and applies_to_hint are rule-based "
                  "(see strategy/obligations-bulk.md). A unit is not always one obligation: many obligations span paragraphs.",
        "disclaimer": "DRAFT, NOT REVIEWED. Not legal advice and not part of the verified register (docs/data/obligations.json). "
                      "Nothing here is verified until the independent legal fact-check promotes it.",
        "count": len(allrecs), "per_law": perlaw,
        "counts_by_law": {s: sum(1 for r in allrecs if r["law"] == s) for _, _, s, _ in LAWS},
        "verified_register_untouched": True},
        "obligations": allrecs}
    json.dump(out, open(os.path.join(D, "obligations-draft.json"), "w"), ensure_ascii=False, indent=1)
    # review queue
    mapped_arts = {k for k in tmap}
    def tier(r):
        if (r["celex"], r["article"]) in mapped_arts: return 0
        return 1 if "obliged_entity" in r["binds"] else 2
    q = sorted(allrecs, key=lambda r: (tier(r), sortkey(r)))
    why = {0: "article already mapped in topics.json", 1: "binds obliged entities, not yet in topics.json", 2: "binds another actor (Member State, supervisor, FIU, AMLA ...)"}
    queue = {"_meta": {"name": "Obligations review queue", "generated": today, "status": "draft, not reviewed",
                       "order": "tier 0 (article mapped in topics.json) first, then tier 1 (binds obliged entities), then tier 2; inside a tier AMLR, TFR, AMLD6 and article order. "
                                "Suggested batches of 25.",
                       "count": len(q), "tiers": {str(t): sum(1 for r in q if tier(r) == t) for t in (0, 1, 2)}, "tier_meaning": {str(k): v for k, v in why.items()},
                       "how_to_promote": "See strategy/obligations-bulk.md."},
             "queue": [{"rank": i + 1, "batch": i // 25 + 1, "id": r["id"], "tier": tier(r), "law": r["law"], "locator": r["locator"]["text"],
                        "binds": r["binds"], "topics": r["topics"], "verified_ids": r["verified_ids"], "review": "pending"} for i, r in enumerate(q)]}
    json.dump(queue, open(os.path.join(D, "obligations-review-queue.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(out["_meta"]["counts_by_law"]), {k: (v["articles_with_units"], v["articles"], v["sentences_skipped_mandate"]) for k, v in perlaw.items()})

if __name__ == "__main__":
    main()
