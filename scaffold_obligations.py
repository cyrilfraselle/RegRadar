"""
═══════════════════════════════════════════════════════════════════
  SCAFFOLD OBLIGATIONS — génère les squelettes depuis le texte réel
═══════════════════════════════════════════════════════════════════

  POURQUOI CE SCRIPT EXISTE
  Pour passer de 14 à ~100 obligations, on ne réécrit rien à la main et
  surtout on n'invente aucun numéro d'article. Le script lit le JSON
  CELLAR (texte officiel) et produit un squelette par article/paragraphe
  du chapitre visé, avec :
      - source + verbatim      → REMPLIS depuis le texte officiel
      - obligation (actor/modality/action) → PRÉ-REMPLIS par détection
      - applicability / temporal / delta    → laissés en TODO

  Les champs TODO sont la couche jugement : c'est TON travail, et c'est
  précisément ce qui a de la valeur. Le script fait la plomberie.

  UTILISATION
      python3 scaffold_obligations.py \
          --cellar ../docs/data/laws/32024R1624_EN.json \
          --chapter III \
          --existing amlr_chapter3_with_deltas.json \
          --out amlr_chapter3_scaffold.json

  --existing (optionnel) : les obligations déjà modélisées ne sont pas
  redupliquées ; le script signale simplement ce qui reste à faire.
═══════════════════════════════════════════════════════════════════
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Verbes modaux du droit de l'UE, par ordre de priorité de détection.
MODALITIES = [
    ("shall not", "shall not"),
    ("may not", "shall not"),
    ("shall", "shall"),
    ("must", "shall"),
    ("may", "may"),
    ("should", "should"),
]

# Acteurs les plus fréquents dans l'AMLR.
ACTORS = [
    "obliged entities", "obliged entity", "credit institutions",
    "financial institutions", "Member States", "supervisors",
    "FIUs", "AMLA", "the Commission",
]


def split_paragraphs(text: str) -> dict:
    """Découpe un article en paragraphes numérotés ('1.', '2.', …)."""
    paras = {}
    parts = re.split(r"(?m)^\s*(\d+)\.\s+", text or "")
    if len(parts) >= 3:
        it = iter(parts[1:])
        for num, body in zip(it, it):
            paras[num.strip()] = body.strip()
    return paras


def detect_modality(text: str):
    low = (text or "").lower()
    for needle, canonical in MODALITIES:
        if re.search(r"\b" + re.escape(needle) + r"\b", low):
            return canonical
    return None


def detect_actor(text: str):
    low = (text or "").lower()
    for a in ACTORS:
        if a.lower() in low:
            return a.rstrip("s") if a.endswith("ies") is False and a.endswith("s") else a
    return "obliged entity"


def draft_action(text: str, modality: str):
    """
    Extrait une première formulation de l'action : ce qui suit le verbe modal,
    tronqué à la première ponctuation forte. C'est un BROUILLON à corriger.
    """
    if not modality:
        return "TODO — describe the required action"
    m = re.search(re.escape(modality) + r"\s+(.{5,140}?)(?:[;:.]|\bwhere\b|\bwhen\b)", text, re.I | re.S)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    return "TODO — describe the required action"


def detect_condition(text: str):
    """Repère une clause conditionnelle typique ('where…', 'when…')."""
    m = re.search(r"\b(where|when|in the case of|for the purposes of)\b(.{5,120}?)(?:[,;.])", text, re.I | re.S)
    if m:
        return re.sub(r"\s+", " ", (m.group(1) + m.group(2))).strip()
    return "TODO — state the trigger/condition"


def find_chapter_articles(cellar: dict, chapter_hint: str):
    """
    Retourne les articles appartenant au chapitre demandé, en s'appuyant sur
    le champ 'chapter' que parse_laws.py pose sur chaque article
    (ex. 'Chapter III — CUSTOMER DUE DILIGENCE').
    """
    hint = (chapter_hint or "").strip().lower()
    out = []
    for art in cellar.get("articles", []):
        ch = (art.get("chapter") or "").lower()
        if not hint or hint in ch:
            out.append(art)
    return out


def build_skeleton(celex, art, para_no, para_text, title):
    modality = detect_modality(para_text)
    oid = f"{celex_short(celex)}_art{art}" + (f"_{para_no}" if para_no else "")
    return {
        "id": oid,
        "_status": "SCAFFOLD — judgment fields need review",
        "source": {
            "celex": celex,
            "article": str(art),
            **({"paragraph": str(para_no)} if para_no else {}),
            "article_title": title,
            "verbatim": para_text.strip(),
        },
        "obligation": {
            "actor": detect_actor(para_text),
            "modality": modality or "TODO",
            "action": draft_action(para_text, modality),
            "condition": detect_condition(para_text),
            "object": "TODO",
        },
        "sub_requirements": extract_sub_requirements(para_text),
        "applicability": {
            "entity_types": ["TODO"],
            "activities": ["TODO"],
            "triggers": ["TODO"],
            "jurisdiction": "EU",
            "carve_outs": [],
        },
        "temporal": {
            "applies_from": "2027-07-10",
            "supersedes": [],           # ← TODO: which AMLD article does this replace?
            "status": "future",
        },
        "classification": {
            "type": "TODO",             # definition | process | prohibition | reporting | record-keeping
            "theme": "CDD",
            "criticality": "TODO",      # high | medium | low
        },
        "delta": {
            "change_type": "TODO",      # new | tightened | carried_over | consolidated | relaxed
            "delta": "TODO — what actually changes vs the AMLD provision it replaces",
            "action": "TODO — what the firm should do about it",
        },
        "links": {"guidance": [], "interpretations": [], "related_obligations": []},
    }


def extract_sub_requirements(text: str):
    """Repère les listes à points (a), (b), (c) — souvent les vraies exigences."""
    subs = re.findall(r"\(([a-z])\)\s*(.{5,180}?)(?=\([a-z]\)|$)", text or "", re.S)
    out = []
    for _letter, body in subs[:12]:
        clean = re.sub(r"\s+", " ", body).strip().rstrip(";,.")
        if len(clean) > 8:
            out.append(clean)
    return out


def celex_short(celex: str) -> str:
    known = {
        "32024R1624": "AMLR", "32024L1640": "AMLD6", "32024R1620": "AMLAR",
        "32022R2554": "DORA", "32023R1114": "MiCA",
    }
    return known.get(celex, celex)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cellar", required=True, help="JSON CELLAR de la régulation")
    ap.add_argument("--chapter", default="III", help="chapitre à traiter (ex. III)")
    ap.add_argument("--existing", help="fichier d'obligations déjà modélisées")
    ap.add_argument("--out", default="scaffold.json")
    ap.add_argument("--per-paragraph", action="store_true", default=True,
                    help="une obligation par paragraphe (défaut) plutôt que par article")
    a = ap.parse_args()

    try:
        cellar = json.load(open(a.cellar, encoding="utf-8"))
    except FileNotFoundError:
        print(f"❌ CELLAR introuvable : {a.cellar}")
        print("   Lance parse_laws.py d'abord, ou corrige le chemin.")
        sys.exit(1)

    celex = cellar.get("celex", "")
    arts = find_chapter_articles(cellar, a.chapter)
    if not arts:
        chapters = sorted({(x.get("chapter") or "—") for x in cellar.get("articles", [])})
        print(f"❌ Aucun article trouvé pour le chapitre '{a.chapter}'.")
        print("   Chapitres disponibles dans ce fichier :")
        for c in chapters:
            print(f"     · {c}")
        sys.exit(1)

    # Obligations déjà faites → on ne les régénère pas
    done = set()
    if a.existing and Path(a.existing).exists():
        ex = json.load(open(a.existing, encoding="utf-8"))
        blob = json.dumps(ex)
        for m in re.finditer(r'"article":\s*"(\d+)"[^}]*?"paragraph":\s*"(\d+)"', blob):
            done.add((m.group(1), m.group(2)))
        for m in re.finditer(r'"id":\s*"[A-Za-z0-9]+_art(\d+)_(\d+)', blob):
            done.add((m.group(1), m.group(2)))

    skeletons, skipped = [], 0
    for art in arts:
        aid = str(art.get("id", "")).strip()
        title = art.get("title", "")
        paras = split_paragraphs(art.get("text", ""))
        if paras and a.per_paragraph:
            for pno, ptext in sorted(paras.items(), key=lambda kv: int(kv[0])):
                if (aid, pno) in done:
                    skipped += 1
                    continue
                if len(ptext) < 40:      # trop court pour porter une obligation
                    continue
                skeletons.append(build_skeleton(celex, aid, pno, ptext, title))
        else:
            if (aid, "") in done:
                skipped += 1
                continue
            skeletons.append(build_skeleton(celex, aid, None, art.get("text", ""), title))

    out = {
        "_meta": {
            "regulation": celex_short(celex),
            "celex": celex,
            "chapter": a.chapter,
            "generated_from": "CELLAR (official EU Publications Office text)",
            "note": ("Squelettes générés automatiquement. Les champs 'TODO' sont la couche "
                     "jugement (applicability, supersedes, delta, criticality) et doivent être "
                     "validés par un praticien avant toute publication."),
            "articles_in_chapter": len(arts),
            "skeletons": len(skeletons),
            "already_modelled_skipped": skipped,
        },
        "obligations": skeletons,
    }
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"→ Chapitre {a.chapter} : {len(arts)} articles trouvés")
    print(f"✅ {len(skeletons)} squelette(s) générés → {a.out}")
    if skipped:
        print(f"   ({skipped} déjà modélisé(s), non reproduits)")
    todo = sum(1 for s in skeletons if s["obligation"]["modality"] == "TODO")
    print(f"\n   Modalité détectée automatiquement : {len(skeletons)-todo}/{len(skeletons)}")
    print("   À compléter à la main : applicability · supersedes · delta · criticality")
    print("\n   C'est la partie qui a de la valeur — le script n'a fait que la plomberie.")


if __name__ == "__main__":
    main()
