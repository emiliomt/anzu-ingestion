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
# --accept-data-loss is required because the settings table PK changed from
# `key` to `id` (with @@unique([key, organizationId])), which Prisma cannot
# apply without dropping/recreating the table.
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss

echo ""
echo ">>> Prisma ready — launching Next.js server..."
exec node server.js
