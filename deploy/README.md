# Deploying NurseryPOS on an Oracle Cloud VM

This runs three containers: the FastAPI backend, MongoDB, and Caddy. Caddy serves HTTPS with a free Let's Encrypt certificate. Product photos go to Cloudflare R2, or to the VM disk if `STORAGE_BACKEND=local`.

## 1. Create the VM (one time)
1. Go to Oracle Cloud → Compute → Instances → **Create instance**.
   - Image: **Ubuntu 22.04**.
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM, Always Free), with 1–2 OCPU and 6–12 GB RAM.
   - Download the SSH key.
2. Open the firewall in Oracle's console: Networking → VCN → Subnet → **Security List** → Add Ingress Rules.
   - Source `0.0.0.0/0`, TCP, destination port **80**.
   - Same again for port **443**.
3. Get a hostname that points at the VM's public IP. Either:
   - **DuckDNS** (free): create `yourname.duckdns.org` and set its IP to the VM's public IP, or
   - **sslip.io**: no signup, just use `<public-ip-with-dashes>.sslip.io`, e.g. `140-238-1-2.sslip.io`.

## 2. Prepare the VM
Run these commands over SSH (`ssh -i key.pem ubuntu@<public-ip>`):

```bash
# Oracle's Ubuntu image blocks 80/443 in iptables even after the Security List allows them
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker

git clone https://github.com/udyanojha/Nzone.git && cd Nzone
```

## 3. Cloudflare R2 (photos)
1. In the Cloudflare dashboard, go to R2 → **Create bucket** and name it `nurserypos-photos`.
2. Go to R2 → **Manage API tokens** → Create a token with **Object Read & Write** on that bucket.
3. Copy the Account ID, Access Key ID and Secret Access Key into `backend/.env`.

The bucket stays private. The app fetches photos through `/api/files/...`.

## 4. Configure and start
```bash
cp backend/.env.example backend/.env
nano backend/.env          # set ANTHROPIC_API_KEY, APP_API_KEY (openssl rand -hex 24), R2_*
cd deploy
DOMAIN=yourname.duckdns.org docker compose up -d --build
docker compose logs -f api # expect "Seed check complete" and "Storage initialized"
```

Check that it works by opening `https://yourname.duckdns.org/api/` on your phone. It should show `{"detail":"Unauthorized"}`, which means the server is running and the app key check is on. To test with the key:

```bash
curl -H "X-App-Key: <APP_API_KEY>" https://yourname.duckdns.org/api/
```

## 5. Updating after code changes
```bash
cd ~/Nzone && git pull && cd deploy && DOMAIN=yourname.duckdns.org docker compose up -d --build
```

## 6. Backups
```bash
chmod +x ~/Nzone/deploy/backup.sh
crontab -e   # add:  0 2 * * * /home/ubuntu/Nzone/deploy/backup.sh
```

Backups go to `deploy/backups/` and are kept for 14 days. Copy them off the VM now and then, for example to R2 with `rclone`.

To restore: `docker compose exec -T mongo mongorestore --archive --gzip < backups/<file>`

## Notes
- **Idle reclaim:** Oracle can reclaim Always Free A1 instances that stay idle for 7 days. To avoid this, upgrade the account to Pay-As-You-Go. Always Free resources still cost ₹0.
- **Cost:** the only running cost is Claude API usage, roughly ₹0.4 per plant scan on Sonnet 5.5. Check the actual token usage in `docker compose logs api` (lines starting with `Claude ...`).
- **Switching models:** set `CLAUDE_MODEL` in `backend/.env`, then run `docker compose up -d`.
