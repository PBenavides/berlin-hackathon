# GCP Migration — Database & Persistent State

Plan and runbook for moving Buena's persistent state from local Docker into Google Cloud,
using the GCP services available to us in the hackathon allowlist (Cloud SQL is enabled,
plus Cloud Storage and Secret Manager).

## 1. Current Persistent State (what we're migrating)

| Layer | Today | Notes |
|---|---|---|
| Primary DB | PostgreSQL 16 in Docker (`buena_postgres`) | `docker-compose.yml` — DB `buena`, user `buena`, port 5432 |
| Schema | 10 tables managed by Alembic | revisions `0001_initial_schema`, `0002_owner_messages_attachments` |
| App driver | `psycopg2-binary` (sync) + `asyncpg` (async) | `backend/requirements.txt` |
| Conn string | `DATABASE_URL=postgresql://buena:buena@postgres:5432/buena` | hard-coded fallback in `backend/app/config.py` |
| File state | `./data/attachments/` mounted into backend container | `Settings.attachments_dir` — owner-message uploads |
| Seed data | `data/*.csv`, `data/stammdaten.json` | one-shot loaders, not runtime state |

There is exactly **one** logical database (`buena`) containing all 10 tables. No second
DB, no Redis, no message broker. The only other persistent surface is the attachments
directory, which is filesystem-only today and must move off the container disk before we
deploy anywhere managed.

## 2. Target Architecture on GCP

```
┌──────────────────┐        ┌──────────────────────────┐
│ backend (Cloud   │ ─────▶ │ Cloud SQL for PostgreSQL │
│ Run / GCE / k8s) │  IAM   │   instance: buena-pg     │
│                  │  +TLS  │   db: buena              │
└─────┬────────────┘        └──────────────────────────┘
      │
      │ signed URLs / ADC
      ▼
┌────────────────────┐      ┌──────────────────────────┐
│ Cloud Storage      │      │ Secret Manager            │
│ gs://buena-attach  │      │ db-password, openrouter…  │
└────────────────────┘      └──────────────────────────┘
```

**Decisions:**
- **Cloud SQL for PostgreSQL 16** — same major version as the Docker image, so Alembic
  revisions and `pgcrypto` (used for `gen_random_uuid()`) work unchanged.
- **Cloud Storage** for attachments — the local `./data/attachments` directory does not
  survive container restarts in a managed environment.
- **Secret Manager** for `DATABASE_URL` password, `OPENROUTER_API_KEY`,
  `SLACK_WEBHOOK_URL` — never bake these into images or compose files.

## 3. Prerequisites

```bash
# One-time, per operator
gcloud auth login
gcloud auth application-default login
gcloud config set project <PROJECT_ID>

# Required APIs (idempotent)
gcloud services enable \
  sqladmin.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com
```

Confirm Cloud SQL is allowed in the hackathon org policy:
```bash
gcloud sql instances list   # should not 403
```

## 4. Provision Cloud SQL

Smallest viable hackathon shape. Bump `--tier` later if we need it.

```bash
INSTANCE=buena-pg
REGION=europe-west3            # pick one close to where the app runs
DB_PASSWORD=$(openssl rand -base64 24)

gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --tier=db-f1-micro \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --availability-type=zonal

gcloud sql users create buena \
  --instance="$INSTANCE" \
  --password="$DB_PASSWORD"

gcloud sql databases create buena --instance="$INSTANCE"

# Stash the password
printf "%s" "$DB_PASSWORD" | gcloud secrets create buena-db-password --data-file=-
```

`pgcrypto` is preinstalled on Cloud SQL, so the `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`
in `0001_initial_schema.py:23` will succeed.

## 5. Connectivity

Pick **one** of these — do not mix.

### Option A: Cloud SQL Auth Proxy (recommended for hackathon)
- No VPC setup, no public IP exposure, IAM-gated.
- Sidecar process listens on `127.0.0.1:5432`; app connects to localhost.

```bash
# Locally, for dev / migration:
cloud-sql-proxy --port 5432 <PROJECT>:<REGION>:buena-pg
```

In Cloud Run, attach the instance via `--add-cloudsql-instances` and connect over the
Unix socket `/cloudsql/<conn-name>`:

```
DATABASE_URL=postgresql://buena:<pw>@/buena?host=/cloudsql/<PROJECT>:<REGION>:buena-pg
```

### Option B: Private IP + Serverless VPC connector
Lower latency, but requires VPC peering and a connector. Skip unless we hit perf issues.

### Option C: Public IP + authorized networks
Fastest to wire up but exposes the DB. Acceptable only for a short-lived demo with a
strong password and a narrow IP allowlist.

