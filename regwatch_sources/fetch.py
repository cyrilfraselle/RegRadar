"""Polite HTTP fetching.

- robots.txt (RFC 9309 matching, with * and $), checked before every URL;
  crawl-delay honoured.
- Per-host minimum delay between requests.
- Conditional requests (ETag / Last-Modified) from a persistent cache.
- Retries with exponential backoff on network errors, 429 and 5xx
  (Retry-After honoured up to a cap).
- A per-run request budget, so a run can never hammer a site or blow the
  CI time limit.
- Content hashing (sha256 of the body) and soft-failure detection (WAF or
  JavaScript challenge pages served with HTTP 200 or 403).
"""
import hashlib
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import requests

DEFAULT_UA = "RegWatchBot/2.0 (regulatory-monitoring; robots.txt-aware)"
UA_TOKEN = "regwatchbot"

_CHALLENGE_MARKERS = (
    "azure waf js challenge", "just a moment...", "cf-chl", "captcha",
    "attention required!", "enable javascript and cookies",
    "service temporarily not available", "website maintenance",
)


class BudgetExceeded(Exception):
    pass


class Blocked(Exception):
    """robots.txt forbids the URL."""


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data or b"").hexdigest()


def looks_challenged(body: bytes) -> bool:
    head = (body or b"")[:4000].decode("utf-8", "ignore").lower()
    return any(m in head for m in _CHALLENGE_MARKERS)


# ── robots.txt ────────────────────────────────────────────────────

class Robots:
    """Minimal RFC 9309 robots.txt: groups by user agent, longest match
    wins, Allow wins ties, * and $ supported. Python's urllib.robotparser
    does not support wildcards, which several sources use (`/*?*`)."""

    def __init__(self, text: str = "", status: int = 200):
        self.status = status
        self.groups = []   # list of (agents:set, rules:list[(allow, pattern)], delay)
        self._parse(text or "")

    def _parse(self, text):
        agents, rules, delay, last_was_agent = set(), [], None, False
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, val = [x.strip() for x in line.split(":", 1)]
            key = key.lower()
            if key == "user-agent":
                if not last_was_agent and (agents or rules):
                    self.groups.append((agents, rules, delay))
                    agents, rules, delay = set(), [], None
                agents.add(val.lower())
                last_was_agent = True
                continue
            last_was_agent = False
            if key in ("allow", "disallow"):
                if val == "" and key == "disallow":
                    continue
                rules.append((key == "allow", val))
            elif key == "crawl-delay":
                try:
                    delay = float(val)
                except ValueError:
                    pass
        if agents or rules:
            self.groups.append((agents, rules, delay))

    def _group(self, token):
        specific = [g for g in self.groups if any(a != "*" and a in token for a in g[0])]
        if specific:
            return specific
        return [g for g in self.groups if "*" in g[0]]

    @staticmethod
    def _match(pattern, path):
        regex = re.escape(pattern).replace(r"\*", ".*")
        if regex.endswith(r"\$"):
            regex = regex[:-2] + "$"
        return re.match(regex, path) is not None

    def allowed(self, url: str, token: str = UA_TOKEN) -> bool:
        if self.status >= 500:
            return False          # RFC 9309: unreachable, assume full disallow
        if self.status >= 400:
            return True           # RFC 9309: unavailable, crawling allowed
        parts = urlsplit(url)
        path = (parts.path or "/") + (("?" + parts.query) if parts.query else "")
        best = None   # (length, allow)
        for _agents, rules, _d in self._group(token):
            for allow, pat in rules:
                if self._match(pat, path):
                    cand = (len(pat), allow)
                    if best is None or cand[0] > best[0] or (cand[0] == best[0] and allow):
                        best = cand
        return True if best is None else best[1]

    def crawl_delay(self, token: str = UA_TOKEN):
        for _a, _r, d in self._group(token):
            if d is not None:
                return d
        return None


# ── Fetcher ───────────────────────────────────────────────────────

class Response:
    def __init__(self, url, status=0, body=b"", headers=None, not_modified=False,
                 error="", final_url=""):
        self.url = url
        self.final_url = final_url or url
        self.status = status
        self.body = body or b""
        self.headers = headers or {}
        self.not_modified = not_modified
        self.error = error
        self.sha = sha256(self.body) if self.body else ""

    @property
    def ok(self):
        return not self.error and (self.not_modified or 200 <= self.status < 300)

    @property
    def text(self):
        enc = "utf-8"
        m = re.search(r"charset=([\w-]+)", self.headers.get("content-type", ""), re.I)
        if m:
            enc = m.group(1)
        try:
            return self.body.decode(enc, "replace")
        except LookupError:
            return self.body.decode("utf-8", "replace")

    @property
    def content_type(self):
        return self.headers.get("content-type", "").lower()


