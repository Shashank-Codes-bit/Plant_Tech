# Deploying NurseryPOS on the shared Oracle VM

NurseryPOS runs on the **shared** Oracle VM (`svc-agent`, `140.238.251.141`). Other live sites run there too. The VM's general rules and setup are in `DEPLOYMENT-GUIDE.md`. This file only covers this app.

| | Production | Staging (QA) |
|---|---|---|
| Branch | `main` | `staging` |
| URL | **https://nurserypos.140-238-251-141.sslip.io** | **https://nurserypos-staging.140-238-251-141.sslip.io** |
| Port (127.0.0.1 only) | 8120 | 8130 |
| Folder on the VM | `~/Plant_Tech` | `~/Plant_Tech-staging` |
| Compose project / volumes | `nurserypos` (`nurserypos_mongo`, `nurserypos_data`) | `nurserypos-staging` (its own database) |
| Photos (R2 bucket `nurserypos-photos`) | folder `nurserypos/` | folder `nurserypos-staging/` |
| Secrets | `~/Plant_Tech/deploy/.env` | `~/Plant_Tech-staging/deploy/.env` (own `APP_API_KEY`, plus `PROJECT_NAME`, `HOST_PORT`, `STORAGE_PREFIX`) |
| App | "NurseryPOS" (`eas build --profile prod-apk`) | "NurseryPOS QA" (`eas build --profile staging`) |

Health: `curl 127.0.0.1:8120/health` (or `8130`) returns `{"ok":true}`.

## Day-to-day: how code reaches the server
1. Commit to `staging` and push. GitHub Actions (`.github/workflows/deploy.yml`) runs the offline smoke test. If it passes, Actions SSHes in with the restricted deploy key and runs `deploy/deploy.sh staging`, then checks the public `/health`.
2. Test in the "NurseryPOS QA" app with `docs/QA-CHECKLIST.md`.
3. Merge `staging` into `main` and push. The same pipeline deploys to production.

Only changes under `backend/`, `deploy/` or the workflow trigger a deploy. App (screen) changes need a new APK instead.

To deploy by hand on the VM, run `~/Plant_Tech/deploy/deploy.sh prod` or `~/Plant_Tech-staging/deploy/deploy.sh staging`. The script syncs the folder to its branch, rebuilds, and fails if `/health` doesn't answer within 60 s.

**The deploy key:**
- GitHub secret `NURSERYPOS_DEPLOY_KEY`; the private half is `~/.ssh/nurserypos_deploy` on Shashank's PC.
- It's locked in the VM's `~/.ssh/authorized_keys` to `~/bin/nurserypos-ci-deploy` (a copy of `deploy/ci-deploy`). It can only ask for `staging` or `prod`, and gets no shell.
- To revoke it, delete that line from `authorized_keys`.

## First deploy
Log in from Windows PowerShell. Disconnect the Voltas VPN first:
```powershell
ssh -i "$env:USERPROFILE\.ssh\oracle-svc-agent.key" ubuntu@140.238.251.141
```

Then, on the VM:
```bash
free -h                                     # check there's room; Mongo + API need about 400 MB
git clone https://github.com/Shashank-Codes-bit/Plant_Tech.git ~/Plant_Tech
cd ~/Plant_Tech/deploy
cp .env.example .env
openssl rand -hex 24                        # copy this: it's your APP_API_KEY
nano .env                                   # fill in ANTHROPIC_API_KEY, APP_API_KEY, R2_* (never commit)

docker compose up -d --build                # first build on Arm takes a few minutes
docker compose ps                           # web and mongo: running
docker compose logs web | tail -20          # expect "Seed check complete", "Storage initialized"
curl -s 127.0.0.1:8120/health               # {"ok":true}

sudo bash ~/Service-Call-Bot/infra/oracle-vm/add-site.sh nurserypos proxy 8120
```

Check it from outside:
- `https://nurserypos.140-238-251-141.sslip.io/api/` should return `{"detail":"Unauthorized"}`. That means it's up and the app-key check is on.
- `curl -H "X-App-Key: <APP_API_KEY>" https://nurserypos.140-238-251-141.sslip.io/api/` should return `{"message":"NurseryPOS API"}`.
- The other sites must still work: `https://140-238-251-141.sslip.io/health`, `https://alerts.140-238-251-141.sslip.io`, `https://mehtamart.140-238-251-141.sslip.io` and `https://plantstore.140-238-251-141.sslip.io`.

## Update, logs, rollback
```bash
cd ~/Plant_Tech && git pull && cd deploy && docker compose up -d --build
docker compose logs -f web                  # "Claude ... in=… out=…" lines show tokens per scan
docker compose restart web
git log --oneline -5 && git checkout <good-commit> && docker compose up -d --build
```

**Never run `docker compose down -v`.** The `-v` flag deletes the database volume.

## Backups
```bash
chmod +x ~/Plant_Tech/deploy/backup.sh
crontab -e   # add:  0 2 * * * /home/ubuntu/Plant_Tech/deploy/backup.sh
```

Backups go to `deploy/backups/` and are kept for 14 days. To restore:
```bash
docker compose exec -T mongo mongorestore --archive --gzip < backups/<file>
```

## Settings
- **Claude model:** set `CLAUDE_MODEL` in `.env`, then run `docker compose up -d`. The default is `claude-sonnet-5-5`.
- **Photo storage:** `STORAGE_BACKEND=r2` (default) or `local` (the VM's disk, in the `data` volume).
