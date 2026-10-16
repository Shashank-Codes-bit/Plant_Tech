#!/usr/bin/env bash
# Keeps a demo shop looking fresh: once a day every date in the shop moves forward, so its newest day of
# orders is today again. Only runs on a shop that has demo data (backend/demo_data.py).
# Cron on the VM (UTC), daily at 5:30 am India time:
#   0 0 * * * bash /home/ubuntu/Plant_Tech-staging/deploy/demo-refresh.sh staging 9654346434 >> /home/ubuntu/nurserypos-demo.log 2>&1
# First time for a shop: docker compose exec web python demo_data.py seed --phone <owner phone>
set -euo pipefail

case "${1:-}" in
  staging) DIR="$HOME/Plant_Tech-staging" ;;
  prod)    DIR="$HOME/Plant_Tech" ;;
  *) echo "usage: demo-refresh.sh staging|prod <owner phone>" >&2; exit 2 ;;
esac
PHONE="${2:?owner phone}"

cd "$DIR/deploy"
docker compose exec -T web python demo_data.py refresh --phone "$PHONE" </dev/null
