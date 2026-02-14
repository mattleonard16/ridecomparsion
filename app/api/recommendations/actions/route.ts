/**
 * Recommendation Actions API
 *
 * Tracks user interactions with AI recommendations.
 * POST /api/recommendations/actions - Record an action (viewed, clicked, followed, dismissed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

const ActionSchema = z.object({
  recommendationId: z.string().min(1),
  action: z.enum(['VIEWED', 'CLICKED', 'FOLLOWED', 'DISMISSED']),
  estimatedSavings: z.number().min(0).optional(),
})

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const session = await auth()
  const userId = session?.user?.id ?? null

  try {
    const body = await request.json()
    const validation = ActionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { recommendationId, action, estimatedSavings } = validation.data

    // Verify recommendation exists
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
    })

    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    // Create the action record
    await prisma.recommendationAction.create({
      data: {
        recommendationId,
        userId,
        action,
        estimatedSavings: estimatedSavings ?? null,
      },
    })

    // Update impression/click counts on the recommendation (non-blocking)
    if (action === 'VIEWED') {
      prisma.recommendation
        .update({
          where: { id: recommendationId },
          data: { impressions: { increment: 1 } },
        })
        .catch(() => {})
    } else if (action === 'CLICKED') {
      prisma.recommendation
        .update({
          where: { id: recommendationId },
          data: { clicks: { increment: 1 } },
        })
        .catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to record action' }, { status: 500 })
  }
}
