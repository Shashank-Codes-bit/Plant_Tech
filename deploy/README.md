# Deploying NurseryPOS on the shared Oracle VM

NurseryPOS runs on the **shared** Oracle VM (`svc-agent`, `140.238.251.141`). Other live sites run there too. The VM's general rules and setup are in `DEPLOYMENT-GUIDE.md`. This file only covers this app.

| | |
|---|---|
| URL | **https://nurserypos.140-238-251-141.sslip.io** |
| Port | **8120** (bound to `127.0.0.1` only; the VM's Caddy is the way in) |
| Containers | `web` (FastAPI) + `mongo` (MongoDB 7, internal only), compose project `nurserypos` |
| Data | volumes `nurserypos_mongo` (database) and `nurserypos_data` (`/data/uploads` when `STORAGE_BACKEND=local`) |
| Photos | Cloudflare R2 bucket `nurserypos-photos` |
| Secrets | `~/Plant_Tech/deploy/.env` on the VM only |
| Health | `curl 127.0.0.1:8120/health` → `{"ok":true}` |

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
