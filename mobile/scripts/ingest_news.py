#!/usr/bin/env python3
"""
ingest_news.py — Fetch Australian political news via NewsAPI (primary) or RSS
(fallback), store in news_articles, and group into news_stories by topic.

Run:          python ingest_news.py
Fresh start:  python ingest_news.py --fresh
"""
import logging
import os
import re
import sys
from datetime import datetime, timezone, timedelta

import feedparser
import requests
from dotenv import load_dotenv
from supabase import create_client

try:
    import anthropic as _anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY")
GNEWS_KEY = os.environ.get("GNEWS_KEY")
MEDIASTACK_KEY = os.environ.get("MEDIASTACK_KEY")

# ── Source bias map — outlet name (lowercase) → leaning ──────────────────────
SOURCE_BIAS: dict[str, str] = {
    # AU Left
    "the guardian": "left",
    "guardian australia": "left",
    "the saturday paper": "left",
    "crikey": "left",
    "michael west media": "left",
    "indaily": "center-left",
    # AU Centre-Left
    "abc news": "center-left",
    "abc news (au)": "center-left",
    "new daily": "center-left",
    "the new daily": "center-left",
    "the age": "center-left",
    "sydney morning herald": "center-left",
    "brisbane times": "center-left",
    "wa today": "center-left",
    "the conversation": "center-left",
    # AU Centre
    "sbs news": "center",
    "nine news": "center",
    "7news": "center",
    "10 news": "center",
    "abc": "center-left",
    "canberra times": "center",
    "canberra daily": "center",
    "the mercury": "center",
    "the mandarin": "center",
    # AU Centre-Right
    "news.com.au": "center-right",
    "the west australian": "center-right",
    "the advertiser": "center-right",
    "the australian": "center-right",
    "the oz": "center-right",
    "herald sun": "center-right",
    "daily telegraph": "center-right",
    "the courier-mail": "center-right",
    "courier mail": "center-right",
    "courier-mail": "center-right",
    # AU Right
    "sky news australia": "right",
    "the spectator australia": "right",
    "quadrant": "right",
    # International
    "bbc news": "center",
    "bbc": "center",
    "al jazeera": "center-left",
    "al jazeera english": "center-left",
    "bloomberg": "center",
    "the financial times": "center",
    "financial times": "center",
    "the new york times": "center-left",
    "the washington post": "center-left",
    "cnn": "center-left",
    "reuters": "center",
    "fox news": "right",
    "the new zealand herald": "center",
    "new zealand herald": "center",
    "rnz": "center",
}

# ── Politician aliases — maps canonical key → list of name forms in text ─────
POLITICIAN_ALIASES: dict[str, list[str]] = {
    "albanese": ["prime minister", " pm ", "anthony albanese", "albanese"],
    "dutton": ["opposition leader", "peter dutton", "dutton"],
    "chalmers": ["treasurer", "jim chalmers", "chalmers"],
    "wong": ["foreign minister", "penny wong", " wong "],
    "marles": ["deputy prime minister", "defence minister", "richard marles", "marles"],
    "bandt": ["greens leader", "adam bandt", "bandt"],
    "lambie": ["jacqui lambie", "lambie"],
    "pocock": ["david pocock", "pocock"],
}

# ── Hardcoded politician names (canonical matching) ──────────────────────────
POLITICIANS = {
    # PM / Deputy PM
    "albanese", "anthony albanese",
    "marles", "richard marles",
    # Treasurer / Finance
    "chalmers", "jim chalmers",
    "gallagher", "katy gallagher",
    # Other Cabinet
    "penny wong", "wong",
    "clare", "jason clare",
    "burney", "linda burney",
    "plibersek", "tanya plibersek",
    "o'neil", "clare o'neil",
    "watt", "murray watt",
    "husic", "ed husic",
    "conroy", "pat conroy",
    "bowen", "chris bowen",
    "farrell", "don farrell",
    "rowland", "michelle rowland",
    # Opposition
    "dutton", "peter dutton",
    "ley", "sussan ley",
    "taylor", "angus taylor",
    "joyce", "barnaby joyce",
    "littleproud", "david littleproud",
    "coleman", "david coleman",
    "tehan", "dan tehan",
    "henderson", "sarah henderson",
    # Greens
    "bandt", "adam bandt",
    "waters", "larissa waters",
    # Senate crossbench
    "lambie", "jacqui lambie",
    "pocock", "david pocock",
    "thorpe", "lidia thorpe",
}

