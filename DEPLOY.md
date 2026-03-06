# Deployment Guide

## Option A — Railway (Full-stack: App + PostgreSQL)

Railway runs the app in Docker with a managed PostgreSQL database.

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Create project and provision database
```bash
railway init          # creates a new Railway project
railway add           # add PostgreSQL plugin → sets DATABASE_URL automatically
```

### 3. Set environment variables
```bash
railway variables set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  STORAGE_TYPE="local" \
  NEXT_PUBLIC_APP_URL="https://<your-railway-domain>" \
  SMTP_HOST="" \
  SMTP_PORT="587" \
  SMTP_USER="" \
  SMTP_PASS="" \
  TWILIO_ACCOUNT_SID="" \
  TWILIO_AUTH_TOKEN="" \
  TWILIO_PHONE_NUMBER="" \
  NEXT_OUTPUT="standalone"
```

> **Note:** Railway automatically provides `DATABASE_URL` when you add PostgreSQL. No need to set it manually.

### 4. Switch Prisma to PostgreSQL
Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"    # change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 5. Deploy
```bash
railway up
```

Railway uses the `Dockerfile` automatically. It will:
- Build the Next.js app in standalone mode
- Run `prisma db push` on startup to create tables
- Serve on port 3000

### 6. Persistent file storage
By default, uploads go to `/app/uploads` inside the container (ephemeral). For production:
- Set `STORAGE_TYPE=s3` and configure AWS S3 (see Option B)
- Or mount a Railway volume at `/app/uploads`

---

## Option B — Vercel (Frontend/API) + Railway (Database)

Vercel serverless functions are stateless — use S3 for file storage and Railway (or Supabase/PlanetScale) for the database.

### Prerequisites
- Railway project with PostgreSQL (follow steps 1–3 above to get `DATABASE_URL`)
- AWS S3 bucket (or compatible: R2, MinIO)
- Vercel account

### 1. Push code to GitHub
```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

### 2. Connect to Vercel
- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repo
- Vercel auto-detects Next.js

### 3. Set environment variables in Vercel dashboard
| Variable | Value |
|---|---|
| `DATABASE_URL` | PostgreSQL URL from Railway |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `STORAGE_TYPE` | `s3` |
| `AWS_REGION` | `us-east-1` (or your region) |
| `AWS_ACCESS_KEY_ID` | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret |
| `AWS_S3_BUCKET` | Your bucket name |
| `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>` |
| `SMTP_HOST` | (optional) |
| `TWILIO_*` | (optional) |

### 4. Run database migrations (one-time)
From your local machine with the Railway DATABASE_URL:
```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

### 5. Deploy
Vercel deploys automatically on every push to `main`. Or trigger manually:
```bash
npx vercel --prod
```

The `vercel.json` is already configured with:
- `maxDuration: 60` for upload and webhook routes
- `STORAGE_TYPE: s3` override for production

---

## AWS S3 Setup

```bash
# Create bucket
aws s3 mb s3://anzuingestion-files --region us-east-1

# Set CORS (required for presigned URL uploads)
aws s3api put-bucket-cors --bucket anzuingestion-files --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://your-domain.com"],
    "MaxAgeSeconds": 3600
  }]
}'

# Create IAM user with S3 access
aws iam create-user --user-name anzuingestion-s3
aws iam attach-user-policy --user-name anzuingestion-s3 \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam create-access-key --user-name anzuingestion-s3
```

---

## Webhook Configuration

### Email (SendGrid Inbound Parse)
1. Add MX record: `inbound.sendgrid.net` for your domain
2. SendGrid → Settings → Inbound Parse → Add Host & URL:
   - URL: `https://yourdomain.com/api/webhooks/email`
   - Enable "Send Raw"

### WhatsApp (Twilio)
1. Twilio Console → Messaging → WhatsApp Sandbox (or production number)
2. Webhook URL: `https://yourdomain.com/api/webhooks/whatsapp`
3. Method: POST

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path or PostgreSQL URL |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for extraction |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your deployment |
| `STORAGE_TYPE` | No | `local` (default) or `s3` |
| `STORAGE_PATH` | No | Local upload path (default: `./uploads`) |
| `AWS_REGION` | S3 only | AWS region |
| `AWS_ACCESS_KEY_ID` | S3 only | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | S3 only | AWS secret |
| `AWS_S3_BUCKET` | S3 only | S3 bucket name |
| `SMTP_HOST` | No | SMTP server (skip = no emails) |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID (skip = no WhatsApp) |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio WhatsApp number |
| `NEXT_OUTPUT` | Docker only | Set to `standalone` for Docker builds |
