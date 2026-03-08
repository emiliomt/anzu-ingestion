# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Builder ----
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Switch Prisma provider to PostgreSQL for production build
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
# Generate Prisma client before building
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Enable Next.js standalone output (required for Docker deployment)
ENV NEXT_OUTPUT=standalone
# Provide a dummy DATABASE_URL so Prisma can initialise at build time.
# All API routes use `export const dynamic = "force-dynamic"` so no real
# DB queries are made during `next build` — this just satisfies the env check.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# ---- Runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copy prisma CLI so we can run db push at startup without downloading it
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Create uploads directory for local file storage (or mount a volume)
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Copy startup script — strip any Windows CRLF line endings, then make executable
COPY start.sh /app/start.sh
RUN sed -i 's/\r//' /app/start.sh && chmod +x /app/start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run DB migrations then start the server
CMD ["/app/start.sh"]