# ── Broad cluster topics — for story grouping (separate from display CATEGORY_MAP)
# Articles sharing the same cluster topic within 48h are candidates for the same story.
CLUSTER_TOPICS = [
    (["fuel", "petrol", "energy price", "gas price", "oil price", "electricity price",
       "power price", "lng", "fuel crisis", "fuel supply", "fuel excise"], "fuel-energy"),
    (["housing", "rent ", "rental", "mortgage", "home buyer", "first home",
       "homelessness", "property price", "affordable hous", "housing crisis"], "housing"),
    (["budget", "inflation", "interest rate", "rba ", " rba", "cost of living",
       "minimum wage", "wage growth", " tax ", " taxes", "treasurer", "economy",
       "gdp", "recession", "centrelink", "welfare payment"], "economy"),
    (["medicare", "hospital", "health fund", "mental health", "aged care", "ndis",
       "disability support", "bulk bill", "gp shortage", "health system"], "health"),
    (["defence", "military", "aukus", "submarine", "army", "navy", "air force",
       "veteran", "national security", "security threat"], "defence"),
    (["election", "preselection", "candidate", "campaign", "polling", "marginal seat",
       "by-election", "electoral", "vote count", "seat of"], "election"),
    (["climate", "emission", "renewable", "carbon", "environment", "net zero",
       "coal", "clean energy", "solar", "wind power", "fossil fuel"], "climate"),
    (["immigration", "migration", "visa", "border force", "refugee", "asylum",
       "international student", "migration program", "migration cap"], "immigration"),
    (["education", "university", "school fund", "hecs", "student debt",
       "teacher shortage", "tafe", "curriculum"], "education"),
    (["parliament", "legislation", "minister", "senate", "house of rep",
       "cabinet", "prime minister", "opposition leader", "labor", "liberal",
       "the greens", "crossbench", "inquiry", "royal commission",
       "government spending", "policy"], "general-politics"),
]

# Source factuality priority — lower number = processed first = headline used for story
SOURCE_PRIORITY: dict[str, int] = {
    "abc news": 1, "abc news (au)": 1, "sbs news": 1, "reuters": 1,
    "the guardian": 2, "guardian australia": 2, "sydney morning herald": 2,
    "the age": 2, "the conversation": 2, "crikey": 2,
    "the new daily": 2, "new daily": 2, "canberra times": 2,
    "news.com.au": 3, "nine news": 3, "7news": 3, "9news": 3,
    "sky news australia": 4, "herald sun": 4, "daily telegraph": 4, "courier mail": 4,
}

# ── Stop words for tokenisation ───────────────────────────────────────────────
STOP_WORDS = {
    "the", "a", "an", "in", "to", "for", "on", "and", "of", "is", "at",
    "by", "from", "with", "as", "its", "it", "that", "this", "are", "was",
    "has", "have", "be", "will", "not", "but", "says", "say", "after",
    "over", "into", "about", "up", "out", "new", "more", "than", "amid",
    "before", "during", "while", "what", "how", "why", "who", "call",
    "he", "she", "they", "his", "her", "their", "our", "we", "you",
    "just", "also", "said", "would", "could", "should", "may", "than",
}

# ── STRONG political keywords — must match at least one in title or description
# Deliberately narrow: only terms that are unambiguously political/governmental.
POLITICAL_KEYWORDS = [
    "parliament", "legislation", "minister", "prime minister",
    "premier", "treasurer", "attorney-general",
    "opposition leader", "opposition", "senate", "senator",
    "house of representatives", "federal budget", "state budget",
    "policy ", "policies ", "election", "by-election",
    "referendum", "regulation", "inquiry", "royal commission",
    "committee", "portfolio", "cabinet", "backbench",
    "crossbench", "mandate", "bipartisan", "caucus",
    # Party/people — specific, unambiguous
    "albanese", "dutton", "penny wong", "jim chalmers",
    "labor party", "liberal party", "the greens", "alp",
    " lnp", "national party", "one nation",
    "parliament house", "department of",
    # Strong AU institutional terms
    "aukus", "ndis", "centrelink", "medicare levy",
    "australian taxation", "asic", "accc",
    # Legislation signals
    " bill ", "amendment bill", "act 20",  # e.g. "Act 2024"
    # Broader government signals
    "government", "federal government", "state government",
    "budget", " tax ", "cost of living", "inflation",
]

# ── Australian markers — must match at least one ──────────────────────────────
AUSTRALIA_MARKERS = [
    "australia", "australian", "canberra",
    "new south wales", " nsw", "victoria", "victorian",
    "queensland", "tasmania", "south australia",
    "western australia", "northern territory",
    " act ", "sydney", "melbourne", "brisbane",
    "perth", "adelaide", "hobart", "darwin",
    "albanese", "dutton", "parliament house",
    "federal government", "state government",
    "alp", " lnp", "labor party", "liberal party",
    "medicare", "centrelink", "ndis",
    "rba", "asic", "accc", "aec", "ato",
    "anthony albanese", "peter dutton",
    "penny wong", "jim chalmers",
]

