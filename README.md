# AnzuIngestion

Multi-channel invoice ingestion platform. Accept invoices via **Web upload**, **Email**, or **WhatsApp**, extract structured data with **Claude AI**, and manage everything in a clean admin dashboard.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Required:
- `ANTHROPIC_API_KEY` — get from [console.anthropic.com](https://console.anthropic.com)
- `DATABASE_URL` — defaults to SQLite (`file:./dev.db`), no setup needed
- `OPENAI_API_KEY` — required for OCR/extraction features

Recommended for full OpenAI capabilities:
- `OPENAI_FULL_ACCESS_API_KEY` — use a key with Files API scopes (e.g. `api.files.write`) for PDF uploads and fine-tuning.

Optional (for email and WhatsApp):
- `SMTP_*` — for sending confirmation emails (use Mailtrap for dev)
- `TWILIO_*` — for WhatsApp ingestion

### 3. Initialize the database
```bash
npm run db:push
```

### 4. Start the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the provider portal.
Open [http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard.

---

## Features

| Feature | Status |
|---------|--------|
| Web upload (PDF, PNG, JPG, HEIC, TIFF) | ✅ |
| Claude AI extraction (vendor, amount, line items, etc.) | ✅ |
| Confidence scoring + low-confidence flagging | ✅ |
| Duplicate detection | ✅ |
| Email ingestion webhook (SendGrid Inbound Parse) | ✅ |
| WhatsApp ingestion (Twilio) | ✅ |
| Admin dashboard with search, filter, sort | ✅ |
| Inline field editing with audit trail | ✅ |
| CSV export | ✅ |
| Provider status tracking page | ✅ |
| Confirmation emails | ✅ |

## Architecture

```
AnzuIngestion/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Provider portal
│   │   ├── admin/page.tsx        # Admin dashboard
│   │   ├── status/[ref]/page.tsx # Invoice status page
│   │   └── api/
│   │       ├── upload/           # Web file upload
│   │       ├── invoices/         # Invoice CRUD
│   │       ├── status/[ref]/     # Status lookup
│   │       ├── metrics/          # Dashboard metrics
│   │       ├── export/           # CSV export
│   │       ├── files/            # File serving
│   │       └── webhooks/
│   │           ├── email/        # SendGrid inbound parse
│   │           └── whatsapp/     # Twilio webhook
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   ├── InvoiceTable.tsx
│   │   ├── InvoiceDetail.tsx
│   │   ├── MetricsPanel.tsx
│   │   └── StatusBadge.tsx
│   └── lib/
│       ├── claude.ts             # Claude API extraction
│       ├── storage.ts            # File storage
│       ├── email.ts              # Email sending
│       └── prisma.ts             # Database client
├── prisma/schema.prisma          # Database schema
└── uploads/                      # Local file storage
```

## Webhook Setup

### Email (SendGrid Inbound Parse)
1. Configure your MX record to point to SendGrid
2. Set the parse webhook URL to: `https://yourdomain.com/api/webhooks/email`
3. Enable "Send Raw" in SendGrid settings

### WhatsApp (Twilio)
1. Get a Twilio WhatsApp-enabled phone number
2. Set the webhook URL to: `https://yourdomain.com/api/webhooks/whatsapp`
3. Set method to POST

## Production

For production, switch to PostgreSQL by updating `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

And run `npm run db:migrate` to create migrations.
