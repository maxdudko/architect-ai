# Deploy Architect AI on a Hostinger VPS

Step-by-step production deploy on a single Ubuntu VPS. The same steps work on similar providers (DigitalOcean, Hetzner, Linode) as long as you have root SSH, a public IPv4, and Docker Compose.

The stack is `docker-compose.prod.yml`: Caddy terminates TLS; Postgres, Redis, and Qdrant stay on the internal Docker network.

```text
Internet :80 / :443
        │
      Caddy
     /     \
 web:3000  api:5000
              │
     postgres / redis / qdrant
              │
      indexing-worker
```

AWS-specific notes (EBS, security groups, Elastic IP) live in [EC2 deployment](./deploy-ec2.md).

## What you need

| Item               | Notes                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| VPS                | Hostinger **KVM 2** (2 vCPU, 8 GB RAM, 100 GB disk) is the minimum. Use KVM 4 (16 GB) if you index large repositories. |
| OS                 | Ubuntu 24.04 LTS (plain Ubuntu, not a control-panel / WordPress template).                                             |
| Domain             | Optional at first. Hostinger gives `srvXXXXX.hstgr.cloud`. A real domain with `app.` and `api.` hostnames is better.   |
| GitHub repo access | Private repos need a **read-only deploy key** on the VPS.                                                              |
| Accounts           | GitHub OAuth App, Google OAuth client (or placeholders — see below), Stripe, Resend, and an OpenAI (or other) API key. |

Do **not** use Hostinger shared / web hosting. This stack needs Docker and a background worker.

## 1. Create the VPS

In hPanel:

1. Create a VPS with **Ubuntu 24.04 LTS**.
2. Add your laptop SSH public key.
3. Note the **static IPv4** and the default hostname (`srvXXXXX.hstgr.cloud`).
4. Open **VPS → Firewall** and allow only:
   - **22** from your IP
   - **80** TCP from anywhere (Let’s Encrypt HTTP-01 + redirect)
   - **443** TCP and UDP from anywhere (HTTPS + HTTP/3)

Do not open 3000, 5000, 5432, 6379, or 6333.

## 2. Point DNS

**Custom domain (recommended):**

| Record | Name  | Value    |
| ------ | ----- | -------- |
| A      | `app` | VPS IPv4 |
| A      | `api` | VPS IPv4 |

Wait until both names resolve before starting Caddy.

If you use Cloudflare, keep records **DNS only** until Caddy has issued certificates. After that, orange-cloud is fine only with SSL mode **Full** (not Flexible).

