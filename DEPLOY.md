# Deploy (CI/CD) — cosimosi

How merges to `develop` / `main` reach production. Pipeline plumbing lives in the repo
(Dockerfile, `docker-compose.prod.yml`, `Caddyfile`, `.github/workflows/`); the cloud
accounts/clicks below are one-time, manual (spec 14). **Never commit secrets** — real
values live in GitHub Actions Secrets, the VPS's untracked `.env`, and Cloudflare env.

## Branch → environment

| Branch | Frontend (Cloudflare Pages) | Backend (Hetzner VPS) | DB (Supabase) |
|---|---|---|---|
| `develop` | project `cosimosi-staging` | stack `/srv/cosimosi-staging` (`api.staging.<도메인>`) | staging project |
| `main` | project `cosimosi-prod` | stack `/srv/cosimosi-prod` (`api.<도메인>`) | prod project |

On merge: Cloudflare builds the frontend itself (native Git, parallel); GitHub Actions
(`deploy-backend.yml`) builds the API image → GHCR → SSH to the VPS → **migrate first
(direct 5432) → write `IMAGE_TAG` → `compose pull && up -d`**. Migrations run *before* the
API is swapped; if they fail the old container stays up.

## 1. Cloudflare Pages — two projects (native Git, T013/T014)

Dashboard → Workers & Pages → create two Pages projects connected to this repo:

- **`cosimosi-staging`** — production branch `develop`
- **`cosimosi-prod`** — production branch `main`

Both, identical build config:
- Build command: `pnpm --filter ./frontend build`
- Output directory: `frontend/dist`
- Root directory: repo root
- Monorepo build watch path: `frontend/` (a backend-only change skips the frontend build)

Per-project environment variables (build-time — `VITE_*` is baked into the bundle, so
each environment is a separate build → no staging URL leaks into the prod bundle, 5.1):

| Var | staging | prod |
|---|---|---|
| `VITE_API_URL` | `https://api.staging.<도메인>` | `https://api.<도메인>` |
| `VITE_SUPABASE_URL` | staging project URL | prod project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging key | prod key |
| `VITE_SENTRY_DSN` | (optional) staging DSN | (optional) prod DSN |
| `VITE_SENTRY_ENVIRONMENT` | `staging` | `production` |

Frontend rollback: Cloudflare dashboard → the project → Deployments → "Rollback" to a
prior deployment (6.2).

## 2. Supabase — two projects (T018)

- Create **separate** staging and prod projects (or at minimum separate DBs) so staging
  migrations never touch prod data.
- Two connection strings per project (spec 14 §6):
  - **App runtime** → transaction pooler, port **6543** → goes in the VPS `.env` as `DATABASE_URL`.
  - **Migrations** → direct connection, port **5432** → GitHub Secret `DIRECT_DATABASE_URL`
    (DDL must NOT go through the pooler).
- ⚠️ **Region colocation**: put the Supabase project in the same/nearest region as the
  Hetzner VPS to keep API↔DB latency low (Architecture §7). Verify before going live.

## 3. Hetzner VPS — one-time bootstrap (T016)

One VPS hosts both stacks (separate directories/subdomains; Caddy issues TLS for each).

1. Install Docker Engine + the compose plugin.
2. For each env `e ∈ {staging, prod}`, create `/srv/cosimosi-$e/` containing:
   - `docker-compose.prod.yml` and `Caddyfile` (copied from this repo)
   - `.env` — from `.env.production.example`, filled in (untracked; `chmod 600`).
     Set `API_DOMAIN` (`api.staging.<도메인>` / `api.<도메인>`), `DATABASE_URL` (6543),
     `CORS_ORIGIN` (that env's Pages domain), `SUPABASE_JWT_SECRET`, `AI_EMBEDDER`/
     `OPENAI_API_KEY`, `SENTRY_DSN`/`SENTRY_ENVIRONMENT`. `IMAGE_TAG` is overwritten by
     the deploy step.
   - `migrations/` — created/synced by the deploy workflow (scp) before goose runs.
3. Add the deploy SSH **public** key to `~/.ssh/authorized_keys`.
4. `docker login ghcr.io` once with a token that can *read* packages (so `compose pull`
   works; the workflow pushes with `GITHUB_TOKEN`).
5. Point DNS `A`/`AAAA` records for `api.<도메인>` and `api.staging.<도메인>` at the VPS.

## 4. GitHub configuration (T017, T012)

**Secrets** (Settings → Secrets and variables → Actions). Put env-specific ones under
**Environments** (`production`, `staging`) so each deploy reads the right values:
- `SSH_HOST`, `SSH_USER`, `SSH_KEY` (deploy private key)
- `DIRECT_DATABASE_URL` (per environment — the 5432 direct URL for that env's Supabase)

GHCR needs no secret (`GITHUB_TOKEN` is automatic).

**Environments**: create `production` and `staging`. Optionally add a **required
reviewer** to `production` for a manual approval gate before prod backend deploys (T012).

## 5. Rollback (6.2)

- **Backend**: on the VPS, set `IMAGE_TAG=<previous-sha>` in `/srv/cosimosi-<env>/.env`,
  then `docker compose -f docker-compose.prod.yml pull && up -d`. (Images are tagged by
  commit SHA in GHCR.)
- **Frontend**: Cloudflare dashboard → Rollback to a previous deployment.

## Secrets policy

Nothing secret is committed. `.env` is gitignored; `.env.production.example` documents
keys with **no values**. SSH keys, DB URLs, and API keys live only in GitHub Secrets /
the VPS `.env` / Cloudflare env.
