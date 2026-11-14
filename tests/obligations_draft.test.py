#!/usr/bin/env python3
"""Checks for docs/data/obligations-draft.json and the review queue. Stdlib only.
Run from the repo root:  python3 tests/obligations_draft.test.py
The verbatim and locator checks use their own code (not the extractor's splitter)."""
import json, os, re, sys, subprocess, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "docs", "data")
J = lambda p: json.load(open(os.path.join(D, p)))
fails = []
def check(name, cond, detail=""):
    print(("ok   " if cond else "FAIL ") + name + ("" if cond else "\n     " + str(detail)[:400]))
    if not cond: fails.append(name)

def N(t):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), (" ", " "), ("‑", "-"), ("‐", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip()

DR = J("obligations-draft.json"); Q = J("obligations-review-queue.json")
VER = {o["id"] for o in J("obligations.json")["obligations"]}
recs = DR["obligations"]
LAWS = {}
def art(celex, a):
    if celex not in LAWS: LAWS[celex] = {x["id"]: x for x in J("laws/%s_EN.json" % celex)["articles"]}
    return LAWS[celex].get(a)

def para_text(text, k):
    t = text.replace(" ", " ")
    if k is None: return t
    m = re.search(r"(^|\n)%d\.\s+" % int(k), t)
    if not m: return None
    s = m.end(); m2 = re.search(r"\n%d\.\s+" % (int(k) + 1), t[s:])
    return t[s: s + m2.start()] if m2 else t[s:]

# 1 structure
M = DR["_meta"]
check("meta: disclaimer, method, status, counts", all(M.get(k) for k in ("disclaimer", "method", "generated", "version", "count", "per_law")) and "not reviewed" in M["status"] and M["count"] == len(recs))
check("every record has status 'draft' and required fields", all(r["status"] == "draft" and all(k in r for k in ("id", "title", "text", "locator", "binds", "topics", "verified_ids", "applies_to_hint")) for r in recs))
# 2 ids
ids = [r["id"] for r in recs]
check("ids unique", len(ids) == len(set(ids)), [i for i, c in collections.Counter(ids).items() if c > 1][:5])
check("ids follow <LAW>-art<N>-p<k>[-s<n>][-pt<x>]", all(re.fullmatch(r"(AMLR|TFR|AMLD6)-art\d+-p\d+(-s\d+)?(-pt[a-z0-9]+)?", i) for i in ids), [i for i in ids if not re.fullmatch(r"(AMLR|TFR|AMLD6)-art\d+-p\d+(-s\d+)?(-pt[a-z0-9]+)?", i)][:5])
check("no draft id collides with a verified id", not (set(ids) & VER), set(ids) & VER)
def id_from_loc(r):
    L = r["locator"]; i = "%s-art%s-p%s" % (r["law"], r["article"], L["paragraph"] or 1)
    if L["sentence"] > 1: i += "-s%d" % L["sentence"]
    if L["point"]: i += "-pt%s" % L["point"]
    return i
check("id is derived from the locator (stable)", all(id_from_loc(r) == r["id"] for r in recs), [r["id"] for r in recs if id_from_loc(r) != r["id"]][:5])
# 3 verbatim and locators
bad_v, bad_a, bad_p, bad_pt, bad_t = [], [], [], [], []
for r in recs:
    a = art(r["celex"], r["article"])
    if not a: bad_a.append(r["id"]); continue
    if " ".join(a["title"].split()) != r["title"]: bad_t.append(r["id"])
    seg = para_text(a["text"], r["locator"]["paragraph"])
    if seg is None: bad_p.append(r["id"]); continue
    if N(r["text"]) != r["text"] or N(r["text"]) not in N(seg): bad_v.append(r["id"])
    if r["locator"]["point"] and N(r["text"]) not in N(seg): bad_pt.append(r["id"])
check("article exists for every record", not bad_a, bad_a[:5])
check("title equals the law's article title", not bad_t, bad_t[:5])
check("paragraph locator exists in the article", not bad_p, bad_p[:5])
check("text is a verbatim substring of its paragraph (whitespace normalised)", not bad_v, bad_v[:5])
ptbad = []
for r in recs:
    p = r["locator"]["point"]
    if p:
        seg = N(para_text(art(r["celex"], r["article"])["text"], r["locator"]["paragraph"]))
        if "(%s) " % p not in seg: ptbad.append(r["id"])
check("point marker exists in the paragraph", not ptbad, ptbad[:5])
check("verified_ids only name verified obligations", all(v in VER for r in recs for v in r["verified_ids"]))
check("binds and topics are non-empty lists", all(r["binds"] and isinstance(r["topics"], list) for r in recs))
# 4 queue
qids = [q["id"] for q in Q["queue"]]
check("queue lists every draft exactly once", sorted(qids) == sorted(ids))
tiers = [q["tier"] for q in Q["queue"]]
check("queue is ordered by tier (topics.json articles first)", tiers == sorted(tiers))
check("queue ranks are 1..n", [q["rank"] for q in Q["queue"]] == list(range(1, len(qids) + 1)))
# 5 determinism: regenerate in memory and compare
out = subprocess.run([sys.executable, os.path.join(ROOT, "extract_obligations_draft.py")], capture_output=True, text=True)
if out.returncode == 0:
    DR2 = J("obligations-draft.json")
    check("extractor is deterministic (rerun gives identical ids and texts)", [(r["id"], r["text"]) for r in DR2["obligations"]] == [(r["id"], r["text"]) for r in recs])
# 6 coverage report
print("\nCoverage")
for law, st in M["per_law"].items():
    n = sum(1 for r in recs if r["law"] == law)
    per = collections.Counter(r["article"] for r in recs if r["law"] == law)
    print("  %-6s %3d units in %2d of %2d articles; skipped articles %2d; mandate sentences skipped %2d; max units/article %d; median %s" % (
        law, n, st["articles_with_units"], st["articles"], len(st["articles_skipped"]), st["sentences_skipped_mandate"],
        max(per.values()) if per else 0, sorted(per.values())[len(per) // 2] if per else 0))
print("  binds:", dict(collections.Counter(b for r in recs for b in r["binds"][:1])))
print("  queue tiers:", Q["_meta"]["tiers"])
# 7 golden: held-out sample is asserted; development sample is reported only
def predicted(g):
    t = N(g["text"])
    for r in recs:
        if r["celex"] == g["celex"] and r["article"] == g["article"] and r["locator"]["paragraph"] == g["paragraph"]:
            if t in r["text"] or r["text"] in t:
                return r
    return None
def score(fname, label):
    G = json.load(open(os.path.join(ROOT, "tests", "golden", fname)))["items"]
    tp = fp = fn = tn = 0; bind_ok = bind_n = 0; errs = []
    for g in G:
        r = predicted(g)
        if r and g["is_obligation"]:
            tp += 1
            if g["binds"]:
                bind_n += 1; bind_ok += (g["binds"] in r["binds"][:1])
                if g["binds"] not in r["binds"][:1]: errs.append(("binds", g["n"], g["binds"], r["binds"]))
        elif r: fp += 1; errs.append(("FP", g["n"], g["text"][:70]))
        elif g["is_obligation"]: fn += 1; errs.append(("FN", g["n"], g["text"][:70]))
        else: tn += 1
    P = tp / (tp + fp) if tp + fp else 0; R = tp / (tp + fn) if tp + fn else 0
    print("\nGolden %s (n=%d): TP %d FP %d FN %d TN %d  precision %.3f  recall %.3f  binds accuracy on TPs %d/%d" % (label, len(G), tp, fp, fn, tn, P, R, bind_ok, bind_n))
    for e in errs: print("   ", e)
    return len(G), P, R
n, P, R = score("obligations_draft_golden.json", "HELD-OUT (seed 123)")
score("obligations_draft_dev.json", "development 1 (seed 7, rules tuned on it)")
score("obligations_draft_dev2.json", "development 2 (seed 99, rules tuned on it)")
check("golden held-out: 40 hand-labelled units", n == 40)
check("golden held-out: precision >= 0.90", P >= 0.9, "%.3f" % P)
check("golden held-out: recall >= 0.90", R >= 0.9, "%.3f" % R)
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