# ── Lifestyle/non-political negatives — checked against TITLE only ────────────
LIFESTYLE_TITLE_NEGATIVES = [
    "road trip", "recipe", " travel ", "on holiday", "celebrity",
    "entertainment news", "cricket", "afl ", " afl ", "aflw",
    " nrl ", "nrl ", " rugby",
    " tennis", "olympic", "movie review", "film review", "tv show",
    "best restaurant", "food and wine", " fashion", "horoscope",
    "weather forecast", "weather tracker", "real estate listing", "property listing",
    "open home", "viral video", "adorable", "epic adventure",
    "how to make", "tips for", "guide to", "the best ", "ranked:",
    "retiree", "bucket list", "romance", "dating", "epic aussie",
    "puppy", "beloved pet", "coach drops", "selection shock",
    "prince harry", "meghan markle", "royal family",
    "terrifying trend", "dark side",
]

# ── Non-AU international negatives — checked on full text when NOT Australian ─
NEGATIVE_MARKERS = [
    "trump", "biden", "congress", "u.s. senate",
    " uk ", "brexit", "ukraine", "russia", "nato",
    "european union", "european commission", "gaza", "palestine", "israel",
    "hamas", "hezbollah", "china trade", "pakistan",
    "lebanon", "canada", "france ", "germany ",
    "japan ", "south korea",
]

# ── Category keyword map ───────────────────────────────────────────────────────
CATEGORY_MAP = [
    (["bill ", "parliament", "legislation", "house of rep", "senate vote"], "legislation"),
    (["budget", "economy", "treasurer", "gdp", "inflation", "interest rate", "rba", "tax"], "economy"),
    (["defence", "aukus", "military", "navy", "army", "air force", "security"], "defence"),
    (["health", "hospital", "medicare", "ndis", "aged care", "mental health"], "health"),
    (["housing", "rent", "mortgage", "property", "homelessness"], "housing"),
    (["climate", "environment", "emissions", "net zero", "energy", "solar", "coal"], "climate"),
    (["immigration", "visa", "asylum", "refugee", "border force", "migration"], "immigration"),
    (["election", "polling", "aec", "campaign", "candidate", "electoral"], "election"),
]


def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL or SUPABASE_KEY in .env")
        raise SystemExit(1)
    return create_client(url, key)


def tokenise(text: str) -> set[str]:
    words = re.findall(r"[a-z]+", text.lower())
    return {w for w in words if w not in STOP_WORDS and len(w) > 3}


def fingerprint(text: str) -> set[str]:
    """Top 5 non-stopword tokens (sorted) — used for quick cluster matching."""
    tokens = tokenise(text)
    return set(sorted(tokens)[:5]) if len(tokens) >= 5 else tokens


def lookup_bias(source_name: str) -> str:
    """Bias lookup with partial/substring matching fallback."""
    lower = source_name.lower()
    if lower in SOURCE_BIAS:
        return SOURCE_BIAS[lower]
    for key, bias in SOURCE_BIAS.items():
        if key in lower or lower in key:
            return bias
    return "center"


def titles_are_similar(t1: str, t2: str, threshold: float = 0.8) -> bool:
    """True if two titles share ≥ threshold Jaccard similarity on tokens."""
    s1, s2 = tokenise(t1), tokenise(t2)
    if not s1 or not s2:
        return False
    union = len(s1 | s2)
    return union > 0 and len(s1 & s2) / union >= threshold


def canonical_politicians(text: str) -> set[str]:
    """Return canonical politician keys found in text (via aliases)."""
    lower = text.lower()
    found = set()
    for key, aliases in POLITICIAN_ALIASES.items():
        if any(alias in lower for alias in aliases):
            found.add(key)
    return found


def extract_gnews_source(entry) -> str:
    """Extract outlet name from a Google News RSS entry."""
    # feedparser may expose <source> as entry.source (a dict-like object)
    src = getattr(entry, "source", None)
    if src:
        name = getattr(src, "title", None) or (src.get("title") if isinstance(src, dict) else None)
        if name and isinstance(name, str) and name.strip():
            return name.strip()
    # Fall back: Google News appends " - Source Name" to the title
    title = getattr(entry, "title", "")
    if " - " in title:
        parts = title.rsplit(" - ", 1)
        if len(parts[1]) < 60:
            return parts[1].strip()
    return ""


def clean_gnews_title(title: str) -> str:
    """Strip the appended ' - Source Name' from a Google News title."""
    if " - " in title:
        parts = title.rsplit(" - ", 1)
        if len(parts[1]) < 60:
            return parts[0].strip()
    return title


def extract_entities(title: str) -> set[str]:
    words = re.findall(r"\b[A-Z][a-z]{2,}\b", title)
    common = {"The", "This", "That", "These", "Those", "When", "What",
              "How", "Why", "Who", "Where", "After", "Before", "During"}
    return {w.lower() for w in words if w not in common}


def guess_category(text: str) -> str:
    lower = text.lower()
    for keywords, cat in CATEGORY_MAP:
        if any(kw in lower for kw in keywords):
            return cat
    return "politics"


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text[:60].lower()).strip("-")


def is_political(haystack: str) -> bool:
    return any(kw in haystack for kw in POLITICAL_KEYWORDS)


def is_australian(haystack: str) -> bool:
    return any(marker in haystack for marker in AUSTRALIA_MARKERS)


