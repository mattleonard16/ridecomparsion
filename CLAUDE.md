# Context + Sub-Agent Orchestration (Opus 4.5)

## Goal
Minimize context bloat by ingesting an AST-level skeleton (ast-grep) instead of full files.
When deep analysis is needed, delegate to Gemini CLI and Codex CLI as sub-agents, wait for both, then synthesize a final plan.

## Context Ingestion Policy (Skeleton-First)
- Default: do NOT read full source files.
- First build an AST skeleton using ast-grep:
  - imports/exports
  - public functions/classes
  - route/handler entrypoints
  - key types/interfaces
  - config + env keys
  - TODO/FIXME markers
- Only open full files if the skeleton indicates ambiguity or a precise edit is required.

## Skeleton Build Command (recommended)
- Generate a compact repo map + AST signatures for relevant languages.
- Prefer output into ./site-cache/skeleton.md for reuse.

## Sub-Agent Delegation Protocol
For any task requiring “full analysis”:
1) Create the skeleton first.
2) Invoke Gemini and Codex in parallel with the skeleton + task prompt.
3) WAIT for both reports, then synthesize (ultrathink) into:
   - diagnosis
   - proposed changes
   - patch plan (file-by-file)
   - test/verification steps
   - risks  rollback

## Codex Integration (MANDATORY)
Always invoke Codex via CLI exactly like this (suppress stderr traces):
- `codex exec "PROMPT" 2> /dev/null`
- `codex exec resume --last "FOLLOW_UP" 2> /dev/null`
- `codex exec resume <SESSION_ID> "FOLLOW_UP" 2> /dev/null`

CRITICAL: Always append `2> /dev/null` to prevent reasoning traces from bloating context.

When using the Bash tool:
- Run Codex with `run_in_background: true`
- Wait for `<bash-notification>` completion
- Retrieve results via `TaskOutput`

## Gemini Integration
Invoke Gemini CLI as a parallel sub-agent using the same skeleton + prompt.
(Use the local Gemini CLI command available in this environment; if the binary name differs, update the command.)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 rideshare comparison app built with TypeScript that allows users to compare prices and wait times across Uber, Lyft, and Taxi services in the Bay Area. The app uses the App Router, includes Progressive Web App (PWA) features, and implements comprehensive security measures.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run quality` - Run full quality check (typecheck + lint + format + test)

### Additional Commands
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run dev:https` - Start development server with HTTPS

### Database Commands (Prisma)
- `npm run db:migrate` - Run Prisma migrations in development
- `npm run db:deploy` - Deploy migrations to production
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio GUI

### Script Commands
- `npm run fetch:quotes` - Fetch rideshare quotes (tsx scripts/fetch-quotes.ts)
- `npm run seed` - Seed the database (tsx scripts/seed.ts)

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL via Prisma ORM
- **Backend-as-a-Service**: Supabase (auth, database, real-time)
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with custom components
- **Animation**: Framer Motion for transitions and interactions
- **Maps**: React Leaflet with OpenStreetMap tiles
- **Testing**: Jest with React Testing Library
- **PWA**: next-pwa for offline capabilities
- **Analytics**: Vercel Analytics

### Key Features
- **Real-time pricing** with surge calculations
- **Interactive mapping** with route visualization
- **PWA support** with offline caching
- **Comprehensive security** (rate limiting, input validation, reCAPTCHA)
- **Mobile-optimized** with responsive design
- **Price alerts** and ETA sharing
- **User authentication** via Supabase magic links
- **Analytics dashboard** for price trends and insights
- **Weather and events ETL** for surge prediction

