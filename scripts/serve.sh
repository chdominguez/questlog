#!/bin/sh
# Container entrypoint. Auth is off: the reverse proxy in front (e.g. Caddy + oauth2-proxy) must do the login,
# and the port must never be published beyond localhost or that proxy's network.
set -e
cd dist/questlog
{ echo "AUTH_DISABLED=1"; [ -n "$ANTHROPIC_API_KEY" ] && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"; } > .dev.vars
npx wrangler d1 migrations apply DB --local -c wrangler.json --persist-to /data
exec npx wrangler dev -c wrangler.json --ip 0.0.0.0 --port 8787 --persist-to /data --show-interactive-dev-session=false
