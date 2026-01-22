# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Comparative Rideshares: A Next.js 14 application that compares prices and wait times across Uber, Lyft, and Taxi services in the Bay Area. Features real-time surge pricing with time-based multipliers, interactive route mapping, price alerts, and comprehensive ride comparisons.

## Development Commands

### Setup

```bash
npm install              # Install dependencies
npm run db:migrate       # Apply Prisma migrations locally (creates schema)
npm run db:generate      # Regenerate Prisma Client after schema changes
npm run db:studio        # Open Prisma Studio data browser
```

### Development

```bash
npm run dev              # Start development server (localhost:3000)
npm run dev:https        # Start with HTTPS enabled
```

### Code Quality

```bash
npm run typecheck        # Run TypeScript compiler checks
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes
npm run quality          # Run all checks (typecheck + lint + format:check + test)
```

### Testing

```bash
npm test                 # Run Jest tests
npm test:watch           # Run tests in watch mode
npm run test:e2e         # Run Playwright E2E (dev server)
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # Playwright headed mode
```

Playwright E2E runs against `npm run dev` and uses `/test/*` routes that are blocked in production via `app/test/layout.tsx`. Test pages may expose internal helpers (for example, `window.__testMap`) and must remain dev-only.

### Build & Deployment

```bash
npm run build            # Build for production (runs prisma generate + next build)
npm start                # Start production server
npm run db:deploy        # Deploy migrations in production
```

### Data Management

```bash
npm run seed             # Seed database with sample data
npm run fetch:quotes     # Fetch ride quotes (custom script)
```

### Docker

```bash
docker compose up --build -d        # Build and run full stack
docker compose up -d db             # Run database only (for local development)
```

## Architecture

### Database Layer (Prisma + PostgreSQL)

**Location**: `prisma/schema.prisma`

The database uses a custom Prisma Client output path at `lib/generated/prisma` (non-standard location). Key models:

- **Route**: Stores pickup/destination with geohash clustering for spatial queries. Uses `pickup_geohash` and `destination_geohash` fields with precision 8 for efficient location-based lookups
- **PriceSnapshot**: Historical price data with surge multipliers, traffic levels, weather conditions, and confidence scores
- **User/Account/Session**: NextAuth.js authentication (Credentials provider with bcrypt)
- **SavedRoute/PriceAlert**: User-saved routes and price notification system
- **RideHistory**: Tracks user ride bookings with fare estimates and actuals
- **SearchLog**: Analytics and user behavior tracking
- **WeatherLog/EventLog/TrafficLog**: External data for pricing intelligence

**Enums**: `ServiceType` (UBER, LYFT, TAXI, ANY), `TrafficLevel` (LIGHT, MODERATE, HEAVY, SEVERE), `AlertType` (BELOW, ABOVE)

### Database Operations Layer

**Location**: `lib/database.ts`

Wrapper functions for common Prisma operations:

- Route CRUD with geohash indexing
- Price snapshot creation and queries
- Search logging with session tracking
- Alert management and triggering

Always import Prisma client from `lib/prisma.ts` (not from generated folder).

### Pricing Engine

**Location**: `lib/pricing.ts`

Core pricing calculation with configurable rules from `lib/pricing-config.json`. The `PricingEngine` class calculates fares using:

- Base fare + distance/time fees
- Airport fees (special handling for SJC with `sjcFee` config)
- Location surcharges (CBD, downtown SF/SJ detection)
- Time-based surge multipliers (weekday/weekend schedules)
- Traffic multipliers (compares OSRM duration vs expected)
- Confidence scoring (0.5-0.9 range based on uncertainty factors)

Returns detailed `PricingBreakdown` with all fee components exposed.

### Ride Comparison Service

**Location**: `lib/services/ride-comparison.ts`

Main business logic orchestrator:

1. **Geocoding pipeline**: Checks precomputed routes -> airport codes -> Nominatim API (with caching)
2. **Route metrics**: Fetches distance/duration from OSRM API with exponential retry
3. **Parallel pricing**: Calculates all services concurrently using `PricingEngine`
4. **Persistence**: Async database logging (non-blocking) for Route, PriceSnapshot, SearchLog
5. **Caching**: Three-tier in-memory cache (geocode: 5min, route: varies, comparison: 30min precomputed / 45sec dynamic)

The service uses `findPrecomputedRouteByAddresses` from `lib/popular-routes-data.ts` to serve cached results for common Bay Area routes.

### API Routes

**Location**: `app/api/`

#### Compare Rides (`compare-rides/route.ts`)

- `GET /api/compare-rides?pickup=...&destination=...`: Prefetch endpoint
- `POST /api/compare-rides`: Main comparison endpoint with reCAPTCHA verification (skipped for precomputed routes)
- Wrapped with CORS (`lib/cors.ts`) and rate limiting (`lib/rate-limiter.ts` using Upstash Redis)
- Input validation via Zod schemas in `lib/validation.ts`
- Supports legacy request format (pickup/destination strings) and new format (coordinate-based)

#### Dashboard (`dashboard/route.ts`)

