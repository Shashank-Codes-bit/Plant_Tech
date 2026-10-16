#!/usr/bin/env bash
# Daily MongoDB backup. Add to crontab:  0 2 * * * /home/ubuntu/Nzone/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%F)
docker compose exec -T mongo mongodump --archive --gzip > "backups/nurserypos-$STAMP.archive.gz"
# keep 14 days
find backups -name 'nurserypos-*.archive.gz' -mtime +14 -delete
