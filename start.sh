#!/bin/sh

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

# Run prisma db push once with a hard cap so it can never block server startup.
# If DATABASE_URL is absent or the DB is unreachable the push is skipped/fails
# quickly and we still launch the Next.js server within a few seconds.
if [ -n "$DATABASE_URL" ]; then
  echo ""
  echo ">>> Running prisma db push (max 25s)..."
  if timeout 25 node ./node_modules/prisma/build/index.js db push --skip-generate; then
    echo ">>> Prisma schema is up to date"
  else
    echo ">>> WARNING: prisma db push failed — starting server anyway"
  fi
else
  echo ">>> DATABASE_URL not set — skipping prisma db push"
fi

echo ""
echo ">>> Launching Next.js server..."
exec node server.js
