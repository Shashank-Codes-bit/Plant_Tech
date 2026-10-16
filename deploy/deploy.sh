#!/usr/bin/env bash
# Deploy NurseryPOS on the shared VM:  deploy.sh staging | deploy.sh prod
# Syncs the checkout to its branch, rebuilds, and fails unless /health answers within 60 s.
# Also run by the GitHub Actions deploy key through ~/bin/nurserypos-ci-deploy.
set -euo pipefail

case "${1:-}" in
  staging) DIR="$HOME/Plant_Tech-staging"; BRANCH=staging ;;
  prod)    DIR="$HOME/Plant_Tech";         BRANCH=main ;;
  *) echo "usage: deploy.sh staging|prod" >&2; exit 2 ;;
esac

# Sync first, then re-run the freshly checked-out copy of this script.
if [ "${NURSERYPOS_SYNCED:-}" != 1 ]; then
  git -C "$DIR" fetch --quiet origin "$BRANCH"
  git -C "$DIR" reset --hard --quiet "origin/$BRANCH"
  NURSERYPOS_SYNCED=1 exec "$DIR/deploy/deploy.sh" "$1"
fi

cd "$DIR/deploy"
echo "==> deploying $1: $(git log --oneline -1)"
PORT=$(grep -E '^HOST_PORT=' .env | cut -d= -f2 || true); PORT=${PORT:-8120}
PROJECT=$(grep -E '^PROJECT_NAME=' .env | cut -d= -f2 || true); PROJECT=${PROJECT:-nurserypos}

docker compose up -d --build --remove-orphans

for _ in $(seq 1 30); do
  if curl -fsS -m 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "==> $1 healthy on 127.0.0.1:$PORT"
    docker compose logs --tail 6 web
    # only this project's dangling images; never touch other sites' images
    docker image prune -f --filter "label=com.docker.compose.project=$PROJECT" >/dev/null || true
    exit 0
  fi
  sleep 2
done

echo "==> $1 NOT healthy after 60 s" >&2
docker compose logs --tail 40 web >&2
exit 1
