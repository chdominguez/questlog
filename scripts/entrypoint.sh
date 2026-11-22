#!/bin/sh
set -e
# No replica configured: run the server alone (local dev, self-hosters without backups).
if [ -z "$LITESTREAM_BUCKET" ]; then exec node dist-server/index.js; fi
litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists "$DB_PATH"
exec litestream replicate -config /etc/litestream.yml -exec "node dist-server/index.js"