### Directory Structure
- `app/` - Next.js App Router pages and API routes
- `components/` - React components (UI primitives in `components/ui/`)
- `lib/` - Shared utilities, pricing logic, services, and API helpers
- `lib/services/` - Business logic services (ride comparison)
- `lib/etl/` - ETL jobs for weather and events data
- `lib/generated/prisma/` - Generated Prisma client (do not edit)
- `lib/hooks/` - Custom React hooks
- `types/` - TypeScript type definitions
- `prisma/` - Prisma schema and migrations
- `supabase/` - Supabase schema and configuration
- `scripts/` - Utility scripts (seeding, data fetching)
- `__tests__/` - Jest test files organized by feature
- `public/` - Static assets and PWA manifest

### Core Components Architecture
- **Main Page** (`app/page.tsx`) - Landing page with scroll-snap sections
- **Dashboard** (`app/dashboard/page.tsx`) - Analytics dashboard (authenticated)
- **Demo Page** (`app/demo/page.tsx`) - Demo/showcase page
- **API Route** (`app/api/compare-rides/route.ts`) - Rideshare comparison endpoint
- **Health Check** (`app/api/health/route.ts`) - Health check endpoint
- **Form Component** (`components/ride-comparison-form.tsx`) - Main user interface
- **Results Component** (`components/ride-comparison-results.tsx`) - Price comparison display
- **Map Components** (`components/RouteMap.tsx`, `RouteMapClient.tsx`) - Interactive mapping
- **Auth Components** (`components/auth-dialog.tsx`, `components/user-menu.tsx`) - Authentication UI

### Services Layer
The app uses a services layer for business logic:
- **Ride Comparison Service** (`lib/services/ride-comparison.ts`) - Core comparison logic
  - `compareRidesByAddresses()` - Compare rides using address strings
  - `compareRidesByCoordinates()` - Compare rides using coordinates
  - Includes caching (geocode, route, comparison caches)
  - Handles geocoding via Nominatim API
  - Handles routing via OSRM API
  - Persists data to Supabase

### Pricing Engine
The app includes a sophisticated pricing calculation system:
- **Pricing Module** (`lib/pricing.ts`) - Core fare calculation logic with `pricingEngine`
- **Pricing Config** (`lib/pricing-config.json`) - Service-specific pricing parameters
- **Time-based Surge** - Dynamic pricing based on time of day and location
- **Airport Fees** - Special handling for SFO, SJC, and other airports (`lib/airports.ts`)
- **Location Surcharges** - Downtown and CBD pricing adjustments

### Database Schema
The app uses two database systems:

**Prisma (PostgreSQL)** - Primary data models:
- `Route` - Stored routes with coordinates and metadata
- `PriceSnapshot` - Historical price data with conditions
- `User` - User profiles and preferences
- `SavedRoute` - User's saved routes
- `PriceAlert` - Price threshold alerts
- `RideHistory` - User ride history
- `SearchLog` - Search analytics
- `WeatherLog` - Weather data for surge prediction
- `EventLog` - Event data for surge prediction
- `TrafficLog` - Traffic conditions

**Supabase** - Auth and real-time features:
- User authentication (magic links)
- Real-time subscriptions
- Database functions (RPC calls)

### Authentication
Authentication is handled via Supabase:
- **Auth Context** (`lib/auth-context.tsx`) - React context for auth state
- **Auth Callback** (`app/auth/callback/route.ts`) - OAuth callback handler
- **Magic Link Auth** - Email-based passwordless authentication
- **useAuth Hook** - Access user, session, signIn, signOut

### ETL / Cron Jobs
Background data collection endpoints (configured in `vercel.json`):
- **Weather Cron** (`app/api/cron/weather/route.ts`) - Fetches weather data every 15 minutes
- **Events Cron** (`app/api/cron/events/route.ts`) - Fetches event data every 6 hours
- Protected by `CRON_SECRET` environment variable in production

### Security Implementation
Comprehensive security measures are implemented:
- **Rate Limiting** (`lib/rate-limiter.ts`) - Burst protection and per-minute/hourly limits
- **Input Validation** (`lib/validation.ts`) - Zod schemas with geographic bounds checking
- **reCAPTCHA v3** (`lib/recaptcha.ts`) - Invisible bot protection with score-based filtering
- **Spam Detection** - Pattern matching for common spam indicators
- **Coordinate Validation** - Bay Area geographic bounds enforcement

