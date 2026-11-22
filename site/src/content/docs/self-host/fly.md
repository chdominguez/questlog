---
title: Fly.io
---

`fly.toml` runs one machine with one volume. SQLite has one writer, so keep the count at 1.

## Set up

```bash
fly launch --no-deploy --copy-config
fly volumes create questie_data --size 3 --region fra
fly storage create            # Tigris bucket; sets AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME
fly secrets set LITESTREAM_BUCKET=<bucket name> LITESTREAM_ENDPOINT=https://fly.storage.tigris.dev LITESTREAM_REGION=auto
fly secrets set APP_URL=https://<app>.fly.dev BETTER_AUTH_SECRET=$(openssl rand -hex 32) ANTHROPIC_API_KEY=sk-ant-...
fly deploy --build-arg COMMIT=$(git rev-parse HEAD)
fly scale count 1
```

Other variables: [config](/self-host/config/). `fly.toml` already sets `DB_PATH`, `HOST`, `PORT`, `IP_HEADER=fly-client-ip` and `LITESTREAM_PATH=questie`.

## Notes

- `auto_stop_machines = "off"`: reminders run in the server process and Litestream streams continuously.
- The health check calls `GET /api/health` every 30 s.
- Volume snapshots are kept 14 days (`snapshot_retention`). They cover course media and narration audio, which Litestream does not.

## Custom domain

```bash
fly certs add app.example.com
fly secrets set APP_URL=https://app.example.com
```
