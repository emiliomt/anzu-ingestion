#!/bin/sh
set -e

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Running prisma db push..."
# Use node + package path directly so __dirname resolves inside the prisma
# package (where WASM files live).  Prisma v5 CLI entry: build/index.js
node ./node_modules/prisma/build/index.js db push --skip-generate

echo ""
echo ">>> Prisma ready — launching Next.js server..."
exec node server.js
