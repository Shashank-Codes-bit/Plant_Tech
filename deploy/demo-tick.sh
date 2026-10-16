#!/usr/bin/env bash
# Keeps a demo shop looking alive: adds the day's orders as their time comes, restocks once a day.
# Cron on the VM, every 15 minutes:
#   */15 * * * * bash /home/ubuntu/Plant_Tech-staging/deploy/demo-tick.sh staging 9654346434 >> /home/ubuntu/nurserypos-demo.log 2>&1
# First time for a shop: docker compose exec web python demo_data.py seed --phone <owner phone>
set -euo pipefail

case "${1:-}" in
  staging) DIR="$HOME/Plant_Tech-staging" ;;
  prod)    DIR="$HOME/Plant_Tech" ;;
  *) echo "usage: demo-tick.sh staging|prod <owner phone>" >&2; exit 2 ;;
esac
PHONE="${2:?owner phone}"

cd "$DIR/deploy"
docker compose exec -T web python demo_data.py tick --phone "$PHONE" </dev/null
