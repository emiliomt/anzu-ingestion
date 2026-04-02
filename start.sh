#!/bin/sh

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Running prisma db push (timeout 45s)..."
# Run with a timeout so a hung Prisma never blocks the server from starting.
# --accept-data-loss suppresses interactive prompts about destructive changes.
# We use || true so the server always starts even if the push fails.
timeout 45s node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss \
  && echo ">>> Prisma push OK." \
  || echo "WARN: prisma db push did not complete successfully (exit $?). Server will still start."

echo ""
echo ">>> Launching Next.js server..."
exec node server.js