## Testing

### Test Structure
- Component tests in `__tests__/components/`
- Service tests in `__tests__/services/`
- Test fixtures in `__tests__/fixtures/`

### Running Tests
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- Tests use Jest with jsdom environment
- Component testing with React Testing Library

## Development Notes

### Code Style
- Uses TypeScript strict mode
- Tailwind CSS for styling with custom design tokens
- Radix UI for accessible component primitives
- Follows Next.js App Router conventions
- No comments in code unless documenting known caveats

### PWA Configuration
- Service worker caching for map tiles and API responses
- Offline-first approach for static assets
- Manifest.json with app icons and theme colors
- OpenStreetMap tile caching for improved performance

### Environment Variables
Required environment variables:
```
# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key

# Cron Jobs (production)
CRON_SECRET=your-cron-secret

# Optional: External APIs
SEATGEEK_CLIENT_ID=your-client-id (for events)
```

### Security Configuration
- Environment variables for reCAPTCHA keys
- Rate limiting with in-memory storage (scalable to Redis)
- Input sanitization and validation
- HTTPS support for development testing

### API Integration
- OpenStreetMap Nominatim for geocoding
- OSRM for route calculation and distances
- Custom pricing algorithms for fare estimation
- Comprehensive error handling and validation

## Important Files

### Core Application
- `app/page.tsx` - Main landing page
- `app/layout.tsx` - Root layout with PWA metadata
- `app/providers.tsx` - Client providers (Auth, etc.)
- `app/dashboard/page.tsx` - Analytics dashboard
- `app/api/compare-rides/route.ts` - Main API endpoint

### Services
- `lib/services/ride-comparison.ts` - Ride comparison business logic

### Pricing Logic
- `lib/pricing.ts` - Core pricing calculations with `pricingEngine`
- `lib/pricing-config.json` - Service pricing configuration
- `lib/constants.ts` - API and pricing configuration constants
- `lib/airports.ts` - Airport detection and fees

### Database
- `prisma/schema.prisma` - Prisma database schema
- `lib/supabase.ts` - Supabase client and helper functions
- `types/supabase.ts` - Supabase TypeScript types
- `supabase/schema.sql` - Supabase SQL schema

### Authentication
- `lib/auth-context.tsx` - Auth provider and useAuth hook
- `app/auth/callback/route.ts` - Auth callback handler

### Security
- `lib/rate-limiter.ts` - Rate limiting implementation
- `lib/validation.ts` - Input validation and sanitization
- `lib/recaptcha.ts` - reCAPTCHA integration
- `lib/hooks/use-recaptcha.ts` - reCAPTCHA React hook

### ETL
- `lib/etl/weather-cron.ts` - Weather data collection
- `app/api/cron/weather/route.ts` - Weather cron endpoint
- `app/api/cron/events/route.ts` - Events cron endpoint

### Configuration
- `next.config.mjs` - Next.js configuration with PWA setup
- `tailwind.config.ts` - Tailwind CSS configuration
- `jest.config.js` - Jest testing configuration
- `vercel.json` - Vercel deployment configuration

## Notes for Future Development

### Build Configuration
- Next.js config temporarily ignores TypeScript and ESLint errors during builds
- This is set for development focus - should be removed before production deployment
- PWA configuration includes caching strategies for external APIs

### Mock Mode
- Supabase runs in mock mode when credentials are not configured
- Mock mode logs operations to console instead of persisting
- Check `isSupabaseMockMode` flag for conditional logic

### Quality Assurance
- Always run `npm run quality` before committing changes
- Use `npm run typecheck` to verify TypeScript compliance
- Test new features with both unit and integration tests
- Security measures should be tested with various input scenarios
- Run `npm run db:generate` after schema changes
