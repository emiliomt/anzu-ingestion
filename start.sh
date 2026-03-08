#!/bin/sh
set -e

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Running prisma db push..."
# Call prisma via node directly so __dirname resolves to the prisma package
# directory (where WASM files live), not to node_modules/.bin/ where Docker
# copies the symlink target and loses the correct relative path.
node ./node_modules/prisma/dist/bin.js db push --skip-generate

echo ""
echo ">>> Prisma ready — launching Next.js server..."
exec node server.js
