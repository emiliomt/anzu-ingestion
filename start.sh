#!/bin/sh

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Running prisma db push..."

# Retry prisma db push up to 10 times with exponential backoff.
# Uses shell `if` so a failed push does NOT trigger set -e / early exit.
DB_PUSH_OK=0
ATTEMPT=1
DELAY=2
while [ "$ATTEMPT" -le 10 ]; do
  if node ./node_modules/prisma/build/index.js db push --skip-generate; then
    DB_PUSH_OK=1
    echo ">>> Prisma db push succeeded on attempt $ATTEMPT"
    break
  fi
  echo ">>> Prisma db push failed (attempt $ATTEMPT/10) — retrying in ${DELAY}s..."
  sleep "$DELAY"
  ATTEMPT=$((ATTEMPT + 1))
  DELAY=$((DELAY * 2))
done

if [ "$DB_PUSH_OK" -eq 0 ]; then
  echo ">>> WARNING: Prisma db push failed after 10 attempts."
  echo ">>>          Starting Next.js server anyway — DB-dependent routes will"
  echo ">>>          return errors until the database is reachable."
fi

echo ""
echo ">>> Launching Next.js server..."
exec node server.js
