# Deploy Architect AI on AWS EC2

Phase 1 production layout: Docker Compose on a single VM. Kubernetes and ECS are out of scope.

Public traffic terminates at Caddy (TLS). Postgres, Redis, and Qdrant are not published.

```text
Internet :80/:443
        │
      Caddy
     /     \
 web:3000  api:5000
              │
     postgres / redis / qdrant
              │
      indexing-worker
```

Hostnames:

- `https://app.<domain>` → Next.js
- `https://api.<domain>` → NestJS (GitHub OAuth callback stays on this origin)

Single hostname (for example a Hostinger default like `srv….hstgr.cloud`): set `APP_HOST` to that host, `NEXT_PUBLIC_API_BASE_URL=https://<host>/api`, and OAuth callbacks to `https://<host>/api/integrations/github/callback` (Caddy strips `/api` before NestJS). Caddy also forwards `/integrations/*` on the app host to the API so a callback without `/api` still works.

## Instance

| Item    | Recommendation                                                      |
| ------- | ------------------------------------------------------------------- |
| AMI     | Ubuntu 24.04 LTS                                                    |
| Size    | `t3.large` (8 GiB). Use `t3.xlarge` if you index large repositories |
| Disk    | Root 30 GiB + dedicated EBS (100 GiB gp3) for Docker volumes        |
| Network | Elastic IP; DNS `A` records for `app.<domain>` and `api.<domain>`   |

Security group:

| Port | Source      | Purpose                 |
| ---- | ----------- | ----------------------- |
| 22   | Your IP     | SSH                     |
| 80   | `0.0.0.0/0` | ACME HTTP-01 + redirect |
| 443  | `0.0.0.0/0` | HTTPS                   |

Do not open 3000, 5000, 5432, 6379, or 6333.

## Host setup

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

Log out and back in so the `docker` group applies. Confirm `docker compose version`.

Mount the data volume (adjust the device name):

```bash
sudo mkfs.ext4 /dev/nvme1n1
sudo mkdir -p /var/lib/docker/volumes
echo '/dev/nvme1n1 /var/lib/docker/volumes ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
sudo mount -a
```

Clone the repo (or copy a release) to `/opt/architect-ai`.

## Configuration

```bash
cd /opt/architect-ai
cp .env.production.example .env.production
chmod 600 .env.production
```

Replace every `CHANGE_ME` value.

- JWT / OAuth / encryption secrets: `openssl rand -base64 48`
- `POSTGRES_PASSWORD`: `openssl rand -hex 32` (hex only — base64 `/+` breaks the Postgres URL)
- Stripe: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; point the Stripe webhook at `https://api.<domain>/billing/webhook`

Compose builds `DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. Keep the password URL-safe.

Required URL alignment:

| Variable                         | Example                                                |
| -------------------------------- | ------------------------------------------------------ |
| `APP_HOST` / `API_HOST`          | `app.example.com` / `api.example.com` (no scheme)      |
| `WEB_URL` / `CORS_ORIGINS`       | `https://app.example.com`                              |
| `NEXT_PUBLIC_API_BASE_URL`       | `https://api.example.com`                              |
| `GITHUB_OAUTH_REDIRECT_URI`      | `https://api.example.com/integrations/github/callback` |
| `GOOGLE_OAUTH_REDIRECT_URI`      | `https://api.example.com/auth/oauth/google/callback`   |
| `AUTH_GITHUB_OAUTH_REDIRECT_URI` | `https://api.example.com/auth/oauth/github/callback`   |
| `COOKIE_DOMAIN`                  | `.example.com`                                         |

All `NEXT_PUBLIC_*` values (`NEXT_PUBLIC_API_BASE_URL`, OAuth button flags, Sentry) are baked into the web image at **build** time. Changing them later requires `docker compose ... up -d --build web`.

Do **not** run `pnpm --filter api prisma:seed` in production. Seed passwords are for local development only.

Create the first product user at `https://app.<domain>/sign-up`. Create a platform admin by inserting a bcrypt-hashed password into the `admins` table — never reuse the local seed email or password.

