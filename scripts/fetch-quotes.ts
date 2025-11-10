import fetch from 'node-fetch'
import pRetry from 'p-retry'
import { z } from 'zod'

/**
 * This script fetches live rideshare quotes from configured providers
 * and prints normalized results so they can be piped into the local
 * database. Intended for experimentation until official integrations
 * are wired into the API route.
 */

const Providers = z.array(
  z.object({
    name: z.string(),
    endpoint: z.string().url(),
    apiKeyEnv: z.string().optional(),
  })
)

type ProviderConfig = z.infer<typeof Providers>[number]

interface QuoteResponse {
  service: string
  price: number
  currency: string
  etaMinutes?: number
  surgeMultiplier?: number
}

async function fetchQuotesForRoute(provider: ProviderConfig, route: { from: string; to: string }) {
  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : undefined

  const url = new URL(provider.endpoint)
  url.searchParams.set('pickup', route.from)
  url.searchParams.set('destination', route.to)

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error(`${provider.name} responded with status ${response.status}`)
  }

  const payload = (await response.json()) as QuoteResponse[]

  return payload.map(quote => ({
    provider: provider.name,
    service: quote.service,
    price: quote.price,
    currency: quote.currency,
    etaMinutes: quote.etaMinutes,
    surgeMultiplier: quote.surgeMultiplier ?? 1,
  }))
}

async function main() {
  const configPath = process.argv[2] || 'quotes.providers.json'
  const routesPath = process.argv[3] || 'quotes.routes.json'

  const providersRaw = await import(`${process.cwd()}/${configPath}`)
  const routesRaw = await import(`${process.cwd()}/${routesPath}`)

  const providers = Providers.parse(providersRaw.default || providersRaw)
  const routes = z
    .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
    .parse(routesRaw.default || routesRaw)

  const results: Array<ReturnType<typeof fetchQuotesForRoute>> = []

  for (const route of routes) {
    for (const provider of providers) {
      const quotePromise = pRetry(() => fetchQuotesForRoute(provider, route), {
        retries: 2,
        onFailedAttempt: (error: any) => {
          console.warn(
            `Retrying ${provider.name} for ${route.from} → ${route.to} (${error.attemptNumber}/${error.retriesLeft})`
          )
        },
      })

      results.push(quotePromise)
    }
  }

  const resolved = await Promise.allSettled(results)

  const successful = resolved
    .filter(
      (entry): entry is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchQuotesForRoute>>> =>
        entry.status === 'fulfilled'
    )
    .flatMap(entry => entry.value)

  const failed = resolved.filter(entry => entry.status === 'rejected')

  console.log(JSON.stringify({ successful, failed: failed.length }, null, 2))
}

main().catch(error => {
  console.error('Failed to fetch quotes:', error)
  process.exit(1)
})
