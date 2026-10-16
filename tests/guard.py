#!/usr/bin/env python3
"""Path guard for agent pull requests.

Usage: guard.py <base-branch> <head-branch>   (run from the repo root, after
`git fetch`; compares origin/<base>...HEAD)

Rules by head-branch prefix:
  lab/<id>      only docs/labs/<id>/ and ideas/<id>.*
  audit/<...>   only findings/, metrics/, decisions/ and tests/baseline.json
  fix/F-NNN-... only the files declared in findings/open/F-NNN-*.md
                (read from the BASE branch) plus findings/ and
                tests/baseline.json; at most MAX_LINES changed lines
  anything else: no restriction (a human PR)
"""
import re
import subprocess
import sys

MAX_LINES = 300

base, head = sys.argv[1], sys.argv[2]


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def fail(msg):
    print(f"GUARD FAILED: {msg}")
    sys.exit(1)


changed = [l for l in git("diff", "--name-only", f"origin/{base}...HEAD").splitlines() if l]
numstat = git("diff", "--numstat", f"origin/{base}...HEAD").splitlines()
lines = 0
for row in numstat:
    a, d, _ = (row.split("\t") + ["", "", ""])[:3]
    lines += (int(a) if a.isdigit() else 0) + (int(d) if d.isdigit() else 0)


def outside(allowed_prefixes, allowed_files=()):
    return [f for f in changed if f not in allowed_files and not any(f.startswith(p) for p in allowed_prefixes)]


if head.startswith("lab/"):
    lab_id = head[4:]
    if not re.fullmatch(r"[A-Za-z0-9._-]+", lab_id):
        fail(f"unexpected lab id {lab_id!r}")
    bad = outside([f"docs/labs/{lab_id}/", f"ideas/{lab_id}."])
    if bad:
        fail("lab PR touches files outside docs/labs/%s/ and ideas/%s.*:\n  %s" % (lab_id, lab_id, "\n  ".join(bad)))
    print("ok: lab PR stays inside its folder")

elif head.startswith("audit/"):
    bad = outside(["findings/", "metrics/", "decisions/"], ["tests/baseline.json"])
    if bad:
        fail("audit PR may only touch findings/, metrics/, decisions/:\n  " + "\n  ".join(bad))
    print("ok: audit PR touches only findings, metrics, decisions")

elif head.startswith("fix/F-"):
    m = re.match(r"fix/(F-\d+)", head)
    if not m:
        fail(f"fix branch must look like fix/F-123-short-name, got {head!r}")
    fid = m.group(1)
    tree = git("ls-tree", "-r", "--name-only", f"origin/{base}", "findings/open").splitlines()
    cands = [p for p in tree if re.match(rf"findings/open/{fid}-.*\.md$", p)]
    if len(cands) != 1:
        fail(f"expected exactly one findings/open/{fid}-*.md on {base}, found {len(cands)}")
    text = git("show", f"origin/{base}:{cands[0]}")
    fm = re.match(r"---\n(.*?)\n---", text, re.S)
    if not fm:
        fail("finding has no front matter")
    block = re.search(r"^files:\s*\n((?:\s+-\s+.+\n?)+)", fm.group(1) + "\n", re.M)
    declared = [re.sub(r"^\s+-\s+", "", l).strip() for l in block.group(1).splitlines()] if block else []
    if not declared:
        fail("finding declares no files: list, so an unattended fix is not allowed")
    bad = outside(["findings/"], declared + ["tests/baseline.json"])
    if bad:
        fail("fix touches files not declared in %s:\n  %s" % (cands[0], "\n  ".join(bad)))
    if lines > MAX_LINES:
        fail(f"fix changes {lines} lines (max {MAX_LINES}); split it")
    print(f"ok: fix {fid} stays within its declared files ({lines} changed lines)")

else:
    print("ok: human PR, no path restriction")
