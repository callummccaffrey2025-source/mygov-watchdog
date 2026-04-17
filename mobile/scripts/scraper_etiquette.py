#!/usr/bin/env python3
"""
scraper_etiquette.py — shared responsible-scraping helpers.

Four rules every HTTP-scraping script in this repo must observe:

  1. robots.txt: fetch it once per host, cache the parsed result, and skip any
     URL our User-Agent isn't permitted to fetch. A 401/403 response on
     robots.txt itself is treated as "site disallows crawling" per RFC 9309.
     A 404 or network failure is treated as "no restrictions" (the RFC default).
  2. Rate limit: minimum 3 seconds between requests to the same host. Sleep
     the difference when a caller arrives early.
  3. User-Agent: leads with a browser-like Chrome identifier so Akamai / Signal
     Sciences / Cloudflare front-ends don't auto-block, trailed by a clear
     VerityBot identifier + contact email so admins can still reach us.
  4. Network hardening (new):
      - Force IPv4 resolution (skip IPv6 AAAA stalls on government WAFs).
      - Browser-style request headers (Accept, Accept-Language, etc.).
      - Tiered timeouts: 45 s for the first request to a new host, 20 s
        after we've successfully reached it once.
      - 2 retries with 3-second exponential backoff on connection errors
        and WAF-style 5xx responses (500/502/503/504/520/522/524).

Usage:

    from scraper_etiquette import polite_get, polite_feed_parse, USER_AGENT

    resp = polite_get("https://www.pm.gov.au/media")
    if resp and resp.status_code == 200:
        ...

The module is single-process safe — no background threads. Caches live as
module-level state; a second `import` in the same process reuses them.
"""
from __future__ import annotations

import logging
import socket
import time
from typing import Any
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from requests.adapters import HTTPAdapter
import urllib3.util.connection as _urllib3_connection
from urllib3.util.retry import Retry


log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Network hardening
# ─────────────────────────────────────────────────────────────────────────────

# Force IPv4 resolution for every request urllib3 makes. Several Australian
# government domains (pm.gov.au, minister.dcceew.gov.au,
# www.minister.defence.gov.au) publish AAAA records that time out or fail TLS
# when reached from Python's default AF_UNSPEC resolver. curl was succeeding
# against these hosts because it falls back to IPv4 fast; Python was stalling
# the full read timeout waiting for IPv6.
#
# urllib3's `allowed_gai_family` gates which address family getaddrinfo
# returns. By default it returns AF_UNSPEC when IPv6 is available (try both).
# Overriding it to always return AF_INET skips IPv6 entirely.
#
# This is a module-level side effect. It fires once on first import and
# affects every urllib3-backed HTTP call in the process — which for our
# scrapers means every requests call. Acceptable scope: the module is only
# imported by scrapers that want this behaviour.
_urllib3_connection.allowed_gai_family = lambda: socket.AF_INET


# ─────────────────────────────────────────────────────────────────────────────
# Identity
# ─────────────────────────────────────────────────────────────────────────────

# User-Agent: Chrome lead-in so Akamai/Signal Sciences front-ends don't
# fingerprint us as a default-UA Python bot, followed by a short VerityBot
# identifier linking to a contact/about page. The `(+https://...)` form
# mirrors the established convention for bot UAs (Googlebot, Bingbot, etc.)
# and — empirically — does NOT trigger the WAF false-positives that longer
# bot suffixes with prose do.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/121.0.0.0 Safari/537.36 "
    "VerityBot/1.0 (+https://verity.run/bot)"
)

# Used specifically for robots.txt matching. Site admins who want to block us
# write `User-agent: VerityBot` in robots.txt — so we check that name
# explicitly (substring-match on our wire UA would be brittle).
UA_SHORT_NAME = "VerityBot"


DEFAULT_HEADERS: dict[str, str] = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en-GB;q=0.9,en;q=0.8",
    # `br` is safe because the `brotli` package is now in the Python env,
    # so urllib3 can decompress brotli responses transparently.
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
}


# ─────────────────────────────────────────────────────────────────────────────
# Retry-aware shared Session
# ─────────────────────────────────────────────────────────────────────────────

_RETRY_STATUSES = [429, 500, 502, 503, 504, 520, 522, 524]

_retry = Retry(
    total=3,
    connect=3,
    read=3,
    status=3,
    backoff_factor=3.0,          # waits: 3s, 6s, 12s across three retries
    status_forcelist=_RETRY_STATUSES,
    allowed_methods=frozenset(["GET", "HEAD"]),
    raise_on_status=False,
    respect_retry_after_header=True,
)

_adapter = HTTPAdapter(max_retries=_retry, pool_connections=10, pool_maxsize=10)

_session = requests.Session()
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)
_session.headers.update(DEFAULT_HEADERS)


# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting + tiered timeouts
# ─────────────────────────────────────────────────────────────────────────────

MIN_INTERVAL_SECONDS: float = 3.0
FIRST_FETCH_TIMEOUT: int = 45        # first request to a new host
STEADY_STATE_TIMEOUT: int = 20       # after we've successfully reached the host

_last_fetch_monotonic: dict[str, float] = {}
_successful_hosts: set[str] = set()


def _host_of(url: str) -> str | None:
    try:
        return (urlparse(url).hostname or "").lower() or None
    except Exception:
        return None


