---
title: Upgrading
---

## Any release

```bash
git pull && docker compose up -d --build     # Docker
fly deploy                                   # Fly
```

Migrations run on start. Back up first if Litestream is off: copy `data/questlog.db*` while the app is stopped.

## From Questlog

Data carries over. The database file keeps its name, `questlog.db`.

1. Add `APP_URL` and `BETTER_AUTH_SECRET` to `.env` ([config](/self-host/config/)). Remove `USER_HEADER`, `NAME_HEADER` and `LOGOUT_URL`.
2. Remove the login proxy in front of the app. Sign-in is built in. Existing progress, answers and notes attach to an account on its first sign-in with the same verified email.
3. Bring the old Compose project down, then start the new one:
   ```bash
   docker compose -p questlog down --remove-orphans
   docker compose up -d --build
   ```
   The container is now `questie`. If a proxy reaches it by container name, point it at `questie:8787`.
4. Browsers keep their progress: the app reads the old `questlog-v1` key on first load.
5. Env names: `QUESTLOG_COURSES`, `QUESTLOG_URL` and `QUESTLOG_TOKEN` still work; prefer the `QUESTIE_*` names.
6. Claude Code plugin: `/plugin uninstall questlog@questlog`, `/plugin marketplace remove questlog`, then `/plugin marketplace add chdominguez/questlog` and `/plugin install questie@questie`.
7. MCP resources are now `questie://schema/course` and `questie://guide/authoring`. Course files keep working with `questlog/authoring` imports.
