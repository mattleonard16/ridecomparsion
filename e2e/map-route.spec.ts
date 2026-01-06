import { test, expect } from '@playwright/test'

// Increase timeout for map loading
test.setTimeout(60000)

// Helper to wait for map route layer to be ready (including paint properties)
async function waitForRouteLayer(page: import('@playwright/test').Page) {
  // Wait for the map container
  await page.waitForSelector('[data-testid="map-container"]', { timeout: 10000 })
  // Wait for map canvas to appear (MapLibre creates this)
  await page.waitForSelector('[data-testid="map-container"] canvas', { timeout: 30000 })
  // Wait for the test helpers to be exposed, route layer to exist, AND paint to be applied
  await page.waitForFunction(
    () => {
      const helpers = (
        window as unknown as {
          __testMapHelpers?: {
            getRouteLayerId: () => string | null
            map: { getPaintProperty: (id: string, p: string) => unknown }
          }
        }
      ).__testMapHelpers
      if (!helpers) return false
      const layerId = helpers.getRouteLayerId()
      if (!layerId) return false
      // Ensure paint property is applied (not undefined) before considering ready
      const dashArray = helpers.map.getPaintProperty(layerId, 'line-dasharray')
      return Array.isArray(dashArray)
    },
    { timeout: 15000 }
  )
}

// Helper to get the route layer ID dynamically
async function getRouteLayerId(page: import('@playwright/test').Page): Promise<string> {
  const layerId = await page.evaluate(() => {
    const helpers = (
      window as unknown as {
        __testMapHelpers?: { getRouteLayerId: () => string | null }
      }
    ).__testMapHelpers
    return helpers?.getRouteLayerId() ?? null
  })
  if (!layerId) throw new Error('Route layer not found')
  return layerId
}

// Helper to get a paint property from the route layer
async function getLayerPaintProperty(
  page: import('@playwright/test').Page,
  property: string
): Promise<unknown> {
  const layerId = await getRouteLayerId(page)
  return page.evaluate(
    ({ layerId, prop }) => {
      const helpers = (
        window as unknown as {
          __testMapHelpers?: { map: { getPaintProperty: (id: string, p: string) => unknown } }
        }
      ).__testMapHelpers
      return helpers?.map.getPaintProperty(layerId, prop)
    },
    { layerId, prop: property }
  )
}

// Helper to find and hover over the route by scanning along its path
async function hoverOnRoute(page: import('@playwright/test').Page) {
  const mapContainer = page.locator('[data-testid="map-container"]')
  const box = await mapContainer.boundingBox()
  if (!box) throw new Error('Map container not found')

  // The route is a horizontal line through the center
  // Scan across the center to find the route
  const y = box.y + box.height / 2
  for (let xOffset = 0.3; xOffset <= 0.7; xOffset += 0.05) {
    const x = box.x + box.width * xOffset
    await page.mouse.move(x, y)
    await page.waitForTimeout(100)
  }
  // Return to center
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

test.describe('MapRoute Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/map-route')
    await waitForRouteLayer(page)
  })

  test('hover triggers onMouseEnter callback when interactive', async ({ page }) => {
    const hoverCount = page.locator('[data-testid="hover-count"]')
    await expect(hoverCount).toHaveText('Hover count: 0')

    // Scan across the route to trigger hover
    await hoverOnRoute(page)

    // Count should have increased
    await expect(hoverCount).not.toHaveText('Hover count: 0', { timeout: 5000 })
  })

  test('hover does NOT trigger callback when interactive=false', async ({ page }) => {
    // Turn off interactive
    await page.click('[data-testid="toggle-interactive"]')
    // Wait for button text to confirm toggle
    await expect(page.locator('[data-testid="toggle-interactive"]')).toContainText('OFF')

    const hoverCount = page.locator('[data-testid="hover-count"]')
    await expect(hoverCount).toHaveText('Hover count: 0')

    // Scan across the route
    await hoverOnRoute(page)

    // Count should still be 0
    await expect(hoverCount).toHaveText('Hover count: 0')
  })

  test('cursor changes to pointer on hover when interactive', async ({ page }) => {
    const mapContainer = page.locator('[data-testid="map-container"]')
    const canvas = mapContainer.locator('canvas')

    // Scan across the route and check if cursor becomes pointer
    const box = await mapContainer.boundingBox()
    if (!box) throw new Error('Map container not found')

    let foundPointer = false
    const y = box.y + box.height / 2
    for (let xOffset = 0.3; xOffset <= 0.7 && !foundPointer; xOffset += 0.05) {
      const x = box.x + box.width * xOffset
      await page.mouse.move(x, y)
      await page.waitForTimeout(100)
      const cursor = await canvas.evaluate(el => getComputedStyle(el).cursor)
      if (cursor === 'pointer') {
        foundPointer = true
      }
    }

    expect(foundPointer).toBe(true)
  })

  test('dashArray toggles correctly and updates MapLibre layer', async ({ page }) => {
    // Verify initial state - solid line (dashArray should be [1, 0] which means solid)
    // Use expect.poll to handle potential race with paint update effect
    await expect
      .poll(async () => getLayerPaintProperty(page, 'line-dasharray'), { timeout: 5000 })
      .toEqual([1, 0])

    // Toggle dash on
    await page.click('[data-testid="toggle-dash"]')
    await expect(page.locator('[data-testid="toggle-dash"]')).toContainText('ON')

    // Verify MapLibre layer now has dashed pattern
    await expect
      .poll(async () => getLayerPaintProperty(page, 'line-dasharray'), { timeout: 5000 })
      .toEqual([10, 10])

    // Toggle dash off
    await page.click('[data-testid="toggle-dash"]')
    await expect(page.locator('[data-testid="toggle-dash"]')).toContainText('OFF')

    // Verify MapLibre layer is back to solid
    await expect
      .poll(async () => getLayerPaintProperty(page, 'line-dasharray'), { timeout: 5000 })
      .toEqual([1, 0])
  })

  test('interactive toggle while hovered resets cursor', async ({ page }) => {
    const mapContainer = page.locator('[data-testid="map-container"]')
    const canvas = mapContainer.locator('canvas')
    const box = await mapContainer.boundingBox()
    if (!box) throw new Error('Map container not found')

    // Scan to find the route and trigger pointer cursor
    let pointerX = box.x + box.width / 2
    const y = box.y + box.height / 2
    for (let xOffset = 0.3; xOffset <= 0.7; xOffset += 0.05) {
      const x = box.x + box.width * xOffset
      await page.mouse.move(x, y)
      await page.waitForTimeout(100)
      const cursor = await canvas.evaluate(el => getComputedStyle(el).cursor)
      if (cursor === 'pointer') {
        pointerX = x
        break
      }
    }

    // Toggle interactive off while hovering
    await page.click('[data-testid="toggle-interactive"]')
    await expect(page.locator('[data-testid="toggle-interactive"]')).toContainText('OFF')

    // Move mouse slightly to trigger cursor update
    await page.mouse.move(pointerX + 1, y)
    await page.waitForTimeout(100)

    // Cursor should no longer be pointer
    const cursor = await canvas.evaluate(el => getComputedStyle(el).cursor)
    expect(cursor).not.toBe('pointer')
  })
})