## 6. Schema Deploy via Alembic

Alembic is already the source of truth — we do **not** hand-write DDL. From a host with
the proxy running:

```bash
export DATABASE_URL="postgresql://buena:${DB_PASSWORD}@127.0.0.1:5432/buena"
cd backend
alembic upgrade head
```

This applies `0001` and `0002`. Verify:

```bash
psql "$DATABASE_URL" -c "\dt"
# expect: properties, context_versions, context_chunks, property_policies,
#         context_sources, tickets, agent_proposals, audit_log,
#         owner_messages, attachments
```

## 7. Data Migration (local → Cloud SQL)

If the local Docker DB has data worth keeping (otherwise skip and just run seeders):

```bash
# 1. Dump from local container
docker exec buena_postgres pg_dump -U buena -d buena \
  --no-owner --no-privileges --format=custom > buena.dump

# 2. Restore into Cloud SQL (proxy on 5432)
pg_restore --no-owner --no-privileges \
  --dbname="postgresql://buena:${DB_PASSWORD}@127.0.0.1:5432/buena" \
  buena.dump
```

Notes:
- Use `--format=custom` so `pg_restore` can run in parallel and skip extension DDL we
  can't recreate as a non-superuser.
- If the dump tries to recreate `pgcrypto`, ignore the error — Cloud SQL already has it.
- For larger moves, swap this step for **Database Migration Service** (continuous
  logical replication, cutover with minimal downtime). Overkill for the hackathon DB.

## 8. Attachments → Cloud Storage

`backend/app/config.py:20` defines `attachments_dir: str = "./data/attachments"`. This
needs to become a GCS bucket before the app runs anywhere stateless.

```bash
BUCKET=buena-attachments-<PROJECT_SUFFIX>
gcloud storage buckets create "gs://$BUCKET" \
  --location="$REGION" \
  --uniform-bucket-level-access
```

Code changes (follow-up task, not part of this doc's scope):
- Add `gcs_bucket: str` setting alongside `attachments_dir`.
- In `routes/attachments.py`, branch on `gcs_bucket`: if set, upload via
  `google-cloud-storage` and store the `gs://...` URI in `attachments.storage_path`;
  otherwise fall back to local disk for dev.
- The existing `storage_path` column already holds an opaque string, so the schema does
  not change.

If we don't want to refactor for the demo, mount a Filestore volume — but that ties us
to GCE/GKE, which is heavier than what we have.

## 9. App Configuration Changes

`docker-compose.yml` and `Settings` should pull from env, not literals.

- Drop the `postgres` service from `docker-compose.yml` for cloud deployments (keep a
  `docker-compose.local.yml` for offline dev).
- Set in the runtime env:
  - `DATABASE_URL` — from Secret Manager (`projects/<PROJECT>/secrets/buena-db-url/versions/latest`)
  - `OPENROUTER_API_KEY`, `SLACK_WEBHOOK_URL` — same pattern
  - `ATTACHMENTS_BUCKET=buena-attachments-...` (new, once code lands)
- Grant the runtime service account:
  - `roles/cloudsql.client` on the instance
  - `roles/secretmanager.secretAccessor` on each secret
  - `roles/storage.objectAdmin` on the attachments bucket

## 10. Validation Checklist

After cutover, before declaring done:

- [ ] `alembic current` reports `0002` against Cloud SQL.
- [ ] `SELECT count(*)` on every table matches the local source (or matches expected
      seed counts if we skipped the dump).
- [ ] Backend health endpoint returns 200 against the Cloud SQL connection.
- [ ] Create a ticket end-to-end via the API; row appears in `tickets`.
- [ ] Upload one attachment; object lands in GCS, row in `attachments` references it.
- [ ] `gcloud sql backups list --instance=buena-pg` shows at least one automated backup.

## 11. Rollback

The local Docker stack is untouched until we delete it. To roll back:

1. Revert `DATABASE_URL` env to the local compose value.
2. `docker-compose up -d postgres backend`.
3. Leave the Cloud SQL instance running but idle until we either retry or
   `gcloud sql instances delete buena-pg`.

Cloud SQL daily backups give us a 7-day window to recover from a bad migration on the
managed side.

## 12. Open Questions

- Do we need HA (`--availability-type=regional`) for the demo, or is zonal fine?
- Where does the backend itself run — Cloud Run, GKE, or a GCE VM? That choice
  determines the connection style in §5 and the IAM setup in §9.
- Is the attachments refactor in scope for this sprint, or do we ship demo with local
  disk and migrate the bucket integration after?
