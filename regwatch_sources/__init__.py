"""RegWatch source engine (v2).

A registry-driven collector for EU AML/CFT, payments, e-money and crypto
sources. It fetches politely (robots.txt, per-host delays, conditional
requests, retries with backoff, a request budget), detects new, changed
and withdrawn entries by content hash, extracts documents to text with
page and paragraph locators, tags topics with transparent rules, writes
proposal stubs for human review and records metrics.

Entry point: `python collect_sources.py` (see its --help).
Data: docs/data/sources/ (registry.json is hand-maintained config plus a
`runtime` block the engine rewrites; everything else is generated).
"""

__version__ = "2.0.0"
