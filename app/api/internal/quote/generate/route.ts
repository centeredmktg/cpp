// app/api/internal/quote/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildPricingPrompt } from '@/lib/pricing-prompt'
import type { Market } from '@/lib/pricing-prompt'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const DOCS_DIR = process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

interface FilePayload {
  name: string
  type: string
  data: string // base64
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Support both legacy structured format and new freeform format
  const isLegacy = body.measurements && !body.text && !body.files
  if (isLegacy) {
    return handleLegacy(body)
  }

  const { text, files, serviceType, market } = body as {
    text: string
    files?: FilePayload[]
    serviceType: 'INTERIOR' | 'EXTERIOR'
    market: Market
  }

  if (!text && (!files || files.length === 0)) {
    return NextResponse.json({ error: 'Provide text or files' }, { status: 400 })
  }

  // Save uploaded files to temp storage
  if (files && files.length > 0) {
    const intakeDir = path.join(DOCS_DIR, 'intake')
    mkdirSync(intakeDir, { recursive: true })
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = path.join(intakeDir, `${Date.now()}-${safeName}`)
      writeFileSync(filePath, Buffer.from(file.data, 'base64'))
    }
  }

  // Build the system prompt with pricing rules
  const systemPrompt = buildPricingPrompt(serviceType, market)

  // Build user message content blocks: text + images
  const content: Anthropic.Messages.ContentBlockParam[] = []

  if (text) {
    content.push({ type: 'text', text })
  }

  if (files && files.length > 0) {
    for (const file of files) {
      if (file.type === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file.data },
        } as Anthropic.Messages.ContentBlockParam)
      } else if (file.type.startsWith('image/')) {
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: file.data },
        })
      }
    }
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let lineItems
  try {
    // Strip any markdown code fences if Claude includes them despite instructions
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    lineItems = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse response', raw: responseText }, { status: 500 })
  }

  return NextResponse.json({ lineItems })
}

// Legacy handler for backwards compatibility (structured measurements)
async function handleLegacy(body: {
  measurements: Record<string, string>
  serviceType: string
  baselines: { label: string; rate: number; unit: string }[]
  notes?: string
}) {
  const { measurements, serviceType, baselines, notes } = body

  const baselineText = baselines
    .map(b => `- ${b.label}: $${b.rate}/${b.unit}`)
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
    model: 'claude-sonnet-4-6',
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
