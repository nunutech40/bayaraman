# BayarAman Staging Runbook

Last verified: 2026-08-04

This runbook documents the working staging deployment path for the shared
IDCloudHost VPS. It is for portfolio/demo staging only, not production.

## Deployment Metadata

| Item | Value |
| --- | --- |
| Provider | IDCloudHost |
| Host | `103.59.94.121` |
| SSH user | `searchyourjob` |
| Remote app directory | `/opt/bayaraman-staging` |
| Public URL | `https://bayaraman.103-59-94-121.nip.io` |
| Compose file | `/opt/bayaraman-staging/compose.staging.yaml` |
| Runtime | Docker on VPS |
| Local build runtime | OrbStack |
| Target image architecture | `linux/amd64` |
| Staging database | PostgreSQL 16 container with named volume |
| Reverse proxy | Existing Caddy container on `kohnu-production_edge` |

Do not store private SSH keys, Midtrans keys, database passwords, or session
secrets in this repository. Runtime secrets live in the remote
`/opt/bayaraman-staging/.env.staging` file with mode `600`.

## Why We Build Locally

The VPS build was unreliable during the final runtime image copy. The reliable
path is to build with OrbStack for the VPS architecture, transfer the image as
a compressed Docker stream, and recreate only the web service. This also
avoids rebuilding or recreating PostgreSQL during an application deploy.

## Build, Transfer, and Deploy

Run these commands from the repository root after committing and pushing the
desired code to `main`:

```bash
# Build for the AMD64 VPS, even when OrbStack runs on Apple Silicon.
docker buildx build \
  --platform linux/amd64 \
  -t bayaraman-staging:amd64 \
  --load .

# Transfer without writing an image archive to disk.
docker save bayaraman-staging:amd64 | gzip -1 | \
  ssh searchyourjob@103.59.94.121 'gunzip | docker load'

# Point the staging tag at the loaded image and recreate only web.
ssh searchyourjob@103.59.94.121 '
  docker tag bayaraman-staging:amd64 bayaraman-staging:local &&
  cd /opt/bayaraman-staging &&
  docker compose --env-file .env.staging \
    -f compose.staging.yaml up -d --no-deps --force-recreate web
'
```

Do not use `docker compose up -d web` for an application-only deploy: without
`--no-deps`, Compose may recreate or restart the database. Do not use an ARM64
image on the VPS; it fails with `exec format error`.

## First-Time Staging Setup

The repository contains `compose.staging.yaml` and `.env.staging.example`.
Create the remote `.env.staging` with real staging-only values for:

```text
DATABASE_URL
POSTGRES_PASSWORD
AUTH_SESSION_SECRET
JOB_SCHEDULER_SECRET
MIDTRANS_ENVIRONMENT=sandbox
MIDTRANS_API_BASE_URL=https://api.sandbox.midtrans.com
MIDTRANS_SERVER_KEY
BAYARAMAN_RECEIVING_BANK_NAME
BAYARAMAN_RECEIVING_ACCOUNT_NUMBER
BAYARAMAN_RECEIVING_ACCOUNT_HOLDER
WHATSAPP_PROVIDER
WHATSAPP_FAKE_OTP
```

Keep the file server-side and run `chmod 600 .env.staging`. Midtrans Sandbox
credentials are not production credentials. The fake WhatsApp provider is for
staging tests only; use `WHATSAPP_PROVIDER=fake` and a six-digit
`WHATSAPP_FAKE_OTP`, then remove it before enabling a real provider.

The database migration boundary is separate from web deployment:

```bash
ssh searchyourjob@103.59.94.121 '
  cd /opt/bayaraman-staging &&
  docker compose --env-file .env.staging -f compose.staging.yaml \
    --profile tools run --rm migrate
'
```

Run migrations intentionally before deploying code that requires them. The
PostgreSQL data persists in the `bayaraman-staging-postgres` named volume.

## Health Checks

```bash
ssh searchyourjob@103.59.94.121 '
  cd /opt/bayaraman-staging &&
  docker compose --env-file .env.staging -f compose.staging.yaml ps
'

curl -fsS -o /dev/null -w '%{http_code}\n' \
  https://bayaraman.103-59-94-121.nip.io/login

curl -i \
  https://bayaraman.103-59-94-121.nip.io/api/auth/me
```

Expected results:

- `web`: `healthy`.
- `postgres`: `healthy`.
- `/login`: HTTP `200`.
- `/api/auth/me` without a session: HTTP `401`.

For fake OTP smoke testing, register a throwaway staging account, request an
OTP, and enter the configured six-digit fake code. Do not use real customer
data.

## Caddy Route

The existing Caddy container is attached to the external
`kohnu-production_edge` network. The BayarAman route uses the network alias
`web:3000`, not the long Compose container name, because Docker DNS on the
shared network did not reliably resolve the long name.

Remote Caddy config:

```text
/opt/kohnu/deploy/production/Caddyfile
```

Before changing it, create a backup. Validate and reload; if the running
container retains the previous upstream after reload, restart only Caddy and
recheck all existing domains:

```bash
ssh searchyourjob@103.59.94.121 '
  sudo cp /opt/kohnu/deploy/production/Caddyfile \
    /opt/kohnu/deploy/production/Caddyfile.bak-bayaraman-staging &&
  docker exec kohnu-production-caddy-1 \
    caddy validate --config /etc/caddy/Caddyfile &&
  docker exec kohnu-production-caddy-1 \
    caddy reload --config /etc/caddy/Caddyfile
'
```

## Rollback

Keep the previous image tag or commit before deploying. To roll back the web
container only:

```bash
ssh searchyourjob@103.59.94.121 '
  docker tag <previous-image-or-id> bayaraman-staging:local &&
  cd /opt/bayaraman-staging &&
  docker compose --env-file .env.staging -f compose.staging.yaml \
    up -d --no-deps --force-recreate web
'
```

Do not roll back database migrations automatically. Assess schema/code
compatibility first and restore the database only from a verified backup.

## Current Staging Limits

- Midtrans is Sandbox only.
- WhatsApp fake delivery is not real WhatsApp delivery.
- Payout/refund remain manual or provider-neutral according to the approved
  product boundary.
- Production is blocked by merchant settlement/custody, legal/compliance,
  production credentials, webhook deployment, and real-money pilot gates.
- The VPS is shared with other applications; staging deployment must not
  expose database ports publicly.