def _sleep_if_needed(host: str) -> float:
    """Sleep long enough to respect MIN_INTERVAL_SECONDS for this host."""
    now = time.monotonic()
    last = _last_fetch_monotonic.get(host, 0.0)
    slept = 0.0
    if last > 0:
        elapsed = now - last
        if elapsed < MIN_INTERVAL_SECONDS:
            slept = MIN_INTERVAL_SECONDS - elapsed
            time.sleep(slept)
    _last_fetch_monotonic[host] = time.monotonic()
    return slept


def _timeout_for(host: str, override: int | None) -> int:
    if override is not None:
        return override
    return STEADY_STATE_TIMEOUT if host in _successful_hosts else FIRST_FETCH_TIMEOUT


# ─────────────────────────────────────────────────────────────────────────────
# robots.txt
# ─────────────────────────────────────────────────────────────────────────────

# Per-host cache. Values:
#   - RobotFileParser instance → use can_fetch() to query
#   - "DISALLOWED" (string)    → 401/403 on robots.txt → entire host off-limits
_robots_cache: dict[str, Any] = {}


def _fetch_robots(host: str, scheme: str) -> None:
    """Populate _robots_cache[host] with either a parsed RP or 'DISALLOWED'."""
    robots_url = f"{scheme}://{host}/robots.txt"
    try:
        resp = _session.get(
            robots_url,
            timeout=_timeout_for(host, None),
            allow_redirects=True,
        )
    except Exception as e:
        log.info(
            "robots.txt unreachable for %s (%s) — proceeding as allowed per RFC default",
            host, e,
        )
        rp = RobotFileParser()
        rp.parse([])
        _robots_cache[host] = rp
        return

    if resp.status_code in (401, 403):
        log.warning(
            "robots.txt returned %d on %s — treating entire host as disallowed",
            resp.status_code, host,
        )
        _robots_cache[host] = "DISALLOWED"
        return

    # A robots.txt response counts as a successful reach for timeout-tiering.
    _successful_hosts.add(host)

    rp = RobotFileParser()
    if 200 <= resp.status_code < 300:
        rp.parse(resp.text.splitlines())
    else:
        rp.parse([])  # 404 / 5xx / other → RFC default allow
    _robots_cache[host] = rp


def is_allowed(url: str) -> bool:
    """
    True if our User-Agent may fetch this URL per robots.txt.

    Caches per-host after first lookup. A missing or unreachable robots.txt
    is treated as permissive (RFC 9309 default); an explicit 401/403 on
    robots.txt is treated as prohibitive for the whole host.
    """
    host = _host_of(url)
    if not host:
        return False
    if host not in _robots_cache:
        scheme = "https" if url.startswith("https://") else "http"
        _fetch_robots(host, scheme)

    entry = _robots_cache.get(host)
    if entry == "DISALLOWED":
        return False
    if isinstance(entry, RobotFileParser):
        # Check the short bot name — site admins write `User-agent: VerityBot`,
        # not the full Mozilla/... string.
        return entry.can_fetch(UA_SHORT_NAME, url)
    log.warning("No robots entry for %s, allowing", host)
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Public fetch helpers
# ─────────────────────────────────────────────────────────────────────────────

def polite_get(
    url: str,
    *,
    timeout: int | None = None,
    headers: dict | None = None,
    allow_redirects: bool = True,
) -> requests.Response | None:
    """
    robots.txt-respecting, rate-limited, retry-enabled HTTP GET.

    Returns:
      - requests.Response on success (caller inspects status_code)
      - None if robots.txt disallows this URL, or the request errored out
        after all retries

    Always sends the browser-like UA and headers (overridable via `headers`).
    Uses 45 s timeout on first hit to a new host, 20 s once the host has
    successfully responded at least once.
    """
    host = _host_of(url)
    if not host:
        log.warning("polite_get: invalid URL %s", url)
        return None

    if not is_allowed(url):
        log.info("polite_get: robots.txt disallows %s — skipping", url)
        return None

    _sleep_if_needed(host)
    effective_timeout = _timeout_for(host, timeout)

    merged = dict(DEFAULT_HEADERS)
    if headers:
        merged.update(headers)

    try:
        resp = _session.get(
            url,
            headers=merged,
            timeout=effective_timeout,
            allow_redirects=allow_redirects,
        )
        if resp.status_code == 200:
            _successful_hosts.add(host)
        return resp
    except Exception as e:
        log.warning("polite_get: fetch failed for %s: %s", url, e)
        return None


def polite_feed_parse(url: str, *, timeout: int | None = None) -> Any:
    """
    robots.txt-respecting, rate-limited RSS/Atom fetch.

    Fetches via the configured polite_get so the IPv4 forcing, browser UA,
    retry, and rate-limit apply to feed fetches too. feedparser then parses
    the already-downloaded bytes.
    """
    import feedparser  # local import — not every caller needs RSS

    resp = polite_get(url, timeout=timeout)
    if resp is None or resp.status_code != 200:
        return feedparser.parse(b"")
    try:
        return feedparser.parse(resp.content)
    except Exception as e:
        log.warning("polite_feed_parse: parse failed for %s: %s", url, e)
        return feedparser.parse(b"")


# ─────────────────────────────────────────────────────────────────────────────
# Test helpers
# ─────────────────────────────────────────────────────────────────────────────

def _reset_caches_for_testing() -> None:
    """Clear robots + rate-limit state. Only for tests."""
    _robots_cache.clear()
    _last_fetch_monotonic.clear()
    _successful_hosts.clear()
