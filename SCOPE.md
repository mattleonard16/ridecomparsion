# Rideshare App Improvement Scope

## Current State (Day 0)

### Pricing System Architecture

- **3 pricing files** with overlapping functionality (1,163 lines total)
- **pricing-config.json** contains structured rate data
- Using simulated prices with base calculations + randomness
- No historical data storage
- No real-time external data integration

### Current Features

✅ Distance/time-based pricing
✅ Time-of-day surge patterns
✅ Airport/CBD surcharges
✅ Service comparison (Uber/Lyft/Taxi)
✅ Route visualization with map
✅ Address autocomplete

### Missing Critical Features

❌ Real pricing data from Uber/Lyft APIs
❌ Historical price tracking
❌ User accounts/saved routes
❌ Price predictions
❌ Weather-based surge
❌ Event-based surge
❌ Deep linking to book rides

## Target Scope

### Phase 1: Data Foundation (Week 1)

**Goal**: Enable data persistence and user features

1. **Database Setup (Supabase)**
   - Routes table (pickup, destination, distance, duration)
   - Price snapshots (timestamp, service, price, surge)
   - Users table (auth, preferences)
   - Alerts table (route, target price, notification)

2. **Authentication**
   - Supabase Auth integration
   - Anonymous user support
   - Save searches without account

3. **External Data Sources**
   - Weather API integration
   - Events calendar API
   - Traffic data API
   - Store in database for analysis

### Phase 2: Realistic Pricing (Week 2)

**Goal**: Replace random prices with intelligent estimates

1. **Consolidate Pricing Files**
   - Merge into single `pricing-engine.ts`
   - Clear separation: base rates, surge, modifiers
   - Unit tests for all calculations

2. **Enhanced Calculation Factors**
   - Real-time weather impact
   - Event detection (concerts, sports)
   - Historical patterns by route
   - Day of week patterns
   - Seasonal adjustments

3. **Machine Learning Prep**
   - Log all searches with actual times
   - Store user feedback on accuracy
   - Build training dataset

### Phase 3: User Features (Week 3)

**Goal**: Add value through personalization

1. **Core Features**
   - Save favorite routes
   - Price alerts
   - Commute tracking
   - Share routes

2. **Deep Linking**
   - Uber app integration
   - Lyft app integration
   - Pass pickup/destination
   - Track conversion

3. **Analytics Dashboard**
   - Popular routes heat map
   - Price trends by hour
   - Surge prediction accuracy

## Technical Decisions

### Platform Support

- **Primary**: Web (current)
- **Future**: iOS/Android (React Native or PWA)

### APIs Required

- ✅ OpenStreetMap Nominatim (geocoding)
- ✅ OSRM (routing)
- ⏳ OpenWeather API (weather data)
- ⏳ Ticketmaster/SeatGeek (events)
- ⏳ Google Traffic API or MapBox (traffic)

### Data Architecture

```
Supabase PostgreSQL
├── routes (master data)
├── price_snapshots (time series)
├── users (auth + prefs)
├── alerts (notifications)
├── weather_logs (external data)
├── event_logs (external data)
└── search_logs (analytics)
```

### Pricing Engine Consolidation Plan

```
New: pricing-engine.ts
├── Base calculations (from pricing-config.json)
├── Surge algorithms (from pricing-enhanced.ts)
├── External factors (weather, events, traffic)
└── ML predictions (future)

Remove:
- pricing.ts
- pricing-enhanced.ts
- pricing-final.ts (after migration)
```

## Success Metrics

### Week 1 Goals

- [ ] Database operational
- [ ] User auth working
- [ ] Routes being saved
- [ ] Weather data logging

### Week 2 Goals

- [ ] Single pricing engine deployed
- [ ] < 5% variance from real Uber/Lyft prices
- [ ] External data affecting prices
- [ ] Historical patterns visible

### Week 3 Goals

- [ ] 100+ saved routes
- [ ] 10+ active price alerts
- [ ] Deep linking working
- [ ] User feedback collected

## Risks & Mitigation

### Risk: API Rate Limits

- **Mitigation**: Aggressive caching, batch requests

### Risk: Pricing Accuracy

- **Mitigation**: A/B test with real prices, collect feedback

### Risk: Supabase Costs

- **Mitigation**: Start with free tier, monitor usage

### Risk: Deep Link Rejection

- **Mitigation**: Web fallback, show prices anyway
