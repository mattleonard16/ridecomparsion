# Vercel Deployment Guide

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mattleonard16/ridecomparsion)

## 📋 Required Environment Variables

### Minimum Required (App will work in mock mode)

```bash
# Database (Optional - will use mock mode if not set)
DATABASE_URL="postgresql://..."

# Supabase (Optional - will use mock mode if not set)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### Recommended for Full Features

```bash
# reCAPTCHA (for bot protection)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="your-site-key"
RECAPTCHA_SECRET_KEY="your-secret-key"

# Weather API (for real-time weather integration)
OPENWEATHER_API_KEY="your-api-key"

# Cron Secret (for scheduled jobs)
CRON_SECRET="generate-a-random-secret"
```

### Optional (Advanced Features)

```bash
# Monitoring
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
AXIOM_TOKEN="your-axiom-token"
AXIOM_DATASET="your-dataset-name"

# Events API
SEATGEEK_CLIENT_ID="your-client-id"
SEATGEEK_CLIENT_SECRET="your-client-secret"

# Rate Limiting (Redis)
UPSTASH_REDIS_REST_URL="your-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
```

## 🔧 Vercel Setup Steps

### 1. Import Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import `mattleonard16/ridecomparsion`
4. Select branch: `docs/rate-limiter-comments` (or `main`)

### 2. Configure Environment Variables

In Vercel project settings → Environment Variables, add:

**For Development/Preview:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://mock-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-key
NODE_ENV=development
```

**For Production:**
- Add real Supabase credentials
- Add OpenWeather API key
- Add reCAPTCHA keys
- Generate and add CRON_SECRET

### 3. Configure Build Settings

**Build Command:** `npm run build`  
**Output Directory:** `.next`  
**Install Command:** `npm install`

### 4. Deploy

Click "Deploy" - first deployment will take 2-3 minutes.

## 🔍 Troubleshooting Deployment Failures

### Error: "All checks have failed"

**Cause:** Missing environment variables or build errors

**Fix:**
1. Check Vercel build logs for specific errors
2. Ensure all required environment variables are set
3. Verify Supabase credentials are correct
4. Try deploying with mock mode first (no env vars)

### Error: "Module not found"

**Cause:** Missing dependencies

**Fix:**
```bash
# Locally, ensure all deps are installed
npm install
npm run build  # Should succeed locally

# Push updated package-lock.json
git add package-lock.json
git commit -m "fix: update dependencies"
git push
```

### Error: "Type errors in build"

**Cause:** TypeScript compilation errors

**Fix:**
The project has `ignoreBuildErrors: true` in `next.config.mjs`, but you can also:
```bash
# Check locally
npm run typecheck

# Fix any errors, then deploy
```

### Error: "Cron job failed"

**Cause:** Missing CRON_SECRET or API keys

**Fix:**
1. Add `CRON_SECRET` environment variable
2. Add `OPENWEATHER_API_KEY` for weather cron
3. Cron jobs will run in mock mode if APIs aren't configured

## 🎯 Mock Mode vs Production Mode

### Mock Mode (No Environment Variables)

✅ **Works:**
- Basic ride comparisons
- Pricing calculations
- Map and routing
- UI components

❌ **Limited:**
- No data persistence
- No user authentication
- No weather integration
- No price history

### Production Mode (With Environment Variables)

✅ **Full Features:**
- User authentication
- Saved routes
- Price history
- Weather integration
- Analytics dashboard
- Monitoring

## 📊 Vercel Cron Jobs (Optional - Requires Pro Plan)

⚠️ **Note:** Cron jobs require a Vercel Pro plan ($20/month). The app works perfectly without them!

The cron endpoints are available but not scheduled by default:

### Weather Updates (Optional)
- **Endpoint:** `/api/cron/weather`
- **Manual trigger:** `curl https://your-app.vercel.app/api/cron/weather`
- **Requires:** `OPENWEATHER_API_KEY`, `CRON_SECRET`

### Events Updates (Optional)
- **Endpoint:** `/api/cron/events`
- **Manual trigger:** `curl https://your-app.vercel.app/api/cron/events`
- **Requires:** `SEATGEEK_CLIENT_ID`, `CRON_SECRET`

**To enable cron scheduling (Pro plan only):**
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weather",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## 🔐 Security Checklist

Before deploying to production:

- [ ] Set real Supabase credentials (not mock)
- [ ] Generate strong `CRON_SECRET` (use: `openssl rand -base64 32`)
- [ ] Enable reCAPTCHA for bot protection
- [ ] Set up Sentry for error tracking
- [ ] Configure rate limiting with Upstash Redis
- [ ] Enable Vercel Analytics
- [ ] Set up custom domain with HTTPS

## 🚦 Deployment Status

Check deployment status at:
- **Production:** `https://your-app.vercel.app`
- **Preview:** `https://your-app-git-branch.vercel.app`
- **Dashboard:** `https://vercel.com/your-username/ridecomparsion`

## 📝 Post-Deployment

After successful deployment:

1. **Test Basic Features:**
   - Visit homepage
   - Try a ride comparison
   - Check map loads correctly

2. **Test Auth (if enabled):**
   - Sign in with email
   - Save a route
   - Set a price alert

3. **Monitor Health:**
   - Visit `/api/health`
   - Should return `{"status": "healthy"}`

4. **Check Cron Jobs:**
   - View Vercel logs
   - Verify cron jobs execute successfully

## 🆘 Need Help?

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on failed deployment
   - View "Build Logs" and "Function Logs"

2. **Local Testing:**
   ```bash
   npm run build
   npm start
   # Visit http://localhost:3000
   ```

3. **Common Issues:**
   - **Build fails:** Check `npm run typecheck` locally
   - **Runtime errors:** Check environment variables
   - **Cron fails:** Verify CRON_SECRET matches
   - **Auth fails:** Check Supabase credentials

## 🔄 Redeploying

To trigger a new deployment:

```bash
# Make a change and push
git add .
git commit -m "fix: deployment issue"
git push origin docs/rate-limiter-comments

# Or trigger manual redeploy in Vercel Dashboard
```

---

**Current Status:** The app is designed to work in both mock mode (no env vars) and production mode (with full configuration). Start with mock mode to verify deployment, then add environment variables incrementally.

