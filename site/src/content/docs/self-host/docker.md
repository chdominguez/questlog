---
title: Docker
---

One container serves the app and the API. SQLite lives on the `/data` volume.

## Run

```bash
git clone https://github.com/chdominguez/questlog questie && cd questie
cat > .env <<ENV
APP_URL=https://app.example.com
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=sk-ant-...
ENV
docker compose up -d --build
curl http://127.0.0.1:8790/api/health
```

`docker-compose.yml` reads:

| Variable | Default | Use |
|---|---|---|
| `ENV_FILE` | `.env` | App env file ([config](/self-host/config/)) |
| `DATA_DIR` | `./data` | Host folder mounted at `/data` |
| `COMMIT` | `dev` | Build arg, shown by `/api/health` |

The port is published on `127.0.0.1:8790` only.

## TLS

Put a reverse proxy in front. Caddy:

```
app.example.com {
	reverse_proxy 127.0.0.1:8790
}
```

Sign-in is built in. Do not put a login proxy in front of `/api/auth/*` or `/api/webhooks/*`.

## Backups

Add `LITESTREAM_BUCKET` and its keys to `.env`, then `docker compose up -d`. See [backups](/self-host/backups/).

## Update

```bash
git pull && docker compose up -d --build
```
