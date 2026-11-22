---
title: Configuration
---

The server reads these at boot. It stops with an error when `APP_URL` or `BETTER_AUTH_SECRET` is missing, or when only one of the two Stripe keys is set.

## Server

| Variable | Required | Default | Use |
|---|---|---|---|
| `APP_URL` | yes | | Public app URL. Auth callbacks and Stripe redirects |
| `BETTER_AUTH_SECRET` | yes | | Session signing, 32+ random bytes |
| `DB_PATH` | no | `data/questlog.db` (image: `/data/questlog.db`) | SQLite file |
| `MEDIA_DIR` | no | `media/` next to `DB_PATH` | Course media and narration audio |
| `MEDIA_MAX_BYTES` | no | `52428800` | Largest media upload |
| `HOST`, `PORT` | no | `127.0.0.1`, `8787` (image: `0.0.0.0`) | Listen address |
| `APP_ORIGINS` | no | `capacitor://localhost,https://localhost` | Origins of the mobile apps (bearer tokens only) |
| `IP_HEADER` | no | `x-forwarded-for` | Client IP header (`fly-client-ip` on Fly) |
| `QUESTIE_COURSES` | no | `courses-private` | Private course folder, read at build time (`QUESTLOG_COURSES` also read) |

## Accounts

| Variable | Required | Default | Use |
|---|---|---|---|
| `SIGNUP` | no | `open` | `closed` stops new email sign-ups |
| `ADMIN_EMAILS` | no | | Comma list of admins (review queue) |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | | Verification, magic link and reset mail. Unset: no verification, links go to the log |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | | Google sign-in |
| `GOOGLE_NATIVE_CLIENT_IDS` | no | | iOS and Android client ids accepted for native Google sign-in |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_BUNDLE_ID` | no | | Apple sign-in, web and native |

## AI

| Variable | Required | Default | Use |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | no | | Grading, course builder, mock exams. Unset: AI features off |
| `JOB_CONCURRENCY` | no | `2` | Background jobs at once |
| `ELEVENLABS_API_KEY` | no | | Narration. Unset: hidden |
| `ELEVENLABS_VOICES` | with key | | Comma list of voice ids; the first is the default |
| `ELEVENLABS_MODEL` | no | `eleven_multilingual_v2` | TTS model |

## Billing

| Variable | Required | Default | Use |
|---|---|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | no | | Both set: billing and credits on. Unset: AI is not metered |
| `REVENUECAT_WEBHOOK_AUTH` | with mobile | | Expected `Authorization` value on the RevenueCat webhook |
| `CREDITS_NOTICE` | no | | Notice text shown about cost changes |

Prices live in `shared/pricing.ts`. Create the Stripe products with `npm run stripe:setup`.

## Reminders

| Variable | Required | Default | Use |
|---|---|---|---|
| `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` | no | | Web Push (`npx web-push generate-vapid-keys`; subject `mailto:you@example.com`) |
| `FCM_SERVICE_ACCOUNT` | with mobile | | Base64 service-account JSON for native push |

## Backups

| Variable | Required | Default | Use |
|---|---|---|---|
| `LITESTREAM_BUCKET` | no | | Set: replication on |
| `LITESTREAM_PATH` | no | | Key prefix in the bucket |
| `LITESTREAM_ENDPOINT` | no | AWS S3 | S3-compatible endpoint (Tigris, R2, B2, MinIO) |
| `LITESTREAM_REGION` | no | | Region (`auto` for Tigris and R2) |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | with bucket | | Bucket keys (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` also read) |

## Build

| Variable | Default | Use |
|---|---|---|
| `COMMIT` (Docker build arg) | `dev` | Shown by `/api/health` and the source link in Profile |

Removed in Questie: `USER_HEADER`, `NAME_HEADER`, `LOGOUT_URL`.
