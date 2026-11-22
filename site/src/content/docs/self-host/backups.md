---
title: Backups
---

[Litestream](https://litestream.io) runs inside the container. With `LITESTREAM_BUCKET` set, it streams every SQLite write to the bucket (about once a second) and restores the database on start when the volume is empty. Any S3-compatible store works: AWS S3, Tigris, Cloudflare R2, Backblaze B2, MinIO.

```bash
LITESTREAM_BUCKET=questie-backups
LITESTREAM_PATH=questie
LITESTREAM_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # empty for AWS S3
LITESTREAM_REGION=auto
LITESTREAM_ACCESS_KEY_ID=...
LITESTREAM_SECRET_ACCESS_KEY=...
```

Turning it on for an existing install: add the vars and restart. The database exists, so restore is skipped and replication starts with a full snapshot.

## Commands

Run them inside the container: `docker exec -it questie sh` or `fly ssh console`.

| Task | Command |
|---|---|
| Check replication | `litestream databases -config /etc/litestream.yml` and the log line `replicating to` |
| List restore points | `litestream ltx -config /etc/litestream.yml "$DB_PATH"` |
| Restore latest to a scratch file | `litestream restore -config /etc/litestream.yml -o /tmp/r.db "$DB_PATH"` |
| Point-in-time restore | `litestream restore -config /etc/litestream.yml -timestamp 2026-11-22T10:00:00Z -o /tmp/r.db "$DB_PATH"` |
| Check a restored file | `node -e 'const {DatabaseSync}=require("node:sqlite");console.log(new DatabaseSync("/tmp/r.db").prepare("PRAGMA integrity_check").get())'` |

## Replace the live database

1. Stop the app: `docker compose stop` or `fly scale count 0`.
2. Move `questlog.db`, `questlog.db-wal` and `questlog.db-shm` aside. Keep them until the restore is checked.
3. Start the app. The entrypoint finds no database and restores the latest copy.

For a point in time, restore to `/tmp/r.db` from a one-off container with the same env and volume, copy it to `$DB_PATH`, then start:

```bash
docker compose run --rm --entrypoint sh app -c \
  'litestream restore -config /etc/litestream.yml -timestamp 2026-11-22T10:00:00Z -o "$DB_PATH" "$DB_PATH"'
docker compose up -d
```

## Recovery drill

Run it once after setup and after every Litestream upgrade.

- Docker: `docker compose down`, move `data/questlog.db*` aside, `docker compose up -d`, then check `/api/health` and sign in.
- Fly: `fly machine destroy <id> --force`, `fly volumes destroy <vol>`, `fly volumes create questie_data --size 3 --region fra`, `fly deploy`. Sign in and open your progress.

## Media

Course media and narration audio live in `/data/media` as files, outside SQLite. Narration audio is regenerated on demand at no charge.

- Fly: volume snapshots, 14 days (`snapshot_retention`). Restore with `fly volumes create questie_data --snapshot-id <id>`.
- Docker: a nightly host cron, `rclone sync <data-dir>/media <remote>:<bucket>/media`. Restore with the reverse `rclone sync`.
