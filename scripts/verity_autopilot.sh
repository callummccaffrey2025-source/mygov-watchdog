#!/bin/bash
set -e
cd ~/verity/mobile
DATE=$(date +%Y-%m-%d)
LOG=~/verity/logs/$DATE.log
mkdir -p ~/verity/logs

echo "=== Verity Autopilot: $DATE ===" >> $LOG

# Step 1: Ingest fresh news
echo "[$(date)] Starting news ingestion..." >> $LOG
python scripts/ingest_news.py --fresh >> $LOG 2>&1 || echo "[$(date)] News ingestion failed" >> $LOG

# Step 2: Generate daily brief via Edge Function
echo "[$(date)] Triggering daily brief generation..." >> $LOG
source .env
curl -s -X POST "https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/generate-daily-brief" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" >> $LOG 2>&1 || echo "[$(date)] Brief generation failed" >> $LOG

# Step 3: Mac notification
osascript -e "display notification \"Verity autopilot complete for $DATE\" with title \"Verity\""

echo "[$(date)] Autopilot complete." >> $LOG
