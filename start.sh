#!/bin/sh
set -e

echo "=== ANZU INGESTION STARTING ==="
echo "PORT:       ${PORT:-3000}"
echo "NODE_ENV:   ${NODE_ENV:-production}"
echo "DATABASE:   ${DATABASE_URL:+SET (hidden)}"

echo ""
echo ">>> Prisma package structure:"
ls /app/node_modules/prisma/ 2>&1 || echo "(not found)"
ls /app/node_modules/prisma/dist/ 2>&1 || echo "(no dist/ dir)"
ls /app/node_modules/prisma/build/ 2>&1 || echo "(no build/ dir)"
echo ">>> .bin/ prisma entries:"
ls /app/node_modules/.bin/prisma* 2>&1 || echo "(none)"

echo ""
echo ">>> Running prisma db push..."
# Determine bin path from package.json, fall back to dist/bin.js
PRISMA_BIN=$(node -e "try{const p=require('./node_modules/prisma/package.json');const b=p.bin&&(p.bin.prisma||Object.values(p.bin)[0]);console.log(b||'dist/bin.js')}catch(e){console.log('dist/bin.js')}" 2>/dev/null || echo "dist/bin.js")
echo ">>> Using prisma bin: $PRISMA_BIN"
node "./node_modules/prisma/$PRISMA_BIN" db push --skip-generate

echo ""
echo ">>> Prisma ready — launching Next.js server..."
exec node server.js
