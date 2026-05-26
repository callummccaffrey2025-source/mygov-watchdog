#!/usr/bin/env python3
"""
classify_speeches.py — Classify Hansard speeches against TVFY policies using Claude Haiku.

For each unclassified speech:
1. Find top 5 candidate policies by keyword overlap
2. Send speech + candidates to Haiku
3. Insert classification if confidence >= 0.6

Usage:
  python scripts/classify_speeches.py --dev              # classify all
  python scripts/classify_speeches.py --dev --limit 20   # first 20 only
  python scripts/classify_speeches.py --dev --dry-run    # preview only
"""

import os, sys, json, logging, time, re
from collections import Counter
import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Env ──────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.expanduser('~/verity/mobile/.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k, v)

load_env()

DRY_RUN = '--dry-run' in sys.argv
LIMIT = None
for i, arg in enumerate(sys.argv):
    if arg == '--limit' and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
if not ANTHROPIC_KEY:
    log.error("ANTHROPIC_API_KEY not set"); sys.exit(1)

DEV_URL = 'https://azvwzfsnzopeyzxzexto.supabase.co'
DEV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dnd6ZnNuem9wZXl6eHpleHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjU0NjAsImV4cCI6MjA5MjAwMTQ2MH0.i9aQpbgXHj8lfdKqhraJia9fgcTuRqVCXEFV1Lyhd9k'

DB_HEADERS = {
    'apikey': DEV_KEY,
    'Authorization': f'Bearer {DEV_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
}

# ── Load policies ────────────────────────────────────────────────

def load_policies() -> list[dict]:
    resp = requests.get(f'{DEV_URL}/rest/v1/tvfy_policies?select=id,name,description&order=id',
        headers={'apikey': DEV_KEY, 'Authorization': f'Bearer {DEV_KEY}'}, timeout=30)
    policies = resp.json()
    log.info(f"Loaded {len(policies)} policies")
    return policies

def load_unclassified_speeches() -> list[dict]:
    # Get speeches that don't have any classification yet
    resp = requests.get(
        f'{DEV_URL}/rest/v1/hansard_speeches?select=id,mp_id,debate_title,speech_date,raw_text,word_count&order=speech_date.desc',
        headers={'apikey': DEV_KEY, 'Authorization': f'Bearer {DEV_KEY}',
                 'Range': f'0-{(LIMIT or 500) - 1}'},
        timeout=30)
    speeches = resp.json()

    # Get already-classified speech IDs
    resp2 = requests.get(f'{DEV_URL}/rest/v1/speech_classifications?select=speech_id',
        headers={'apikey': DEV_KEY, 'Authorization': f'Bearer {DEV_KEY}'}, timeout=30)
    classified = {c['speech_id'] for c in resp2.json()}

    unclassified = [s for s in speeches if s['id'] not in classified]
    log.info(f"Speeches: {len(speeches)} total, {len(classified)} already classified, {len(unclassified)} to process")
    return unclassified

# ── Keyword matching ─────────────────────────────────────────────

def tokenize(text: str) -> set[str]:
    """Simple word tokenization, lowered, stripped of punctuation."""
    return set(re.findall(r'[a-z]{3,}', text.lower()))

def find_candidate_policies(speech_text: str, policies: list[dict], top_n: int = 5) -> list[dict]:
    """Find top N policies by keyword overlap with the speech text."""
    speech_tokens = tokenize(speech_text)
    if not speech_tokens:
        return []

    scores = []
    for p in policies:
        policy_tokens = tokenize(f"{p['name']} {p.get('description', '')}")
        overlap = len(speech_tokens & policy_tokens)
        if overlap > 0:
            scores.append((overlap, p))

    scores.sort(key=lambda x: -x[0])
    return [s[1] for s in scores[:top_n]]

# ── Haiku classification ────────────────────────────────────────

SYSTEM_PROMPT = """You classify Australian parliamentary speeches against policy topics from TheyVoteForYou.org.au.

For each speech, determine which (if any) of the candidate policies the speech is actually about, and what the speaker's stated position is on that policy.

Respond ONLY with a JSON array. For each speech, return one object:
{"speech_idx": <int>, "policy_id": <int|null>, "position": <float from -1.0 to 1.0>, "confidence": <float from 0.0 to 1.0>, "excerpt": "<most representative ~30-word quote from the speech>"}

- position: -1.0 = strongly against the policy, 0.0 = neutral, 1.0 = strongly for the policy
- confidence: how confident you are that this speech is actually about this policy (0.0-1.0)
- If the speech doesn't clearly match any candidate policy, set policy_id to null and confidence to 0.0
- Be conservative: only classify if the speech clearly addresses the policy topic"""

def classify_batch(speeches_with_candidates: list[dict]) -> list[dict]:
    """Send a batch of speeches to Haiku for classification."""
    messages_content = []
    for i, item in enumerate(speeches_with_candidates):
        candidates_str = "\n".join(
            f"  Policy {p['id']}: {p['name']} — {p.get('description', '')[:100]}"
            for p in item['candidates']
        )
        messages_content.append(
            f"--- Speech {i} ---\n"
            f"Debate: {item['speech']['debate_title']}\n"
            f"Date: {item['speech']['speech_date']}\n"
            f"Text: {item['speech']['raw_text'][:2000]}\n"
            f"Candidate policies:\n{candidates_str}\n"
        )

    user_message = "\n".join(messages_content)

    for attempt in range(3):
        try:
            resp = requests.post('https://api.anthropic.com/v1/messages', headers={
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            }, json={
                'model': 'claude-haiku-4-5-20251001',
                'max_tokens': 2048,
                'system': SYSTEM_PROMPT,
                'messages': [{'role': 'user', 'content': user_message}],
            }, timeout=60)

            if resp.status_code == 529:
                wait = (attempt + 1) * 5
                log.warning(f"  Haiku overloaded, retrying in {wait}s (attempt {attempt+1}/3)")
                time.sleep(wait)
                continue

            if resp.status_code != 200:
                log.error(f"Haiku API error: {resp.status_code} {resp.text[:200]}")
                return []

            data = resp.json()
            content = data['content'][0]['text']

            usage = data.get('usage', {})
            input_tokens = usage.get('input_tokens', 0)
            output_tokens = usage.get('output_tokens', 0)
            cost = (input_tokens * 0.80 + output_tokens * 4.00) / 1_000_000
            log.info(f"  Haiku: {input_tokens} in / {output_tokens} out = ${cost:.4f}")

            match = re.search(r'\[[\s\S]*\]', content)
            if not match:
                log.warning(f"  No JSON array in response: {content[:200]}")
                return []

            results = json.loads(match.group())
            return results

        except Exception as e:
            log.error(f"Classification error: {e}")
            if attempt < 2:
                time.sleep(3)
                continue
            return []

    log.warning("  All 3 attempts failed")
    return []

# ── Main ─────────────────────────────────────────────────────────

def main():
    log.info(f"Dry run: {DRY_RUN} | Limit: {LIMIT or 'all'}")

    policies = load_policies()
    # Filter out procedural policies (112, 113, 114)
    policies = [p for p in policies if p['id'] not in (112, 113, 114)]
    log.info(f"Using {len(policies)} non-procedural policies")

    speeches = load_unclassified_speeches()
    if not speeches:
        log.info("No speeches to classify."); return

    # Find candidates for each speech
    items = []
    no_candidates = 0
    for s in speeches:
        text = f"{s['debate_title']} {s['raw_text']}"
        candidates = find_candidate_policies(text, policies, top_n=5)
        if not candidates:
            no_candidates += 1
            continue
        items.append({'speech': s, 'candidates': candidates})

    log.info(f"Speeches with candidates: {len(items)}, without candidates (skipped): {no_candidates}")

    if DRY_RUN:
        for item in items[:3]:
            s = item['speech']
            cands = item['candidates']
            log.info(f"\n  [{s['speech_date']}] {s['debate_title'][:50]}")
            log.info(f"  Text: {s['raw_text'][:100]}...")
            log.info(f"  Candidates: {', '.join(c['name'][:30] for c in cands)}")
        return

    # Batch classify (10 speeches per Haiku call)
    BATCH_SIZE = 10
    total_classified = 0
    total_discarded = 0
    total_cost = 0.0

    for batch_start in range(0, len(items), BATCH_SIZE):
        batch = items[batch_start:batch_start + BATCH_SIZE]
        log.info(f"Batch {batch_start // BATCH_SIZE + 1}: classifying {len(batch)} speeches...")

        results = classify_batch(batch)

        # Insert valid classifications
        rows_to_insert = []
        for r in results:
            idx = r.get('speech_idx', -1)
            if idx < 0 or idx >= len(batch):
                continue

            policy_id = r.get('policy_id')
            confidence = r.get('confidence', 0)
            position = r.get('position', 0)
            excerpt = r.get('excerpt', '')

            if policy_id is None or confidence < 0.6:
                total_discarded += 1
                continue

            rows_to_insert.append({
                'speech_id': batch[idx]['speech']['id'],
                'policy_id': policy_id,
                'stated_position': round(max(-1, min(1, position)), 2),
                'confidence': round(max(0, min(1, confidence)), 2),
                'excerpt': excerpt[:500] if excerpt else None,
                'model_used': 'claude-haiku-4-5-20251001',
            })

        if rows_to_insert:
            resp = requests.post(f'{DEV_URL}/rest/v1/speech_classifications',
                headers=DB_HEADERS, json=rows_to_insert, timeout=30)
            if resp.status_code in (200, 201):
                total_classified += len(rows_to_insert)
                log.info(f"  Inserted {len(rows_to_insert)} classifications")
            else:
                log.error(f"  Insert error: {resp.status_code} {resp.text[:200]}")

        time.sleep(1)  # Rate limit

    log.info(f"\n=== DONE ===")
    log.info(f"Classified: {total_classified}")
    log.info(f"Discarded (confidence < 0.6): {total_discarded}")

if __name__ == '__main__':
    main()
