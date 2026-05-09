#!/bin/bash
# verity_cron.sh — Master cron entry point for Verity automation.
#
# Install in crontab:
#   crontab -e
#   # Full pipeline at 6am AEST (news + votes + summaries + health + alert)
#   0 20 * * * /bin/bash ~/verity/mobile/scripts/verity_cron.sh full >> ~/verity/logs/cron.log 2>&1
#   # News refresh every 6 hours
#   0 2,8,14 * * * /bin/bash ~/verity/mobile/scripts/verity_cron.sh news >> ~/verity/logs/cron.log 2>&1
#
# Usage:
#   bash scripts/verity_cron.sh full     # Full pipeline + alerting
#   bash scripts/verity_cron.sh news     # Just news refresh
#   bash scripts/verity_cron.sh health   # Just health check + alert
#   bash scripts/verity_cron.sh status   # Quick status (no pipeline run)

set -euo pipefail
cd ~/verity/mobile

MODE="${1:-full}"
LOG_DIR=~/verity/logs
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== [$TIMESTAMP] verity_cron.sh mode=$MODE ==="

case "$MODE" in
  full)
    python scripts/orchestrate.py 2>&1 | tee "$LOG_DIR/pipeline_$TIMESTAMP.log"
    python scripts/ops_alert.py --force
    ;;
  news)
    python scripts/ingest_news.py --fresh 2>&1 | tee "$LOG_DIR/news_$TIMESTAMP.log"
    python scripts/ops_alert.py
    ;;
  health)
    python scripts/data_monitor.py 2>&1 | tee "$LOG_DIR/health_$TIMESTAMP.log"
    python scripts/ops_alert.py
    ;;
  status)
    python scripts/ops_alert.py --force
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: verity_cron.sh {full|news|health|status}"
    exit 1
    ;;
esac

# Clean up old logs (keep 7 days)
find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

echo "=== [$(date +%Y%m%d_%H%M%S)] Done ==="
