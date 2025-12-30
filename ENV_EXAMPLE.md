# Environment Variables Example

Create a `.env.local` file in the project root with the following variables:

```bash
# Database (Neon PostgreSQL)
# For Vercel/serverless: Use pooled connection for DATABASE_URL
# and unpooled connection for DIRECT_URL (migrations)
DATABASE_URL="postgresql://neondb_owner:[password]@ep-xxx-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:[password]@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# For local development with Docker:
# DATABASE_URL="postgresql://user:YOUR_PASSWORD@localhost:5432/rideshareappnew?schema=public"
# DIRECT_URL="postgresql://user:YOUR_PASSWORD@localhost:5432/rideshareappnew?schema=public"

# NextAuth.js
AUTH_SECRET="your-auth-secret-key-generate-with-openssl-rand-base64-32"

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="your-recaptcha-site-key"
RECAPTCHA_SECRET_KEY="your-recaptcha-secret-key"

# Weather API (OpenWeather)
OPENWEATHER_API_KEY="your-openweather-api-key"

# Events API (Optional - SeatGeek or Ticketmaster)
SEATGEEK_CLIENT_ID="your-seatgeek-client-id"
SEATGEEK_CLIENT_SECRET="your-seatgeek-client-secret"

# Monitoring (Optional)
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
AXIOM_TOKEN="your-axiom-token"
AXIOM_DATASET="your-axiom-dataset"

# Vercel Cron Secret (Production)
# Required for /api/cron/* endpoints
CRON_SECRET="your-cron-secret"

# Rate Limiting (Optional - Upstash Redis)
UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"

# App URL (for CORS in production)
NEXT_PUBLIC_APP_URL="https://rideshare.yourdomain.com"

# Node Environment
NODE_ENV="development"

# Database Mock Mode (NOT RECOMMENDED for production)
# Set to "true" to bypass DATABASE_URL requirement in production
# ALLOW_DB_MOCK="true"
```

## Required Variables

- `DATABASE_URL`: PostgreSQL connection string (use Neon pooled URL for serverless)
- `DIRECT_URL`: Direct PostgreSQL connection for Prisma migrations (Neon unpooled URL)
- `AUTH_SECRET`: Secret key for NextAuth.js (generate with `openssl rand -base64 32`)

## Neon Connection Setup

For production on Vercel, you need two connection strings from Neon:

1. **DATABASE_URL** (pooled): Go to Neon Dashboard > Your Project > Connection Details > Connection string
   - Use the **pooled** connection (hostname includes `-pooler`)
   - Example: `postgresql://user@ep-xxx-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
   - Used for runtime database queries

2. **DIRECT_URL** (unpooled): Go to Neon Dashboard > Your Project > Connection Details > Connection string
   - Use the **unpooled** connection (hostname without `-pooler`)
   - Example: `postgresql://user@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`
   - Used for Prisma migrations only

> **Note**: Both URLs require `?sslmode=require` for Neon connections.

## Optional Variables

- `OPENWEATHER_API_KEY`: For real-time weather data integration
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY`: For bot protection
- `AXIOM_TOKEN` / `AXIOM_DATASET`: For structured logging and error monitoring
- `NEXT_PUBLIC_SENTRY_DSN`: For error tracking
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: For persistent rate limiting
- `CRON_SECRET`: Required for authenticated cron endpoints (`/api/cron/weather`, `/api/cron/cleanup`)