**Hostinger default hostname only:** skip extra DNS. Caddy will get a certificate for `srvXXXXX.hstgr.cloud`. You cannot create `app.srv….hstgr.cloud` — you do not control that zone. Use the [single-hostname](#single-hostname-hostinger-default) env layout below.

## 3. First SSH and a `deploy` user

Hostinger’s default login is **root** (panel password or the key you added).

```bash
ssh root@YOUR_VPS_IP
```

Create a non-root user. `--disabled-password` means the account has **no password**, so `sudo` will fail until you either set one or allow passwordless sudo.

```bash
apt-get update
apt-get install -y ca-certificates curl git ufw fail2ban

adduser --disabled-password --gecos '' deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
visudo -cf /etc/sudoers.d/deploy
```

Log out and connect as `deploy`:

```bash
ssh deploy@YOUR_VPS_IP
```

Optional hardening (as root, after key login works): set `PermitRootLogin no` and `PasswordAuthentication no` in `/etc/ssh/sshd_config`, then `systemctl reload ssh`.

## 4. Swap, firewall, Docker

8 GB is tight once Postgres, Qdrant, the API, and the indexing worker are running. Add swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Host firewall (in addition to hPanel):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

Log out and back in so the `docker` group applies. Confirm:

```bash
docker compose version
```

## 5. Clone the repository

```bash
sudo mkdir -p /opt/architect-ai /opt/backups
sudo chown deploy:deploy /opt/architect-ai /opt/backups
```

Generate a **server-only** GitHub deploy key (do not copy your laptop private key onto the VPS):

```bash
ssh-keygen -t ed25519 -C "architect-ai-vps" -f ~/.ssh/architect-ai-deploy -N ""
cat ~/.ssh/architect-ai-deploy.pub
```

Add that public key in GitHub: **Repo → Settings → Deploy keys → Add deploy key** (read-only). Then:

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/architect-ai-deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github.com
git clone git@github.com:YOUR_ORG/architect-ai.git /opt/architect-ai
```

GitHub’s ED25519 host fingerprint is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. Answer `yes` when prompted.

`Permission denied (publickey)` means the deploy key is not on the GitHub repo yet.

## 6. Production environment

`.env.production` is gitignored. Create it **on the VPS** (or scp a filled copy from your laptop):

```bash
cd /opt/architect-ai
cp .env.production.example .env.production
chmod 600 .env.production
```

Replace every `CHANGE_ME`. Generate secrets on the VPS:

```bash
openssl rand -base64 48   # JWT_*, TOKEN_ENCRYPTION_KEY, OAuth state secrets
openssl rand -hex 32      # POSTGRES_PASSWORD only — hex, no / + =
```

Keep `TOKEN_ENCRYPTION_KEY` in a password manager. Encrypted GitHub tokens and BYOK keys cannot be recovered without it.

Do **not** wrap values in quotes in `.env.production`. Docker `env_file` keeps the quote characters, which breaks OAuth, Stripe, and `MAIL_FROM`.

```bash
# Correct
MAIL_FROM=Architect AI <noreply@yourdomain.com>

# Wrong — Resend sees the quotes
MAIL_FROM='Architect AI <noreply@yourdomain.com>'
```

Production startup **refuses to boot** if any of these are empty: `DATABASE_URL`, GitHub client id/secret, Google client id/secret and redirect URI, `AUTH_GITHUB_OAUTH_REDIRECT_URI`, JWT secrets (user + admin), `TOKEN_ENCRYPTION_KEY`, `GITHUB_OAUTH_STATE_SECRET`, Stripe secret and webhook secret.

Google credentials are required even if you hide the Google button. If Google login is not ready, set dummy non-empty values and `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=false`.

`LLM_PROVIDER` must match a key you actually have (`openai` / `anthropic` / `grok` / `gemini`). `EMBEDDING_PROVIDER=openai` also requires `OPENAI_API_KEY`. Do not use `mock` in production.

On KVM 2 set `INDEXING_WORKER_CONCURRENCY=1`.

### Two hostnames (custom domain)

| Variable                         | Example                                                |
| -------------------------------- | ------------------------------------------------------ |
| `APP_HOST` / `API_HOST`          | `app.example.com` / `api.example.com` (no scheme)      |
| `WEB_URL` / `CORS_ORIGINS`       | `https://app.example.com`                              |
| `NEXT_PUBLIC_API_BASE_URL`       | `https://api.example.com`                              |
| `GITHUB_OAUTH_REDIRECT_URI`      | `https://api.example.com/integrations/github/callback` |
| `GOOGLE_OAUTH_REDIRECT_URI`      | `https://api.example.com/auth/oauth/google/callback`   |
| `AUTH_GITHUB_OAUTH_REDIRECT_URI` | `https://api.example.com/auth/oauth/github/callback`   |
| `COOKIE_DOMAIN`                  | `.example.com`                                         |
| `ACME_EMAIL`                     | a mailbox you control                                  |

Stripe webhook: `https://api.example.com/billing/webhook`.

### Single hostname (Hostinger default)

Use this when the only public name is `srvXXXXX.hstgr.cloud`. Caddy serves Next.js on `/` and NestJS on `/api/*` (it strips the `/api` prefix). It also forwards `/integrations/*`, GitHub/Google OAuth callbacks, and `/billing/webhook` on the app host to the API.

| Variable                   | Example                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `APP_HOST`                 | `srvXXXXX.hstgr.cloud`                                                  |
| `API_HOST`                 | `api.srvXXXXX.hstgr.cloud` (unused; Caddy may log ACME failures for it) |
| `WEB_URL` / `CORS_ORIGINS` | `https://srvXXXXX.hstgr.cloud`                                          |
| `NEXT_PUBLIC_API_BASE_URL` | `https://srvXXXXX.hstgr.cloud/api`                                      |
| OAuth / Stripe URLs        | same host with `/api/...` (see below)                                   |
| `COOKIE_DOMAIN`            | leave empty                                                             |

OAuth callbacks and Stripe:

- `https://srvXXXXX.hstgr.cloud/api/integrations/github/callback`
- `https://srvXXXXX.hstgr.cloud/api/auth/oauth/github/callback`
- `https://srvXXXXX.hstgr.cloud/api/auth/oauth/google/callback`
- `https://srvXXXXX.hstgr.cloud/api/billing/webhook`

All `NEXT_PUBLIC_*` values are baked into the web image at **build** time. Changing them later requires rebuilding `web`.

Do **not** run `pnpm --filter api prisma:seed` on the VPS.

Sanity check before starting:

```bash
grep -nE 'CHANGE_ME|example\.com' /opt/architect-ai/.env.production
```

That should print nothing except comments (or your real domain).

## 7. OAuth apps

**GitHub OAuth App**

- Homepage URL: `https://app.example.com` (or `https://srvXXXXX.hstgr.cloud`)
- Authorization callback URLs — add **both**:
  - two-host: `https://api.example.com/integrations/github/callback` and `https://api.example.com/auth/oauth/github/callback`
  - single-host: `https://srvXXXXX.hstgr.cloud/api/integrations/github/callback` and `https://srvXXXXX.hstgr.cloud/api/auth/oauth/github/callback`

**Google OAuth client (Web application)** — skip the button with `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=false` until this exists.

- Authorized JavaScript origin: the app URL
- Authorized redirect URI: the Google callback from the table above

`AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` are optional and fall back to the repo-connect GitHub app.

## 8. Start the stack

First build on 2 vCPUs takes 10–20+ minutes:

```bash
cd /opt/architect-ai
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

This uses Compose project `architect-ai-prod` and container names `architect-ai-prod-*`. Do **not** start `docker-compose.yml` (dev) on the VPS — it publishes Postgres, Redis, and Qdrant.

Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://api.example.com/health
# single-host:
curl -fsS https://srvXXXXX.hstgr.cloud/api/health
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api indexing-worker web caddy
```

Create the first product user at `/sign-up`. Create a platform admin by inserting a bcrypt-hashed password into the `admins` table — never reuse local seed credentials.

## 9. Updates

```bash
cd /opt/architect-ai
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The API container runs `prisma migrate deploy` before it serves traffic. The worker waits until the API is healthy.

If you change `NEXT_PUBLIC_*`, rebuild `web` (`up -d --build web`).

## 10. Backups

Hostinger snapshots are useful before the first deploy and before upgrades. Also dump Postgres off the box:

```bash
set -a
source /opt/architect-ai/.env.production
set +a

docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "/opt/backups/architect-ai-$(date +%F).sql.gz"
```

Copy `/opt/backups` somewhere else (another machine, S3-compatible storage). Qdrant vectors are **not** in Postgres:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node -e "fetch('http://qdrant:6333/collections/architect_chunks/snapshots',{method:'POST'}).then((r)=>r.json()).then(console.log)"
```

Test a restore on a spare VPS before you need it.

Watch disk: `df -h` and `docker system df`. After a successful upgrade: `docker image prune -f`.

## Troubleshooting

### `deploy` user: `sudo: Authentication failed`

The account was created with `--disabled-password`. `sudo` asks for the **deploy** password, which does not exist. Fix as root with passwordless sudo (step 3) or `passwd deploy`.

### `git clone`: `Permission denied (publickey)`

The VPS has no GitHub deploy key. Repeat step 5. Do not reuse your laptop SSH key.

### Caddy has no certificate

DNS does not point at this VPS yet, or Cloudflare is proxied (orange cloud). Wait for DNS, use grey-cloud, then `docker compose ... logs caddy`.

On a single Hostinger hostname, ignore ACME retries for `api.srv….hstgr.cloud` as long as `https://srv….hstgr.cloud` works.

### `architect-ai-api is unhealthy` / Prisma `P1000`

Postgres rejected the API password.

1. `POSTGRES_PASSWORD` contains `/`, `+`, `@`, or `:`. Use `openssl rand -hex 32`.
2. You changed `POSTGRES_PASSWORD` after the volume already existed. Keep the original password, or wipe the prod volume if the data is disposable:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker volume rm architect-ai-prod_postgres-data
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### GitHub OAuth returns to the wrong host

The GitHub OAuth App callback must match `.env.production` exactly, including `/api` on a single-hostname deploy. `NEXT_PUBLIC_API_BASE_URL` must match how the browser calls the API; rebuild `web` after changing it.

### Out of memory while indexing

On KVM 2 set `INDEXING_WORKER_CONCURRENCY=1`, keep the 4 GB swap file, and index large repositories one at a time.

## Local compose vs production

| File                      | Use                                                      |
| ------------------------- | -------------------------------------------------------- |
| `docker-compose.yml`      | Local development only (bind mounts, published DB ports) |
| `docker-compose.prod.yml` | VPS: production images, Caddy TLS, internal data stores  |
