import { enhanceWithAI } from '@/lib/services/ai-insights'
import type { AIRecommendation } from '@/types'

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '1. Save $12 by riding at 2 PM instead.\n2. Switch to Lyft for this route to save 15% on average.\n3. Surge pricing typically drops after 8 PM.',
          },
        ],
      }),
    },
  }))
})

const sampleRecommendations: AIRecommendation[] = [
  {
    type: 'DEPARTURE_TIME',
    title: 'Better Time to Ride',
    message: 'Prices drop ~$12 at 2 PM (48% cheaper than now)',
    confidence: 0.85,
    dataPoints: {
      potentialSavings: 12,
      bestHour: 14,
      currentPrice: 25,
      bestPrice: 13,
    },
  },
  {
    type: 'SERVICE_CHOICE',
    title: 'Best Service for This Route',
    message: 'Lyft is 15% cheaper for this route',
    confidence: 0.8,
    dataPoints: {
      bestService: 'lyft',
      potentialSavings: 3.5,
      bestPrice: 18.5,
    },
  },
  {
    type: 'SURGE_FORECAST',
    title: 'Surge Likely to End Soon',
    message: 'Surge typically ends by 8 PM',
    confidence: 0.7,
    dataPoints: {
      surgeEndEstimate: '8 PM',
      bestHour: 20,
    },
  },
]

describe('AI Insights Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns original messages when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const result = await enhanceWithAI(sampleRecommendations)

    expect(result).toHaveLength(3)
    // Should use template fallbacks, not original messages
    expect(result[0].type).toBe('DEPARTURE_TIME')
    expect(result[1].type).toBe('SERVICE_CHOICE')
    expect(result[2].type).toBe('SURGE_FORECAST')
  })

  it('returns template-enhanced messages when API key is set but SDK is mocked', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'

    const result = await enhanceWithAI(sampleRecommendations)

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('DEPARTURE_TIME')
    // Template fallback should include price and time info
    expect(result[0].message).toContain('2 PM')
    expect(result[0].message).toContain('$12')
  })

  it('returns empty array for empty input', async () => {
    const result = await enhanceWithAI([])
    expect(result).toEqual([])
  })

  it('preserves recommendation structure', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'

    const result = await enhanceWithAI(sampleRecommendations)

    for (const rec of result) {
      expect(rec).toHaveProperty('type')
      expect(rec).toHaveProperty('title')
      expect(rec).toHaveProperty('message')
      expect(rec).toHaveProperty('confidence')
      expect(rec).toHaveProperty('dataPoints')
    }
  })

  it('uses template fallbacks when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const recs: AIRecommendation[] = [
      {
        type: 'DEPARTURE_TIME',
        title: 'Test',
        message: 'Original message',
        confidence: 0.8,
        dataPoints: { potentialSavings: 5, bestHour: 14 },
      },
    ]

    const result = await enhanceWithAI(recs)

    expect(result[0].message).toContain('cheaper')
    expect(result[0].message).toContain('2 PM')
  })

  it('generates appropriate templates for each recommendation type', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const allTypes: AIRecommendation[] = [
      {
        type: 'DEPARTURE_TIME',
        title: 'Time',
        message: '',
        confidence: 0.8,
        dataPoints: { potentialSavings: 8, bestHour: 14 },
      },
      {
        type: 'SERVICE_CHOICE',
        title: 'Service',
        message: '',
        confidence: 0.8,
        dataPoints: { bestService: 'lyft', potentialSavings: 3 },
      },
      {
        type: 'SURGE_FORECAST',
        title: 'Surge',
        message: '',
        confidence: 0.7,
        dataPoints: { surgeEndEstimate: '8 PM' },
      },
      {
        type: 'SAVINGS_INSIGHT',
        title: 'Savings',
        message: 'You saved $47',
        confidence: 0.95,
        dataPoints: { potentialSavings: 47 },
      },
    ]

    const result = await enhanceWithAI(allTypes)

    expect(result[0].message).toContain('2 PM')
    expect(result[1].message).toContain('Lyft')
    expect(result[2].message).toContain('8 PM')
    expect(result[3].message).toContain('$47')
  })
})
