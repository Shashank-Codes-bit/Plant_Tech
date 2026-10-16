# NurseryPOS

A mobile point-of-sale app for plant nurseries. Staff photograph a plant, AI (Claude) names it and finds it in stock, it goes into the bill, and the customer pays (Cash / UPI / Card) and gets an invoice. Stock updates on its own. Supplier bills can be photographed too, and their items are added to stock.

| Part | Tech | Folder |
|---|---|---|
| App (Android, later iOS) | Expo / React Native, Expo Router, React Query | `frontend/` |
| API | FastAPI, MongoDB (Motor), Claude via the Anthropic SDK | `backend/` |
| Photos | Cloudflare R2 (or local disk) | `backend/storage_client.py` |
| Hosting | Docker on the shared Oracle VM, behind its Caddy | `deploy/` |

## Environments

| | Branch | API | App |
|---|---|---|---|
| Production | `main` | https://nurserypos.140-238-251-141.sslip.io | "NurseryPOS" (`eas build --profile prod-apk`) |
| Staging / QA | `staging` | https://nurserypos-staging.140-238-251-141.sslip.io | "NurseryPOS QA" (`eas build --profile staging`) |

Pushing to `staging` or `main` runs the backend tests and then deploys automatically (`.github/workflows/deploy.yml`). Server details are in [deploy/README.md](deploy/README.md), and the manual test script is [docs/QA-CHECKLIST.md](docs/QA-CHECKLIST.md).

## Run locally

**Backend tests** (offline: Claude and MongoDB are faked):
```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest
```

**App in a browser** (quick UI check; the camera works only on a phone):
```bash
cd frontend
yarn install
npx expo start --web
```
Before running, create `frontend/.env` from `frontend/.env.example` and point it at the staging API.

## Configuration
- **Server:** `deploy/.env` on the VM. See `deploy/.env.example`. Never commit it.
- **App:** `EXPO_PUBLIC_BACKEND_URL` comes from `frontend/eas.json` (per profile), and `EXPO_PUBLIC_APP_KEY` comes from Expo's environment variables (`preview` = staging, `production` = prod).
- **AI model:** `CLAUDE_MODEL` (default `claude-sonnet-5-5`).