class Fetcher:
    RETRY_STATUS = {429, 500, 502, 503, 504}

    def __init__(self, cache: dict = None, user_agent: str = DEFAULT_UA,
                 budget: int = 200, default_delay: float = 1.0, timeout: float = 40,
                 max_bytes: int = 15_000_000, retries: int = 3,
                 session=None, sleep=time.sleep, clock=time.monotonic):
        self.cache = cache if cache is not None else {}
        self.ua = user_agent
        self.budget = budget
        self.default_delay = default_delay
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.retries = retries
        self.session = session or requests.Session()
        self.sleep = sleep
        self.clock = clock
        self.robots = {}
        self.last_hit = {}
        self.host_delay = {}
        self.stats = {"requests": 0, "bytes": 0, "not_modified": 0, "errors": 0,
                      "retries": 0, "robots_blocked": 0, "slept_s": 0.0}

    # robots ---------------------------------------------------------
    def _robots_for(self, url) -> Robots:
        p = urlsplit(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self.robots:
            try:
                self._spend()
                self._wait(p.netloc)
                r = self.session.get(origin + "/robots.txt", timeout=20,
                                     headers={"User-Agent": self.ua}, allow_redirects=True)
                self.last_hit[p.netloc] = self.clock()
                body = r.text if r.status_code < 400 else ""
                self.robots[origin] = Robots(body, r.status_code)
            except BudgetExceeded:
                raise
            except Exception:
                self.robots[origin] = Robots("", 503)
            d = self.robots[origin].crawl_delay()
            if d:
                self.host_delay[p.netloc] = max(self.host_delay.get(p.netloc, 0), d)
        return self.robots[origin]

    def allowed(self, url: str) -> bool:
        return self._robots_for(url).allowed(url)

    # politeness -----------------------------------------------------
    def set_delay(self, host: str, seconds: float):
        self.host_delay[host] = max(self.host_delay.get(host, 0), seconds or 0)

    def _wait(self, host):
        delay = max(self.default_delay, self.host_delay.get(host, 0))
        last = self.last_hit.get(host)
        if last is not None:
            gap = self.clock() - last
            if gap < delay:
                self.sleep(delay - gap)
                self.stats["slept_s"] += delay - gap

    def _spend(self):
        if self.stats["requests"] >= self.budget:
            raise BudgetExceeded(f"request budget of {self.budget} reached")
        self.stats["requests"] += 1

    # main -----------------------------------------------------------
    def get(self, url: str, conditional: bool = True, headers: dict = None,
            data: dict = None, cache_key: str = None) -> Response:
        """GET (or POST when `data` is given). Never raises for HTTP or
        network errors: returns a Response with `.error` set. Raises
        BudgetExceeded when the run's request budget is spent."""
        if not self.allowed(url):
            self.stats["robots_blocked"] += 1
            return Response(url, error="blocked by robots.txt")
        key = cache_key or url
        h = {"User-Agent": self.ua, "Accept-Encoding": "gzip, deflate"}
        h.update(headers or {})
        cached = self.cache.get(key) or {}
        if conditional and data is None:
            if cached.get("etag"):
                h["If-None-Match"] = cached["etag"]
            if cached.get("last_modified"):
                h["If-Modified-Since"] = cached["last_modified"]
        host = urlsplit(url).netloc
        last_err = ""
        for attempt in range(self.retries + 1):
            self._spend()
            self._wait(host)
            try:
                if data is not None:
                    r = self.session.post(url, data=data, headers=h, timeout=self.timeout,
                                          allow_redirects=True, stream=True)
                else:
                    r = self.session.get(url, headers=h, timeout=self.timeout,
                                         allow_redirects=True, stream=True)
                body = b""
                if r.status_code != 304:
                    chunks, size = [], 0
                    for chunk in r.iter_content(65536):
                        size += len(chunk)
                        if size > self.max_bytes:
                            r.close()
                            raise ValueError(f"response larger than {self.max_bytes} bytes")
                        chunks.append(chunk)
                    body = b"".join(chunks)
            except BudgetExceeded:
                raise
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"[:300]
                self.last_hit[host] = self.clock()
                if attempt < self.retries:
                    self.stats["retries"] += 1
                    self.sleep(2 ** (attempt + 1))
                    continue
                break
            self.last_hit[host] = self.clock()
            hdrs = {k.lower(): v for k, v in r.headers.items()}
            if r.status_code == 304:
                self.stats["not_modified"] += 1
                cached["checked"] = now_iso()
                self.cache[key] = cached
                return Response(url, 304, b"", hdrs, not_modified=True, final_url=r.url)
            if r.status_code in self.RETRY_STATUS and attempt < self.retries:
                self.stats["retries"] += 1
                wait = 2 ** (attempt + 1)
                ra = hdrs.get("retry-after", "")
                if ra.isdigit():
                    wait = min(int(ra), 60)
                self.sleep(wait)
                last_err = f"HTTP {r.status_code}"
                continue
            self.stats["bytes"] += len(body)
            resp = Response(url, r.status_code, body, hdrs, final_url=r.url)
            if r.status_code >= 400:
                resp.error = f"HTTP {r.status_code}"
                if looks_challenged(body):
                    resp.error += " (bot challenge page)"
            elif looks_challenged(body) and len(body) < 20000:
                resp.error = "soft failure: challenge or outage page"
            if resp.error:
                self.stats["errors"] += 1
                return resp
            self.cache[key] = {
                "etag": hdrs.get("etag", ""),
                "last_modified": hdrs.get("last-modified", ""),
                "sha256": resp.sha,
                "checked": now_iso(),
                "status": r.status_code,
            }
            return resp
        self.stats["errors"] += 1
        return Response(url, error=last_err or "failed")
