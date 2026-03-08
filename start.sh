#!/bin/sh
set -e

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Running prisma db push..."
./node_modules/.bin/prisma db push --skip-generate

echo ""
echo ">>> Prisma ready — launching Next.js server..."
exec node server.js