def should_skip(title: str, description: str) -> tuple[bool, str]:
    """
    Return (skip, reason).
    Keep only articles that are:
      1. NOT lifestyle/entertainment (checked on title only)
      2. Political (strong political keyword in title OR description)
      3. Australian (AU marker in title OR description)
    """
    title_lower = title.lower()
    haystack = (title + " " + (description or "")).lower()

    # ── 1. Lifestyle/entertainment negative — title only ──────────────────────
    for neg in LIFESTYLE_TITLE_NEGATIVES:
        if neg in title_lower:
            return True, f"lifestyle ({neg.strip()})"

    # ── 2. Must have a strong political keyword ───────────────────────────────
    if not is_political(haystack):
        return True, "no political keyword"

    # ── 3. Must have an Australian marker ────────────────────────────────────
    if not is_australian(haystack):
        for neg in NEGATIVE_MARKERS:
            if neg in haystack:
                return True, f"non-AU ({neg.strip()})"
        return True, "no Australian context"

    return False, ""


def parse_date(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                import calendar
                ts = calendar.timegm(val)
                return datetime.fromtimestamp(ts, tz=timezone.utc)
            except Exception:
                pass
    return None


def extract_image(entry) -> str | None:
    media = getattr(entry, "media_content", None)
    if media and isinstance(media, list) and media[0].get("url"):
        return media[0]["url"]
    enclosures = getattr(entry, "enclosures", None)
    if enclosures:
        for enc in enclosures:
            if enc.get("type", "").startswith("image") and enc.get("url"):
                return enc["url"]
    thumbnail = getattr(entry, "media_thumbnail", None)
    if thumbnail and isinstance(thumbnail, list) and thumbnail[0].get("url"):
        return thumbnail[0]["url"]
    return None


def leaning_column(leaning: str) -> str:
    if leaning in ("left", "center-left"):
        return "left_count"
    if leaning in ("center-right", "right"):
        return "right_count"
    return "center_count"


def extract_cluster_topic(text: str) -> str | None:
    """Return the broad cluster topic for grouping, or None."""
    lower = text.lower()
    for keywords, topic in CLUSTER_TOPICS:
        if any(kw in lower for kw in keywords):
            return topic
    return None


def extract_politicians(text: str) -> set[str]:
    lower = text.lower()
    return {name for name in POLITICIANS if name in lower}


def find_matching_story(
    title: str,
    pub_date: datetime,
    description: str,
    existing_stories: list[dict],
) -> dict | None:
    """
    Topic-first clustering with alias-aware politician matching:
    1. Same broad topic + within 48h + ≥1 token overlap → cluster (score 8)
    2. Same broad topic + within 48h + zero token overlap → skip (different events)
    3. Same canonical politician via aliases + same topic candidate → cluster (score 5+)
    4. Fallback: ≥3 token overlap in titles → cluster
    """
    haystack = (title + " " + (description or "")).lower()
    article_topic = extract_cluster_topic(haystack)
    article_canon_pols = canonical_politicians(haystack)
    title_tokens = tokenise(title)

    best: dict | None = None
    best_score = 0

    for story in existing_stories:
        try:
            story_dt = datetime.fromisoformat(story["first_seen"].replace("Z", "+00:00"))
            if story_dt.tzinfo is None:
                story_dt = story_dt.replace(tzinfo=timezone.utc)
            if abs((pub_date - story_dt).total_seconds()) > 48 * 3600:
                continue
        except Exception:
            pass

        story_hay = story["headline"].lower()
        story_tokens = tokenise(story["headline"])
        token_overlap = len(title_tokens & story_tokens)

        score = 0

        # ── 1. Topic-first: same broad topic within window ──────────────────
        story_topic = extract_cluster_topic(story_hay)
        if article_topic and story_topic and article_topic == story_topic:
            if token_overlap >= 1:
                score = 8
            # else: same topic, zero token overlap → leave score=0 (different event)

        # ── 2. Canonical politician alias match (additive) ──────────────────
        if article_canon_pols:
            story_canon_pols = canonical_politicians(story_hay)
            pol_overlap = len(article_canon_pols & story_canon_pols)
            if pol_overlap:
                # Politician match boosts (or initiates) clustering
                score = max(score, pol_overlap * 5)
                # If they share a politician AND ≥1 token overlap → strong signal
                if token_overlap >= 1:
                    score = max(score, 8)

        # ── 3. Token overlap fallback ───────────────────────────────────────
        if score == 0 and token_overlap >= 3:
            score = 4

        if score >= 4 and score > best_score:
            best_score = score
            best = story

    return best


def fetch_newsapi() -> list[dict]:
    """Fetch AU political articles from NewsAPI. Returns [] if no key or error."""
    if not NEWSAPI_KEY:
        return []
    base = "https://newsapi.org/v2"
    headers = {"X-Api-Key": NEWSAPI_KEY}
    articles: list[dict] = []

    # /v2/everything — AU political query (no domain filter: catch Crikey + others not in RSS)
    params_ev = {
        "q": "(australia OR australian) AND (parliament OR albanese OR dutton OR budget OR election)",
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 100,
    }
    try:
        r = requests.get(f"{base}/everything", headers=headers, params=params_ev, timeout=15)
        r.raise_for_status()
        articles += r.json().get("articles", [])
        log.info("NewsAPI /everything: %d articles", len(articles))
    except Exception as e:
        log.warning("NewsAPI /everything failed: %s", e)

    # /v2/top-headlines — AU general news
    params_th = {"country": "au", "category": "general", "pageSize": 100}
    try:
        r = requests.get(f"{base}/top-headlines", headers=headers, params=params_th, timeout=15)
        r.raise_for_status()
        before = len(articles)
        articles += r.json().get("articles", [])
        log.info("NewsAPI /top-headlines: %d articles", len(articles) - before)
    except Exception as e:
        log.warning("NewsAPI /top-headlines failed: %s", e)

    # Deduplicate by URL
    seen: set[str] = set()
    result: list[dict] = []
    for a in articles:
        url = (a.get("url") or "").strip()
        if not url or url in seen:
            continue
        source_name = (a.get("source") or {}).get("name", "").strip()
        if not source_name:
            continue
        seen.add(url)
        result.append({
            "title": (a.get("title") or "").strip(),
            "description": (a.get("description") or "").strip(),
            "url": url,
            "published_at": a.get("publishedAt") or "",
            "source_name": source_name,
            "image_url": a.get("urlToImage") or None,
        })
    log.info("NewsAPI total (deduped): %d articles", len(result))
    return result


def fetch_google_news() -> list[dict]:
    """Fetch from Google News RSS feeds (5 AU political queries). No API key needed."""
    feeds = [
        "https://news.google.com/rss/search?q=australia+parliament+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australian+government+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=Albanese+OR+Dutton+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+fuel+crisis+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+election+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+budget+economy+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+housing+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+health+medicare+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+defence+AUKUS+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
        "https://news.google.com/rss/search?q=australia+immigration+when:7d&hl=en-AU&gl=AU&ceid=AU:en",
    ]
    articles: list[dict] = []
    seen_urls: set[str] = set()

    for feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            log.warning("Google News RSS failed (%s): %s", feed_url[:60], e)
            continue

        for entry in feed.entries:
            raw_title = getattr(entry, "title", "").strip()
            if not raw_title:
                continue
            link = getattr(entry, "link", "").strip()
            if not link or link in seen_urls:
                continue

            source_name = extract_gnews_source(entry)
            if not source_name:
                continue

            clean_title = clean_gnews_title(raw_title)
            description = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
            description = re.sub(r"<[^>]+>", "", description).strip()
            pub_date = parse_date(entry)

            seen_urls.add(link)
            articles.append({
                "title": clean_title,
                "description": description,
                "url": link,
                "published_at": pub_date.isoformat() if pub_date else "",
                "source_name": source_name,
            })

    log.info("Google News RSS: %d articles", len(articles))
    return articles


def fetch_gnews() -> list[dict]:
    """Fetch AU political articles from GNews API."""
    if not GNEWS_KEY:
        return []
    queries = [
        "australia parliament",
        "albanese OR dutton australia",
        "australia budget economy",
    ]
    articles: list[dict] = []
    seen_urls: set[str] = set()

    for q in queries:
        params = {
            "q": q,
            "lang": "en",
            "country": "au",
            "max": 10,
            "token": GNEWS_KEY,
        }
        try:
            r = requests.get("https://gnews.io/api/v4/search", params=params, timeout=15)
            r.raise_for_status()
            for a in r.json().get("articles", []):
                url = (a.get("url") or "").strip()
                if not url or url in seen_urls:
                    continue
                source_name = (a.get("source") or {}).get("name", "").strip()
                if not source_name:
                    continue
                seen_urls.add(url)
                articles.append({
                    "title": (a.get("title") or "").strip(),
                    "description": (a.get("description") or "").strip(),
                    "url": url,
                    "published_at": a.get("publishedAt") or "",
                    "source_name": source_name,
                })
        except Exception as e:
            log.warning("GNews query '%s' failed: %s", q, e)

    log.info("GNews API: %d articles", len(articles))
    return articles


def fetch_mediastack() -> list[dict]:
    """Fetch AU political articles from Mediastack API."""
    if not MEDIASTACK_KEY:
        return []
    articles: list[dict] = []
    seen_urls: set[str] = set()

    params = {
        "access_key": MEDIASTACK_KEY,
        "countries": "au",
        "languages": "en",
        "keywords": "parliament,albanese,dutton,budget,election",
        "limit": 100,
        "sort": "published_desc",
    }
    try:
        r = requests.get("http://api.mediastack.com/v1/news", params=params, timeout=15)
        r.raise_for_status()
        for a in r.json().get("data", []):
            url = (a.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            source_name = (a.get("source") or "").strip()
            if not source_name:
                continue
            seen_urls.add(url)
            articles.append({
                "title": (a.get("title") or "").strip(),
                "description": (a.get("description") or "").strip(),
                "url": url,
                "published_at": a.get("published_at") or "",
                "source_name": source_name,
            })
    except Exception as e:
        log.warning("Mediastack failed: %s", e)

    log.info("Mediastack: %d articles", len(articles))
    return articles


def upsert_source(sb, source_name: str) -> dict | None:
    """Find existing source by name (case-insensitive) or create a new one."""
    resp = sb.table("news_sources").select("*").ilike("name", source_name).limit(1).execute()
    if resp.data:
        return resp.data[0]
    leaning = lookup_bias(source_name)
    slug = slugify(source_name)
    try:
        ins = sb.table("news_sources").insert({
            "name": source_name,
            "slug": slug,
            "leaning": leaning,
            "website_url": "",
        }).execute()
        if ins.data:
            log.info("  Created source: %s (%s)", source_name, leaning)
            return ins.data[0]
    except Exception as e:
        log.warning("  Failed to upsert source '%s': %s", source_name, e)
    return None


def process_article(
    sb,
    source_id: int,
    leaning: str,
    title: str,
    description: str,
    link: str,
    pub_date: datetime,
    image_url: str | None,
    existing_urls: set[str],
    existing_stories: list[dict],
    counters: dict,
) -> None:
    """Insert one article and link/create its story. Mutates counters in-place."""
    col = leaning_column(leaning)
    skip, reason = should_skip(title, description)
    if skip:
        counters["skipped"] += 1
        return

    if link in existing_urls:
        return

    category = guess_category(title + " " + description)

    try:
        ins = sb.table("news_articles").insert({
            "source_id": source_id,
            "title": title,
            "description": description[:1000] if description else None,
            "url": link,
            "published_at": pub_date.isoformat(),
            "image_url": image_url,
            "category": category,
        }).execute()
        article_row = ins.data[0] if ins.data else None
        if not article_row:
            return
        article_id = article_row["id"]
        existing_urls.add(link)
        counters["added"] += 1
    except Exception as e:
        log.warning("  Failed to insert '%s': %s", title[:60], e)
        return

    matched_story = find_matching_story(title, pub_date, description, existing_stories)

    if matched_story:
        try:
            sb.table("news_story_articles").insert({
                "story_id": matched_story["id"],
                "article_id": article_id,
            }).execute()
            sb.table("news_stories").update({
                "article_count": matched_story["article_count"] + 1,
                col: matched_story[col] + 1,
            }).eq("id", matched_story["id"]).execute()
            matched_story["article_count"] += 1
            matched_story[col] += 1
            counters["updated"] += 1
        except Exception as e:
            log.warning("  Failed to link story: %s", e)
    else:
        slug_base = slugify(title)
        slug = slug_base
        existing_slugs = {s["slug"] for s in existing_stories}
        if slug in existing_slugs:
            slug = f"{slug_base}-{article_id}"

        initial_counts = {"left_count": 0, "center_count": 0, "right_count": 0}
        initial_counts[col] = 1

        try:
            new_resp = sb.table("news_stories").insert({
                "headline": title,
                "slug": slug,
                "category": category,
                "first_seen": pub_date.isoformat(),
                "article_count": 1,
                "image_url": image_url,
                **initial_counts,
            }).execute()
            new_story = new_resp.data[0] if new_resp.data else None
            if not new_story:
                return
            new_story_id = new_story["id"]

            sb.table("news_story_articles").insert({
                "story_id": new_story_id,
                "article_id": article_id,
            }).execute()

            existing_stories.append({
                "id": new_story_id,
                "headline": title,
                "slug": slug,
                "first_seen": pub_date.isoformat(),
                "left_count": initial_counts["left_count"],
                "center_count": initial_counts["center_count"],
                "right_count": initial_counts["right_count"],
                "article_count": 1,
            })
            counters["created"] += 1
        except Exception as e:
            log.warning("  Failed to create story: %s", e)


def compute_story_metrics(sb, story_id: int, story: dict) -> dict:
    """
    Compute and return enriched metrics for a story:
      - blindspot:      "left" | "right" | None
      - avg_factuality: average factuality_numeric of sources covering the story
      - owner_count:    distinct owner count across sources
      - ai_summary:     2-sentence AI summary (only when article_count >= 5)

    Does NOT write to DB — caller is responsible for upserting.
    """
    left_count  = story.get("left_count", 0)
    right_count = story.get("right_count", 0)
    article_count = story.get("article_count", 0)

    # Blindspot
    blindspot: str | None = None
    if article_count >= 3:
        if left_count == 0 and right_count > 0:
            blindspot = "left"
        elif right_count == 0 and left_count > 0:
            blindspot = "right"

    # Fetch article IDs for this story
    junction = sb.table("news_story_articles").select("article_id").eq("story_id", story_id).execute()
    article_ids = [r["article_id"] for r in (junction.data or [])]

    avg_factuality: float | None = None
    owner_count: int = 0
    ai_summary: str | None = None

    if article_ids:
        # Fetch source metadata via articles
        arts = sb.table("news_articles").select(
            "title, news_sources(factuality_numeric, owner)"
        ).in_("id", article_ids).execute()

        fact_values = []
        owners: set[str] = set()
        titles: list[str] = []

        for a in (arts.data or []):
            src = a.get("news_sources") or {}
            fn = src.get("factuality_numeric")
            if fn is not None:
                fact_values.append(fn)
            owner = src.get("owner")
            if owner:
                owners.add(owner)
            if a.get("title"):
                titles.append(a["title"])

        if fact_values:
            avg_factuality = round(sum(fact_values) / len(fact_values), 1)
        owner_count = len(owners)

        # AI summary — only when enough articles and Anthropic available
        if article_count >= 5 and _ANTHROPIC_AVAILABLE and titles:
            anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
            if anthropic_key:
                try:
                    client = _anthropic.Anthropic(api_key=anthropic_key)
                    headlines_text = "\n".join(f"- {t}" for t in titles[:10])
                    msg = client.messages.create(
                        model="claude-haiku-4-5-20251001",
                        max_tokens=120,
                        messages=[{
                            "role": "user",
                            "content": (
                                f"Summarise this news story in exactly 2 sentences, "
                                f"neutral tone, no editorialising. Story: {story.get('headline', '')}\n\n"
                                f"Coverage headlines:\n{headlines_text}"
                            ),
                        }],
                    )
                    ai_summary = msg.content[0].text.strip() if msg.content else None
                except Exception as e:
                    log.warning("AI summary failed for story %d: %s", story_id, e)

    return {
        "blindspot": blindspot,
        "avg_factuality": avg_factuality,
        "owner_count": owner_count,
        "ai_summary": ai_summary,
    }


def backfill_story_metrics(sb, limit: int = 50) -> None:
    """Compute and persist metrics for recent stories lacking them."""
    stories = (
        sb.table("news_stories")
        .select("id, headline, left_count, center_count, right_count, article_count, blindspot")
        .gte("article_count", 3)
        .order("article_count", desc=True)
        .limit(limit)
        .execute()
    ).data or []

    log.info("Computing metrics for %d stories …", len(stories))
    for story in stories:
        metrics = compute_story_metrics(sb, story["id"], story)
        # Only write non-null fields; skip ai_summary if story already has one
        patch: dict = {}
        if metrics["blindspot"] is not None or story.get("blindspot") is None:
            patch["blindspot"] = metrics["blindspot"]
        if metrics["avg_factuality"] is not None:
            patch["avg_factuality"] = metrics["avg_factuality"]
        patch["owner_count"] = metrics["owner_count"]
        if metrics["ai_summary"]:
            patch["ai_summary"] = metrics["ai_summary"]
        if patch:
            try:
                sb.table("news_stories").update(patch).eq("id", story["id"]).execute()
            except Exception as e:
                log.warning("Failed to update metrics for story %d: %s", story["id"], e)

    log.info("Metrics backfill complete.")


def main():
    fresh = "--fresh" in sys.argv
    sb = get_supabase()

    if fresh:
        log.info("--fresh: clearing all news data...")
        sb.table("news_story_articles").delete().neq("id", 0).execute()
        sb.table("news_articles").delete().neq("id", 0).execute()
        sb.table("news_stories").delete().neq("id", 0).execute()
        log.info("Tables cleared.")

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=14)

    existing_resp = sb.table("news_articles").select("url").execute()
    existing_urls = {row["url"] for row in (existing_resp.data or [])}

    stories_resp = sb.table("news_stories").select(
        "id,headline,slug,first_seen,left_count,center_count,right_count,article_count"
    ).execute()
    existing_stories = stories_resp.data or []

    counters = {"added": 0, "skipped": 0, "created": 0, "updated": 0}
    per_source: dict[str, int] = {}       # source_name → articles added this run
    processed_titles: list[str] = []      # for cross-source title dedup

    def process_api_articles(articles: list[dict], label: str) -> None:
        """Process a normalised list of article dicts from any API/RSS source."""
        before = counters["added"]
        for item in articles:
            title = item["title"]
            description = item["description"]
            link = item["url"]
            if not title or not link:
                continue
            # Title dedup: skip if a near-identical title was already inserted
            if any(titles_are_similar(title, t) for t in processed_titles):
                counters["skipped"] += 1
                continue
            try:
                pub_date: datetime = datetime.fromisoformat(
                    item["published_at"].replace("Z", "+00:00")
                )
            except Exception:
                pub_date = datetime.now(tz=timezone.utc)
            if pub_date.tzinfo is None:
                pub_date = pub_date.replace(tzinfo=timezone.utc)
            if pub_date < cutoff:
                continue
            source = upsert_source(sb, item["source_name"])
            if not source:
                continue
            before_add = counters["added"]
            process_article(
                sb=sb, source_id=source["id"], leaning=source["leaning"],
                title=title, description=description, link=link,
                pub_date=pub_date, image_url=item.get("image_url"),
                existing_urls=existing_urls, existing_stories=existing_stories,
                counters=counters,
            )
            if counters["added"] > before_add:
                processed_titles.append(title)
                sn = item["source_name"]
                per_source[sn] = per_source.get(sn, 0) + 1
        log.info("%s: %d articles added", label, counters["added"] - before)

    # ── 1. NewsAPI ─────────────────────────────────────────────────────────────
    newsapi_articles = fetch_newsapi()
    if newsapi_articles:
        newsapi_articles.sort(key=lambda a: SOURCE_PRIORITY.get(a["source_name"].lower(), 5))
        process_api_articles(newsapi_articles, "NewsAPI")
    else:
        log.info("NewsAPI unavailable")

    # ── 2. Google News RSS ─────────────────────────────────────────────────────
    gnews_rss = fetch_google_news()
    if gnews_rss:
        gnews_rss.sort(key=lambda a: SOURCE_PRIORITY.get(a["source_name"].lower(), 5))
        process_api_articles(gnews_rss, "Google News RSS")

    # ── 3. GNews API ───────────────────────────────────────────────────────────
    gnews_api = fetch_gnews()
    if gnews_api:
        process_api_articles(gnews_api, "GNews API")

    # ── 4. Mediastack ──────────────────────────────────────────────────────────
    mediastack = fetch_mediastack()
    if mediastack:
        process_api_articles(mediastack, "Mediastack")

    # ── 5. Direct RSS feeds (stored in news_sources table) ────────────────────
    sources_resp = sb.table("news_sources").select("*").not_.is_("rss_url", "null").execute()
    rss_sources = sources_resp.data or []
    rss_sources.sort(key=lambda s: SOURCE_PRIORITY.get(s["name"].lower(), 5))
    log.info("Found %d sources with RSS feeds", len(rss_sources))

    for source in rss_sources:
        source_id = source["id"]
        leaning = source["leaning"]
        rss_url = source["rss_url"]
        log.info("Fetching %s", source["name"])

        try:
            feed = feedparser.parse(rss_url)
        except Exception as e:
            log.warning("  Failed: %s", e)
            continue

        source_before = counters["added"]
        for entry in feed.entries:
            title = getattr(entry, "title", "").strip()
            if not title:
                continue
            link = getattr(entry, "link", "").strip()
            if not link:
                continue

            description = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
            description = re.sub(r"<[^>]+>", "", description).strip()

            pub_date = parse_date(entry)
            if pub_date is None:
                pub_date = datetime.now(tz=timezone.utc)
            if pub_date < cutoff:
                continue

            # Title dedup
            if any(titles_are_similar(title, t) for t in processed_titles):
                counters["skipped"] += 1
                continue

            before_add = counters["added"]
            process_article(
                sb=sb, source_id=source_id, leaning=leaning,
                title=title, description=description, link=link,
                pub_date=pub_date, image_url=extract_image(entry),
                existing_urls=existing_urls, existing_stories=existing_stories,
                counters=counters,
            )
            if counters["added"] > before_add:
                processed_titles.append(title)
                sn = source["name"]
                per_source[sn] = per_source.get(sn, 0) + 1

        log.info("  → %d articles added from %s", counters["added"] - source_before, source["name"])

    # ── Stats ─────────────────────────────────────────────────────────────────
    multi2 = sum(1 for s in existing_stories if s["article_count"] >= 2)
    multi3 = sum(1 for s in existing_stories if s["article_count"] >= 3)
    multi5 = sum(1 for s in existing_stories if s["article_count"] >= 5)
    multi10 = sum(1 for s in existing_stories if s["article_count"] >= 10)
    top5 = sorted(existing_stories, key=lambda s: s["article_count"], reverse=True)[:5]

    per_source_lines = "".join(
        f"    {name:<40s}: {count}\n"
        for name, count in sorted(per_source.items(), key=lambda x: -x[1])
    )

    print(
        f"\n── Ingestion complete ──────────────────────────────\n"
        f"  Distinct sources  : {len(per_source)}\n"
        f"  Articles added    : {counters['added']}\n"
        f"  Articles skipped  : {counters['skipped']}\n"
        f"  Stories created   : {counters['created']}\n"
        f"  Stories updated   : {counters['updated']}\n"
        f"  Stories with 2+   : {multi2}\n"
        f"  Stories with 3+   : {multi3}\n"
        f"  Stories with 5+   : {multi5}\n"
        f"  Stories with 10+  : {multi10}\n"
        f"\n  Articles per source:\n{per_source_lines}"
        f"\n  Top stories by source count:\n"
        + "".join(
            f"    {s['article_count']:2d} sources — {s['headline'][:80]}\n"
            for s in top5
        )
    )

    # Compute story metrics (blindspot, factuality, AI summary) after ingestion
    if "--no-metrics" not in sys.argv:
        backfill_story_metrics(sb, limit=60)


if __name__ == "__main__":
    main()
