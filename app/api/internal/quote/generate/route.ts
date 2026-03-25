import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { measurements, serviceType, baselines, notes } = await req.json()

  const baselineText = baselines
    .map((b: { label: string; rate: number; unit: string }) => `- ${b.label}: $${b.rate}/${b.unit}`)
    .join('\n')

  const measurementText = Object.entries(measurements)
    .filter(([, v]) => v && Number(v) > 0)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const prompt = `You are a painting contractor estimating assistant. Generate a detailed quote line-item breakdown.

Service type: ${serviceType}

Measurements provided:
${measurementText || '(none)'}

Pricing baseline:
${baselineText}

${notes ? `Additional notes: ${notes}` : ''}

Return ONLY a valid JSON array of line items. No prose, no markdown, no code fences. Each item must have:
{ "label": string, "qty": number, "unit": string, "rate": number, "total": number }

Include separate line items for each component (e.g., walls, ceilings, trim separately). Calculate total = qty * rate.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  let lineItems
  try {
    lineItems = JSON.parse(text.trim())
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw: text }, { status: 500 })
  }

  return NextResponse.json({ lineItems })
}
