# Environment Variables Example

Create a `.env.local` file in the project root with the following variables:

```bash
# Database
DATABASE_URL="postgresql://user:YOUR_PASSWORD@localhost:5432/rideshareappnew?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

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
CRON_SECRET="your-cron-secret"

# Rate Limiting (Optional - Upstash Redis)
UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"

# Node Environment
NODE_ENV="development"
```

## Required Variables

- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

## Optional Variables

- `OPENWEATHER_API_KEY`: For real-time weather data integration
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY`: For bot protection
- `AXIOM_TOKEN` / `AXIOM_DATASET`: For structured logging
- `NEXT_PUBLIC_SENTRY_DSN`: For error tracking
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: For persistent rate limiting

See `SETUP_SUPABASE.md` for detailed setup instructions.