- `GET /api/dashboard`: Returns user's saved routes, ride history, and price alerts
- Requires authentication (returns 401 if not logged in)
- Rate limited

#### Price Alerts (`price-alerts/route.ts`)

- `GET /api/price-alerts`: List user's price alerts
- `POST /api/price-alerts`: Create new price alert
- `DELETE /api/price-alerts?id=...`: Delete a price alert
- All endpoints require authentication

#### Health Check (`health/route.ts`)

- `GET /api/health`: Returns health status of database and OSRM connectivity
- Used for monitoring and uptime checks

#### Cron Jobs (`cron/`)

- `GET /api/cron/weather`: Collects weather data from OpenWeatherMap API (requires `CRON_SECRET`)
- `GET/POST /api/cron/cleanup`: Data retention cleanup - removes old logs (90 days) and price data (365 days)

### Authentication

**Location**: `auth.ts` (root)

NextAuth.js v5 with:

- Prisma adapter pointing to custom client path (`lib/generated/prisma`)
- JWT session strategy (not database sessions)
- Credentials provider with bcrypt password hashing
- Custom callbacks for session/token with user ID injection

### Frontend Architecture

**Next.js App Router** structure:

- `app/page.tsx`: Main ride comparison UI
- `app/dashboard/page.tsx`: User dashboard
- `app/demo/page.tsx`: Demo/testing page
- `app/providers.tsx`: Client-side provider wrapper (SessionProvider, AuthProvider, ThemeProvider)

**UI Components** (`components/ui/`): Radix UI primitives:

- `button.tsx`: Button with variants (primary, secondary, destructive)
- `input.tsx`: Input with label integration
- `label.tsx`: Accessible label component
- `card.tsx`: Card container with header/footer
- `alert.tsx`: Alert box with icons
- `switch.tsx`: Toggle switch
- `map.tsx`: MapLibre GL map component
- `3d-adaptive-navigation-bar.tsx`: Floating navigation pill with 3D animations

**Feature Components** (`components/`):

- `ride-comparison-form.tsx`: Pickup/destination input with autocomplete
- `ride-comparison-results.tsx`: Results display with price cards
- `RouteMapClient.tsx`: Client wrapper for map with OSRM route fetching
- `price-alert.tsx`: Price alert creation/management
- `auth-dialog.tsx`: Login/signup modal
- `RouteList.tsx`: Saved routes list
- `user-menu.tsx`: User dropdown menu
- `Hero.tsx`, `FeatureGrid.tsx`: Landing page components

### Map Component

**Location**: `components/ui/map.tsx`

MapLibre GL-based map component with:

- `Map`: Root container with theme-aware CARTO basemap tiles (auto light/dark switching)
- `MapMarker` + `MarkerContent`: Custom markers with Tailwind-styled pins
- `MapRoute`: GeoJSON line rendering for route visualization with white casing/outline
- `MapControls`: Zoom, compass, locate, and fullscreen controls
- `useMap()`: Hook for programmatic map access (fitBounds, flyTo, etc.)

Used by `RouteMapClient.tsx` for route visualization with OSRM-fetched driving directions.

### PWA Configuration

**Location**: `next.config.mjs`

Progressive Web App enabled in production only (disabled in dev to avoid babel issues):

- Caches OpenStreetMap tiles (7 days, CacheFirst)
- Caches Nominatim API (1 day, NetworkFirst)
- Caches OSRM API (1 hour, NetworkFirst)

### Key Utilities

| File | Purpose |
|------|---------|
| `lib/pricing.ts` | PricingEngine class for fare calculations |
| `lib/database.ts` | Prisma wrapper functions |
| `lib/validation.ts` | Zod schemas + input validation + spam detection |
| `lib/geo.ts` | Geohash encoding/decoding utilities |
| `lib/airports.ts` | Airport detection by code/coordinates (12+ airports) |
| `lib/constants.ts` | Common places (airports, Bay Area landmarks), API config |
| `lib/rate-limiter.ts` | Multi-layer rate limiting (burst + per-hour) |
| `lib/cors.ts` | CORS middleware for allowed origins |
| `lib/redis.ts` | Upstash Redis client initialization |
| `lib/recaptcha.ts` | reCAPTCHA Enterprise API integration |
| `lib/monitoring.ts` | Structured logging (Axiom/Sentry) |
| `lib/popular-routes-data.ts` | Pre-computed popular Bay Area routes |
| `lib/hooks/use-recaptcha.ts` | React hook for reCAPTCHA client-side |
| `lib/etl/weather-cron.ts` | Weather data collection from OpenWeatherMap |
| `lib/auth-context.tsx` | React context for authentication state |
| `lib/utils.ts` | Utility helper `cn()` for Tailwind CSS merging |
| `lib/prisma.ts` | Prisma client singleton with connection pooling |

## Environment Variables

