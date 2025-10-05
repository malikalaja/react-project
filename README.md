# Laravel 12 Deployment Guide (PHP 8.4, MySQL 8.4, React + npm 22)

This document standardizes how we build and deploy the project across environments (dev → staging → production). It assumes:

* **Laravel** 12
* **PHP** 8.4 (FPM)
* **MySQL** 8.4
* **React** starter kit
* **Node.js** 22 with **npm** 10 (npm “22” isn’t a thing; Node 22 ships npm 10.x). If you literally need npm 22, pin a custom npm binary in build images.
* Containerized deployment with **Docker**/**Compose** or an orchestrator (ECS/Kubernetes). Adjust paths if deploying to bare-metal.

---

## 1) High-Level Architecture

```
[client]
  ↓
[CDN/Edge Cache (optional)]
  ↓
[NGINX] ──> [PHP-FPM 8.4 + Laravel App]
                ├─ [Queue Worker(s) via Supervisor]
                ├─ [Scheduler via cron]
                ├─ [Cache/Session: Redis or DB]
                └─ [Storage: S3 or local volume]

[MySQL 8.4] ← migrations & data
```

* Prefer **Redis** for cache/session/queue. Fallback to DB queue if Redis unavailable.
* Use **S3-compatible** object storage for durable user uploads in production.

---

## 2) Environment Topology

* **dev**: permissive configs, hot reloads, debug enabled (local only).
* **staging**: mirrors production infra; debug disabled; CI deploys on `main`.
* **production**: locked-down networking, WAF, read replicas (optional).

---

## 3) Secrets & Config

Manage all secrets outside git (e.g., Vault, AWS Secrets Manager, Doppler, GitHub Encrypted Secrets). At runtime they become environment variables.

**Required .env keys (baseline):**

```dotenv
APP_NAME="Project"
APP_ENV=production
APP_KEY=base64:GENERATE_WITH_ARTISAN
APP_DEBUG=false
APP_URL=https://example.com

LOG_CHANNEL=stack
LOG_LEVEL=info

# DB
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=app
DB_USERNAME=app
DB_PASSWORD=********

# Cache/Session/Queue
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379

# Mail
MAIL_MAILER=log
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_FROM_NAME="Project"

# Storage
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=********
AWS_SECRET_ACCESS_KEY=********
AWS_DEFAULT_REGION=eu-central-1
AWS_BUCKET=project-bucket
AWS_URL=

# Build-time flags
VITE_APP_ENV=production

# Horizon (if used)
HORIZON_PREFIX=project
```

> Never commit `.env`. In containers, pass values via orchestrator secret store.

---

## 4) Build Artifacts

* **Backend**: Composer install (no-dev), optimize config/routes/views, dump OPcache preloading (optional).
* **Frontend**: Node 22 build → static assets in `public/build`.
* **Assets**: Digested and immutable; served via NGINX with far-future cache headers.

---

## 5) Dockerfiles (multi-stage)

### 5.1 PHP-FPM (php:8.4-fpm)

```dockerfile
# ./deploy/php-fpm.Dockerfile
FROM php:8.4-fpm AS base

# System deps
RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libpq-dev libicu-dev libonig-dev \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev libssl-dev \
    cron supervisor \
  && rm -rf /var/lib/apt/lists/*

# PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j$(nproc) gd pdo pdo_mysql zip intl opcache

# Opcache recommended settings
COPY ./deploy/php.ini /usr/local/etc/php/conf.d/php.ini

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# App code
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress

COPY . .
RUN php artisan storage:link || true \
 && php artisan config:clear && php artisan cache:clear

# Optimize
RUN php artisan route:cache && php artisan config:cache && php artisan view:cache

# Supervisor for queues
COPY ./deploy/supervisor.conf /etc/supervisor/conf.d/supervisor.conf

# Entrypoint
COPY ./deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
```

**`deploy/php.ini` (snippet):**

```ini
memory_limit=512M
post_max_size=50M
upload_max_filesize=50M
max_execution_time=120

opcache.enable=1
opcache.enable_cli=1
opcache.jit=tracing
opcache.jit_buffer_size=128M
opcache.validate_timestamps=0
opcache.max_accelerated_files=20000
```

**`deploy/supervisor.conf`:**

```ini
[supervisord]
nodaemon=true
logfile=/dev/stdout

[program:queue]
command=php /var/www/html/artisan queue:work --sleep=3 --tries=3 --max-time=3600
numprocs=2
autostart=true
autorestart=true
stopsignal=QUIT
stdout_logfile=/dev/stdout
stderr_logfile=/dev/stderr
```

**`deploy/entrypoint.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail
php artisan migrate --force || true
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisor.conf
```

> If you use Laravel Horizon, replace `queue:work` with `horizon` and add Horizon config/prefixing.

### 5.2 NGINX image

```dockerfile
# ./deploy/nginx.Dockerfile
FROM nginx:1.27-alpine

COPY ./deploy/nginx.conf /etc/nginx/nginx.conf
WORKDIR /var/www/html
COPY --from=base /var/www/html/public /var/www/html/public
```

**`deploy/nginx.conf` (minimal):**

```nginx
user  nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events { worker_connections 1024; }

http {
  include       /etc/nginx/mime.types;
  default_type  application/octet-stream;
  sendfile        on;
  keepalive_timeout  65;
  gzip on;

  server {
    listen 80;
    server_name _;
    root /var/www/html/public;

    location /build/ {  # Vite build
      access_log off;
      expires 365d;
      add_header Cache-Control "public, max-age=31536000, immutable";
      try_files $uri =404;
    }

    location / {
      try_files $uri /index.php?$query_string;
    }

    location ~ \.php$ {
      include        fastcgi_params;
      fastcgi_pass   php:9000;
      fastcgi_param  SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
  }
}
```

### 5.3 Frontend build (Node 22)

We build assets during the PHP stage (or a dedicated Node builder) and copy to `public/build`.

```dockerfile
# ./deploy/node-build.Dockerfile
FROM node:22-alpine AS nodebuild
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev=false
COPY . .
RUN npm run build

# In php-fpm.Dockerfile replace COPY . . with a two-phase copy to avoid leaking node_modules
# COPY --from=nodebuild /app/public/build /var/www/html/public/build
```

> Ensure `vite.config.ts` outputs to `public/build` and uses relative base.

---

## 6) docker-compose (prod-ish)

```yaml
# ./deploy/docker-compose.prod.yml
version: "3.9"
services:
  mysql:
    image: mysql:8.4
    command: ["mysqld", "--default-authentication-plugin=mysql_native_password", "--mysql-native-password=ON"]
    environment:
      MYSQL_DATABASE: app
      MYSQL_USER: app
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - dbdata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]

  php:
    build:
      context: ..
      dockerfile: ./deploy/php-fpm.Dockerfile
    env_file:
      - ../.env
    depends_on:
      - mysql
      - redis
    volumes:
      - appstorage:/var/www/html/storage

  nginx:
    build:
      context: ..
      dockerfile: ./deploy/nginx.Dockerfile
    ports:
      - "80:80"
    depends_on:
      - php
    volumes:
      - appstorage:/var/www/html/storage:ro

volumes:
  dbdata:
  appstorage:
```

> For production, run MySQL/Redis as managed services (e.g., RDS/ElastiCache) and mount S3 via app-level driver.

---

## 7) First Deploy (cold start)

1. Provision infra (DB, Redis, S3, secrets).
2. Build & push images: `php`, `nginx` (CI does this, see §11).
3. Create `.env` via secret store.
4. Run `docker compose -f deploy/docker-compose.prod.yml up -d`.
5. App container runs `php artisan migrate --force` on entry.
6. Verify health checks (§10). Create an admin via `php artisan tinker` or a seeder.

---

## 8) Routine Release (zero-downtime basics)

* Build images with version tags (`app:1.2.3`).
* Rolling update or blue/green at the load balancer.
* DB migrations: safe-by-default (expand/contract). Avoid long blocking ops during peak.
* If a migration requires downtime, schedule maintenance window and present a maintenance page at the edge.

**Minimal downtime toggle:**

* Put app in maintenance *only* during unsafe migrations: `php artisan down --secret=...` → run migration → `php artisan up`.

---

## 9) Database Migrations & Seeding

* All schema changes via migrations; enforce code review.
* Use `doctrine/dbal` for column changes where needed.
* Large tables: online migrations (gh-ost/pt-osc) if required.
* Seeders: idempotent and environment-aware. Never seed test data in prod.

---

## 10) Health Checks & Monitoring

* **App**: expose `/healthz` route returning 200 with DB/Redis pings and app version (from `APP_VERSION`).
* **MySQL**: use native `mysqladmin ping`.
* **Metrics**: Laravel Telescope (non-prod), OpenTelemetry/Prometheus exporters for prod, log forwarding.
* **Tracing**: OpenTelemetry SDK (optional).
* **Errors**: Sentry/Bugsnag.

**Example health route:**

```php
Route::get('/healthz', function () {
    try {
        \DB::connection()->getPdo();
        \Redis::command('PING');
    } catch (\Throwable $e) {
        return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
    return response()->json([
        'ok' => true,
        'version' => env('APP_VERSION', 'unknown'),
        'time' => now()->toIso8601String(),
    ]);
});
```

---

## 11) CI/CD (GitHub Actions example)

```yaml
# .github/workflows/deploy.yml
name: CI-CD

on:
  push:
    branches: [ main ]
  workflow_dispatch: {}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    env:
      REGISTRY: ghcr.io/<org>/<repo>
      VERSION: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - name: Build frontend
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push php-fpm
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./deploy/php-fpm.Dockerfile
          push: true
          tags: |
            ${REGISTRY}/php:${{ env.VERSION }}
            ${REGISTRY}/php:latest

      - name: Build & push nginx
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./deploy/nginx.Dockerfile
          push: true
          tags: |
            ${REGISTRY}/nginx:${{ env.VERSION }}
            ${REGISTRY}/nginx:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH to host and deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /srv/app
            docker compose -f deploy/docker-compose.prod.yml pull
            docker compose -f deploy/docker-compose.prod.yml up -d --no-deps --build nginx php
            docker image prune -f
```

> Swap the deploy step for ECS/Kubernetes if you use an orchestrator (kubectl/helm). Add canary or blue/green at the load balancer.

---

## 12) Scheduler & Cron

Run the scheduler in a sidecar or within the PHP container via cron.

**Crontab (container):**

```
* * * * * cd /var/www/html && php artisan schedule:run >> /proc/1/fd/1 2>&1
```

If using Kubernetes, run a CronJob for `schedule:run` or a long-running sidecar with `crond`.

---

## 13) Caching & Performance

* Enable OPcache (already configured). Disable `opcache.validate_timestamps` in prod.
* Use `php artisan config:cache`, `route:cache`, `view:cache` in builds.
* Consider **Octane** (Swoole/RoadRunner) after load testing.
* Set proper `Cache-Control` headers for static assets (see NGINX config).

---

## 14) File Storage Strategy

* **Production**: S3 with signed URLs; disallow direct public writes.
* **Local dev**: local disk. Keep `storage` on a persistent volume.
* Ensure `php artisan storage:link` is executed during build or startup.

---

## 15) Security Hardening

* Set `APP_DEBUG=false` in non-dev.
* Limit egress/ingress security groups.
* WAF + rate limiting at the edge.
* Force HTTPS; HSTS on (careful in staging).
* Rotate app/DB credentials; enforce least privilege.
* Keep base images updated; enable Dependabot/renovate.
* Use read-only FS for NGINX where possible; isolate write to `storage/` and `bootstrap/cache` for PHP container.

---

## 16) Backups & DR

* **MySQL**: automated daily snapshots + point-in-time recovery (binlogs). Test restores monthly.
* **Storage**: S3 versioning + lifecycle policies.
* **Configs**: export and version Terraform/Helm manifests.

**Restore Runbook (abridged):**

1. Provision new DB from snapshot.
2. Point app to restored endpoint via secrets update.
3. Warm caches with `php artisan config:cache` etc.
4. Validate healthz and smoke tests before re-opening traffic.

---

## 17) Observability & Logs

* Centralize logs (CloudWatch/ELK/OpenSearch). Structure JSON logs if feasible.
* Capture metrics: CPU/mem, PHP-FPM pool, request latencies, queue depths.
* Alerts: error rate spikes, 5xx %, DB connections, job failures.

---

## 18) Rollback Strategy

* Keep N-2 images available. Roll back by redeploying previous tag.
* DB rollbacks are **dangerous**; prefer forward-only migrations. For breaking changes: deploy expand → migrate → code cut-over → contract.

---

## 19) Deployment Checklist (per release)

* [ ] CI green; images pushed (php/nginx) with tag.
* [ ] DB migrations reviewed for safety; long ops tested.
* [ ] Secrets present & valid; feature flags correct.
* [ ] Rollback tag identified.
* [ ] Post-deploy smoke tests scripted.
* [ ] Observability dashboards/alerts monitored for 30–60 minutes.

---

## 20) Make Targets (optional convenience)

```Makefile
.PHONY: build up logs ssh migrate tinker seed
build:
	docker compose -f deploy/docker-compose.prod.yml build

up:
	docker compose -f deploy/docker-compose.prod.yml up -d

logs:
	docker compose -f deploy/docker-compose.prod.yml logs -f --tail=200

migrate:
	docker compose -f deploy/docker-compose.prod.yml exec php php artisan migrate --force

seed:
	docker compose -f deploy/docker-compose.prod.yml exec php php artisan db:seed --force
```

---

## 21) Notes on npm “22”

* Node **v22** is supported; npm bundled with Node 22 is currently **npm 10.x**. If you truly need an npm v22 binary, pin and install it manually inside the builder image (not recommended). Prefer the Node LTS + bundled npm for reproducibility.

---

## 22) Local Development Parity

* Use a `docker-compose.dev.yml` with hot reload (bind mounts) and `APP_ENV=local`.
* Run `php artisan serve` is acceptable locally, but prefer NGINX parity with prod.

---

## 23) Appendix: Vite/React Starter Kit

**package.json (snippet):**

```json
{
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 5173"
  }
}
```

**vite.config.ts (snippet):**

```ts
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'

export default defineConfig({
  build: { outDir: 'public/build', emptyOutDir: true },
  plugins: [
    laravel({
      input: [
        'resources/js/app.jsx',
        'resources/css/app.css',
      ],
      refresh: true,
    }),
  ],
})
```

---

**Questions or improvements?** Open a PR to this file with infra specifics (cloud provider, registry, network, TLS).