## GitHub OAuth

Create a GitHub OAuth App:

- Homepage URL: `https://app.<domain>`
- Authorization callback URLs:
  - `https://api.<domain>/integrations/github/callback` (repository connect)
  - `https://api.<domain>/auth/oauth/github/callback` (sign-in / sign-up)

Create a Google Cloud OAuth client (Web application) with:

- Authorized JavaScript origin: `https://app.<domain>`
- Authorized redirect URI: `https://api.<domain>/auth/oauth/google/callback`

Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `GITHUB_OAUTH_STATE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `AUTH_GITHUB_OAUTH_REDIRECT_URI` in `.env.production`. `AUTH_GITHUB_CLIENT_ID` / `AUTH_GITHUB_CLIENT_SECRET` are optional and fall back to the GitHub integration app.

## Start

```bash
cd /opt/architect-ai
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The production file uses Compose project `architect-ai-prod` and container names `architect-ai-prod-*`, so it does not reuse local `docker-compose.yml` volumes or the `architect-ai-postgres` container.

If a previous prod attempt failed with `P1000` / `architect-ai-api is unhealthy`, remove that failed stack first (this does **not** delete local dev volumes):

```bash
docker compose -f docker-compose.prod.yml down
docker rm -f architect-ai-api architect-ai-web architect-ai-indexing-worker \
  architect-ai-caddy architect-ai-postgres architect-ai-redis architect-ai-qdrant \
  2>/dev/null || true
```

Do not `docker volume rm architect-ai_postgres-data` unless you intend to wipe **local** Postgres data. Production now uses `architect-ai-prod_postgres-data`.

Caddy obtains certificates automatically once DNS points at the Elastic IP. Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://api.<domain>/health
```

Logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api indexing-worker web caddy
```

## Updates

```bash
cd /opt/architect-ai
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The API container runs `prisma migrate deploy` before `node dist/main`. The indexing worker starts only after the API healthcheck passes, so it does not race migrations.

Restart order if you need to do it by hand: postgres/redis/qdrant → api (migrates) → web/caddy → indexing-worker.

## Backups

Postgres (daily cron, then copy to S3):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "/opt/backups/architect-ai-$(date +%F).sql.gz"

aws s3 cp "/opt/backups/architect-ai-$(date +%F).sql.gz" "s3://YOUR_BUCKET/architect-ai/"
```

Qdrant snapshots (from the API container, then copy the snapshot file off the Qdrant volume):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
  node -e "fetch('http://qdrant:6333/collections/architect_chunks/snapshots',{method:'POST'}).then((r)=>r.json()).then(console.log)"
```

Test a restore on a separate host before you need it. Keep `TOKEN_ENCRYPTION_KEY` in a password manager; encrypted GitHub tokens and BYOK keys cannot be recovered without it.

## Troubleshooting

### `architect-ai-api is unhealthy` / Prisma `P1000`

Postgres rejected the API password. Typical causes:

1. Local and prod Compose shared `postgres-data`. Postgres only applies `POSTGRES_PASSWORD` on first init, so an existing volume keeps the old password. Current prod Compose uses a separate project/volume — recreate with the commands in [Start](#start).
2. `POSTGRES_PASSWORD` contains `/`, `+`, `@`, or `:`. Regenerate with `openssl rand -hex 32`.
3. `.env.production` `POSTGRES_PASSWORD` was changed after the prod volume already existed. Either keep the original password or, if the prod database is disposable:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker volume rm architect-ai-prod_postgres-data
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Local compose vs production

| File                      | Use                                                                              |
| ------------------------- | -------------------------------------------------------------------------------- |
| `docker-compose.yml`      | Local development (bind mounts, `next dev` / `nest --watch`, published DB ports) |
| `docker-compose.prod.yml` | Production images, Caddy TLS, internal-only data stores                          |

## Later (not in this cut)

- Push images to ECR and deploy from CI
- RDS / ElastiCache instead of containers (change connection URLs only)
- CloudWatch agent for host metrics