Required in `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://..."         # Prisma connection string
DIRECT_URL="postgresql://..."           # Direct database connection (for migrations)

# Rate Limiting
UPSTASH_REDIS_REST_URL="https://..."   # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN="..."         # Upstash Redis token

# Security
RECAPTCHA_SECRET_KEY="..."             # reCAPTCHA Enterprise project key
RECAPTCHA_SITE_KEY="..."               # reCAPTCHA Enterprise site key

# Authentication
NEXTAUTH_SECRET="..."                  # NextAuth.js JWT signing
NEXTAUTH_URL="http://localhost:3000"   # Auth callback URL

# Optional: Cron Jobs
CRON_SECRET="..."                      # Secret for cron endpoint auth
OPENWEATHER_API_KEY="..."              # Weather data collection

# Optional: Monitoring
AXIOM_TOKEN="..."                      # Axiom logging
AXIOM_DATASET="..."                    # Axiom dataset name
SENTRY_DSN="..."                       # Sentry error tracking
```

See `ENV_EXAMPLE.md` for complete reference.

## Important Patterns

### Database Access

Always import Prisma client from `lib/prisma.ts` (not from generated folder). The generated client is at `lib/generated/prisma` due to custom `output` setting in schema.

```typescript
import { prisma } from '@/lib/prisma'
```

### Pricing Calculations

Use `pricingEngine.calculateFare()` for full breakdown or helper functions (`calculateEnhancedFare`, `getTimeBasedMultiplier`) for simplified use cases. Never hardcode pricing logic outside `lib/pricing.ts`.

### API Error Handling

APIs use non-blocking async logging that catches and logs errors without failing the request. Database operations use `.catch()` with warning logs for non-critical operations (see `ride-comparison.ts:188-196`).

### Geohash Clustering

Routes use geohash prefixes for location clustering (precision 8). When querying by area, use prefix matching on `pickup_geohash` and `destination_geohash` fields.

### Caching Strategy

External API calls (Nominatim, OSRM) are cached in-memory with TTL. Precomputed routes have longer TTL (30min). Always check cache before external API calls.

### Security

- **reCAPTCHA Enterprise**: Verifies POST requests to `/api/compare-rides` (skipped for precomputed routes)
- **Rate Limiting**: Redis-backed burst (10/10s) + per-hour (100/hour) limits with in-memory fallback
- **Input Validation**: Zod schemas validate all user input with spam detection
- **CORS**: Allowed origins configured in `lib/cors.ts`

### Data Retention

Automated cleanup cron removes:
- Search logs, traffic logs, event logs: 90 days
- Price snapshots, weather logs: 365 days

## Deployment Notes

- Runs on Vercel with `output: 'standalone'` in next.config.mjs
- TypeScript and ESLint checks enforced at build time (no silent failures)
- Prisma generation runs automatically on `postinstall` and before `build`
- Rate limiting requires Upstash Redis (falls back to in-memory for local dev)
- reCAPTCHA Enterprise verifies POST requests but allows degraded operation on verification failures
- Cron jobs secured with `CRON_SECRET` header validation

## Testing Strategy

### Jest (Unit Tests)

Configuration in `jest.config.js`:

- Environment: jsdom
- Path aliases: `@/` maps to root
- Setup file: `jest.setup.ts` (with @testing-library/jest-dom)
- Mocks: next-auth, navigator APIs (geolocation, vibrate, share, clipboard)

Test files location: `__tests__/`
- `services/ride-comparison.test.ts`
- `components/ride-comparison-form.test.tsx`
- `components/ride-comparison-results.test.tsx`
- `fixtures/uberSamples.json`

Run specific test file:

```bash
npm test -- path/to/test.spec.ts
```

### Playwright (E2E Tests)

Configuration in `playwright.config.ts`:

- Browser: Chromium only
- Base URL: localhost:3000
- Dev server: `npm run dev`

Test files location: `e2e/`
- `map-route.spec.ts`: Map route interaction tests

## Code Style

Prettier configuration (`.prettierrc`):
- No semicolons
- Single quotes
- Tab width: 2
- Print width: 100
- Trailing commas: ES5

ESLint extends: `next/core-web-vitals`

## Codex Integration

### CLI Invocation

```bash
# STANDARD PATTERN - suppresses reasoning traces, returns only final answer
codex exec "prompt" 2>/dev/null

# Resume latest session
codex exec resume --last "follow-up prompt" 2>/dev/null

# Resume specific session by ID
codex exec resume <SESSION_ID> "follow-up prompt" 2>/dev/null
```

**IMPORTANT: Always run in background** using `run_in_background: true` parameter on Bash tool. This allows conversation to continue while Codex analyzes. Wait for `<bash-notification>` completion signal, then retrieve with `TaskOutput`. Never set explicit timeouts - Codex analysis is thorough and should complete naturally.

**CRITICAL: Always use `2>/dev/null`**. Without it, Codex outputs verbose reasoning traces to stderr that bloat Claude's context window by 10x or more. The `2>/dev/null` suffix:

- Suppresses stderr (where all `thinking` + `exec` traces go)
- Returns only stdout (the clean final answer)
- Reduces a ~15KB trace to ~1.5KB answer

**Sandbox**: Read-only by default. Claude executes all file modifications.
