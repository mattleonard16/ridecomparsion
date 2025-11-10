# Verification Guide - ChunkError Fix & Route Navigation

## Quick Test Steps

### 1. Open the Application

- Navigate to: `http://localhost:3000` (or `http://localhost:3001` if port 3000 is in use)
- Open DevTools Console (F12 or Cmd+Option+I)
- Open Network tab in DevTools

### 2. Test Prefetch (Hover)

**Action:** Hover over any "Popular Bay Area Routes" button (e.g., "SFO → Downtown SF")

**Expected:**

- ✅ Network tab shows: `GET /api/compare-rides?pickup=...&destination=...`
- ✅ Request completes in 2-4s (first time) or <100ms (if cached)
- ✅ No errors in Console
- ✅ No ChunkLoadError

### 3. Test Route Click & Auto-Navigation

**Action:** Click the route button you just hovered

**Expected Console Logs (in order):**

```
[RouteClick] San Francisco International Airport (SFO), San Francisco, CA, USA → Downtown San Francisco, San Francisco, CA, USA
[State] selectedRoute updated: {pickup: "...", destination: "..."}
[Scroll] to compare section
[AutoSubmit] detected {pickup: "...", destination: "..."}
[AutoSubmit] Starting fetch...
```

**Expected Behavior:**

- ✅ Page smoothly scrolls to "Compare Prices Now" section (within 50ms)
- ✅ Form inputs auto-fill with route addresses
- ✅ Loading spinner appears on the route button
- ✅ Loading state shows "Finding rides..." in form

### 4. Test Results Display

**Expected Console Logs (continued):**

```
[AutoSubmit] Success, displaying results
```

**Expected Behavior:**

- ✅ Results display within 2-4s (uncached) or instantly (cached/prefetched)
- ✅ Price comparison cards show for Uber, Lyft, Taxi
- ✅ Map displays with route visualization
- ✅ Smart recommendation appears with insights
- ✅ No errors in Console

### 5. Test Multiple Routes

**Action:** Click different route buttons sequentially

**Expected:**

- ✅ Each click triggers the same log flow
- ✅ Subsequent clicks are faster (cache hits)
- ✅ Network tab shows cache indicators: `200 (from disk cache)` or fast response times (<100ms)

## Expected Server Logs

When you click a route, check your terminal for server logs:

### First Request (Uncached)

```
[CompareAPI GET] Request received
[CompareAPI GET] Params: { pickup: 'SFO', destination: 'Downtown SF' }
[CompareAPI GET] Calling compareRidesByAddresses
[CompareAPI] Starting comparison for SFO → Downtown SF
[CompareAPI] Route metrics fetched in 599ms
[CompareAPI] Uber: 1ms
[CompareAPI] Lyft: 0ms
[CompareAPI] Taxi: 0ms
[CompareAPI] All pricing calculations: 1ms
[CompareAPI] compareRidesByCoordinates total: 602ms
[CompareAPI] Total time: 1465ms
[CompareAPI GET] Success, returning data
GET /api/compare-rides?pickup=SFO&destination=Downtown%20SF 200 in 2129ms
```

### Cached Request

```
[CompareAPI GET] Request received
[CompareAPI GET] Params: { pickup: 'SFO', destination: 'Downtown SF' }
[CompareAPI GET] Calling compareRidesByAddresses
[CompareAPI] Cache hit for sfo-downtown sf - 0ms
[CompareAPI GET] Success, returning data
GET /api/compare-rides?pickup=SFO&destination=Downtown%20SF 200 in 6ms
```

## Performance Benchmarks

| Metric                   | Target | Expected Result             |
| ------------------------ | ------ | --------------------------- |
| First request (uncached) | 2-4s   | ✅ ~2.1s                    |
| Cached request           | <100ms | ✅ ~6ms                     |
| Prefetch (hover)         | <100ms | ✅ ~6ms (if already cached) |
| Scroll to section        | <100ms | ✅ ~50ms                    |
| Total click-to-results   | <500ms | ✅ ~250ms (cached)          |

## Troubleshooting

### Issue: ChunkLoadError still appears

**Solution:**

1. Stop the dev server (Ctrl+C)
2. Run: `rm -rf .next node_modules/.cache`
3. Restart: `npm run dev`
4. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Route click doesn't scroll

**Check:**

- Console shows `[Scroll] compare-section not found!` → Report this error
- Console shows `[RouteClick]` but no `[Scroll]` → Timing issue, report this

### Issue: No auto-submit after scroll

**Check:**

- Console shows `[Scroll]` but no `[AutoSubmit]` → State not updating, report this
- Console shows `[AutoSubmit] detected` but no `[AutoSubmit] Starting fetch...` → Check for errors before fetch

### Issue: Results don't display

**Check:**

- Console shows `[AutoSubmit] Error response:` → Check error details in console
- Console shows `[AutoSubmit] Fetch error:` → Network issue or API error
- Server logs show 500 error → Check server logs for details

### Issue: Slow response times

**Check:**

- Network tab shows request pending for >5s → Not using cache, check cache key
- Server logs show no `[CompareAPI] Cache hit` message → Cache not working
- Server logs show long route metrics fetch time → OSRM API slow, normal behavior

## Success Criteria

✅ **No ChunkLoadError** - Page loads without runtime errors  
✅ **Logs flow in order** - All expected console logs appear in sequence  
✅ **Instant navigation** - Click → Scroll → Results in <500ms (cached)  
✅ **Cache working** - Second request for same route is instant (<100ms)  
✅ **Prefetch working** - Hover triggers background GET request  
✅ **Results display** - Comparison cards, map, and insights all render correctly

## Additional Notes

### Cache Behavior

- **Cache duration**: 45 seconds
- **Cache key**: Normalized pickup and destination addresses (lowercase)
- **Cache scope**: In-memory (per server instance)
- **Cache invalidation**: Automatic after 45s TTL

### Scroll Behavior

- **Trigger**: 50ms after route selection
- **Behavior**: Smooth scroll to `#compare-section`
- **Snap**: Scroll snap type is `proximity` (not strict)
- **Offset**: `scroll-mt-20` applied to prevent header overlap

### Auto-Submit Timing

- **Trigger**: Immediately when `selectedRoute` state changes
- **reCAPTCHA**: Executes in parallel (non-blocking)
- **Form submission**: 200ms delay to allow UI update
- **Results display**: Immediate on success (no artificial delay)

## Developer Notes

### Debug Logs Prefix Convention

- `[RouteClick]` - User interaction events
- `[State]` - React state changes
- `[Scroll]` - DOM scroll operations
- `[AutoSubmit]` - Automatic form submission flow
- `[CompareAPI]` - Server-side API operations
- `[CompareAPI GET]` - Prefetch/GET requests
- `[CompareAPI POST]` - Form submission/POST requests

### Performance Monitoring

All timing logs use `Date.now()` for millisecond precision. Monitor these in production to identify bottlenecks:

- Route metrics fetch (OSRM API call)
- Individual pricing calculations (should be <1ms each)
- Total comparison time (geocoding + routing + pricing)
- API response time (end-to-end)
