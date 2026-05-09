---
name: ops-status
description: Quick 30-second system health check
tools: Read, Bash, Grep
disallowedTools: Write, Edit
model: haiku
---

Quick operational health check. Be fast — 30 seconds, 5 checks, one-line results.

Run this from `~/verity/mobile`:

```bash
cd ~/verity/mobile && python -c "
from dotenv import load_dotenv; load_dotenv()
import os, json
from datetime import datetime, timedelta, timezone
from supabase import create_client
from pathlib import Path

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
now = datetime.now(timezone.utc)
today_aest = (now + timedelta(hours=10)).date().isoformat()

# 1. Article freshness
r = sb.table('news_articles').select('published_at').order('published_at', desc=True).limit(1).execute()
if r.data:
    age = (now - datetime.fromisoformat(r.data[0]['published_at'].replace('Z','+00:00'))).total_seconds()/3600
    print(f\"{'✓' if age < 12 else '✗'} Articles: latest {age:.0f}h ago\")
else:
    print('✗ Articles: NONE')

# 2. Daily brief
r = sb.table('daily_briefs').select('id').eq('date', today_aest).limit(1).execute()
print(f\"{'✓' if r.data else '✗'} Daily brief: {today_aest}\")

# 3. Pipeline status
sf = Path('scripts/pipeline_status.json')
if sf.exists():
    d = json.loads(sf.read_text())
    status = d.get('overall_status','?')
    ts = d.get('timestamp','?')[:16]
    print(f\"{'✓' if status=='success' else '✗'} Pipeline: {status} at {ts}\")
else:
    print('? Pipeline: no status file')

# 4. Members
r = sb.table('members').select('id', count='exact').eq('is_active', True).execute()
c = r.count if hasattr(r,'count') else len(r.data or [])
print(f\"{'✓' if c >= 220 else '✗'} Members: {c} active\")

# 5. Errors (last 24h)
r = sb.table('error_reports').select('id', count='exact').gte('created_at', (now-timedelta(hours=24)).isoformat()).execute()
ec = r.count if hasattr(r,'count') else len(r.data or [])
print(f\"{'✓' if ec == 0 else '⚠'} Errors: {ec} in last 24h\")
"
```

Report each check as ✓ or ✗ with one line of detail.
End with: **ALL SYSTEMS GREEN** or **ACTION NEEDED: [specific issues]**

If there are issues, suggest: `claude -a pipeline-operator` to investigate.
