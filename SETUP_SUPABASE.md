# Supabase Setup Guide

## Quick Start (10 minutes)

### 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose organization (or create one)
4. Set project name: `rideshare-app`
5. Generate a strong database password (save it!)
6. Choose region closest to you
7. Click "Create Project" (takes 2 minutes)

### 2. Run Database Schema

1. In Supabase Dashboard, click "SQL Editor" (left sidebar)
2. Click "New Query"
3. Copy entire contents of `supabase/schema.sql`
4. Paste and click "Run"
5. You should see "Success. No rows returned"

### 3. Get API Keys

1. Go to Settings → API (left sidebar)
2. Copy these values to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-long-anon-key...
```

### 4. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 5. Generate TypeScript Types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

## Enable Authentication

### 1. Email Auth (Quick Start)

1. Go to Authentication → Providers
2. Enable "Email" provider
3. Disable "Confirm email" for testing (enable in production!)

### 2. Google Auth (Optional)

1. Get OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
2. Add to Supabase Authentication → Providers → Google
3. Add redirect URL to Google OAuth settings

## Set Up Edge Functions (For ETL)

### 1. Weather Data Fetcher

Create edge function at Supabase Dashboard → Edge Functions:

```typescript
// weather-fetcher
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async req => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch from OpenWeather API
  const weatherRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=37.7749&lon=-122.4194&appid=${Deno.env.get('OPENWEATHER_API_KEY')}`
  )
  const weatherData = await weatherRes.json()

  // Store in database
  await supabase.from('weather_logs').insert({
    lat: 37.7749,
    lng: -122.4194,
    temperature_f: Math.round(((weatherData.main.temp - 273.15) * 9) / 5 + 32),
    condition: weatherData.weather[0].main,
    precipitation_inch: weatherData.rain?.['1h'] || 0,
    wind_speed_mph: Math.round(weatherData.wind.speed * 2.237),
    raw_data: weatherData,
  })

  return new Response(JSON.stringify({ success: true }))
})
```

### 2. Schedule the Function

In Supabase Dashboard → Cron Jobs:

```sql
SELECT
  cron.schedule(
    'fetch-weather',
    '*/15 * * * *', -- Every 15 minutes
    $$SELECT net.http_post(
      'https://YOUR_PROJECT.supabase.co/functions/v1/weather-fetcher',
      '{}',
      headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    );$$
  );
```

## Local Development Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link to Project

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

### 3. Start Local Development

```bash
supabase start # Starts local Postgres
```

## Testing the Integration

### 1. Test Route Creation

```typescript
// In your Next.js app
import { findOrCreateRoute } from '@/lib/supabase'

const routeId = await findOrCreateRoute(
  'Santa Clara University',
  [-121.939, 37.3496],
  'San Francisco Airport',
  [-122.379, 37.6213],
  28.5, // miles
  35 // minutes
)
console.log('Route ID:', routeId)
```

### 2. Test Price Logging

```typescript
import { logPriceSnapshot } from '@/lib/supabase'

await logPriceSnapshot(
  routeId,
  'uber',
  45.5,
  1.25, // surge
  5, // wait time
  {
    weather: 'Clear',
    temperature: 72,
    trafficLevel: 'moderate',
  }
)
```

### 3. Verify in Dashboard

1. Go to Table Editor in Supabase
2. Check `routes` table - should have 1 row
3. Check `price_snapshots` table - should have 1 row

## Production Checklist

- [ ] Enable email confirmation
- [ ] Set up proper CORS origins
- [ ] Enable RLS policies
- [ ] Set up backup schedule
- [ ] Configure rate limiting
- [ ] Set up monitoring alerts
- [ ] Add custom domain (optional)

## Troubleshooting

### "Permission denied for schema public"

Run this in SQL Editor:

```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

### Types not generating

Make sure you're logged in:

```bash
npx supabase login
```

### CORS errors

Add your domain to Authentication → URL Configuration → Redirect URLs
