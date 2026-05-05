#!/bin/bash
# Refresh all ingestion scripts for Verity.
#
# Run manually:
#   bash ~/verity/mobile/scripts/refresh_all.sh
#
# To schedule every 6 hours via cron:
#   crontab -e
#   Add this line:
#   0 */6 * * * /bin/bash ~/verity/mobile/scripts/refresh_all.sh >> ~/verity/mobile/scripts/refresh.log 2>&1

set -e
cd ~/verity/mobile

echo "=== [$(date)] Refreshing bills from APH ==="
python scripts/ingest_federal_bills.py

echo "=== [$(date)] Refreshing news ==="
python scripts/ingest_news.py

echo "=== [$(date)] Refreshing votes ==="
python scripts/ingest_votes.py

echo "=== [$(date)] Done ==="
