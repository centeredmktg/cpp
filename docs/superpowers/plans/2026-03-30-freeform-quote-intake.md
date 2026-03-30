# Freeform Quote Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace structured measurement inputs with a freeform text + photo dropzone that AI parses into a priced quote — same page, no reload.

**Architecture:** The existing `NewQuotePage` component gains a freeform intake mode for Interior/Exterior service types. A new `IntakeDropzone` component handles text input and file drag-and-drop. The existing `/api/internal/quote/generate` endpoint is reworked to accept freeform text + base64 images, build a pricing-aware system prompt, and call Claude with vision. The epoxy calculator path is untouched. Line items render in the same table that already exists.

**Tech Stack:** Next.js 16, React 19, Anthropic SDK (Claude vision), filesystem storage for temp uploads

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/components/IntakeDropzone.tsx` | Create | Textarea + drag-and-drop file zone + thumbnail strip |
| `lib/pricing-prompt.ts` | Create | Builds the pricing-aware system prompt from the reference data |
| `app/api/internal/quote/generate/route.ts` | Modify | Accept freeform text + files, use vision API, return line items |
| `app/internal/projects/[id]/quote/new/page.tsx` | Modify | Wire IntakeDropzone into Interior/Exterior flow, add market selector |

---

### Task 1: IntakeDropzone Component

**Files:**
- Create: `app/components/IntakeDropzone.tsx`

- [ ] **Step 1: Create the IntakeDropzone component**

```tsx
// app/components/IntakeDropzone.tsx
'use client'

import { useState, useRef, useCallback } from 'react'

interface AttachedFile {
  name: string
  type: string
  data: string // base64
  preview?: string // object URL for image thumbnails
}

interface IntakeDropzoneProps {
  text: string
  onTextChange: (text: string) => void
  files: AttachedFile[]
  onFilesChange: (files: AttachedFile[]) => void
  disabled?: boolean
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB per file (Claude vision limit)

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:...;base64, prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export type { AttachedFile }

export default function IntakeDropzone({ text, onTextChange, files, onFilesChange, disabled }: IntakeDropzoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: AttachedFile[] = []
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      const data = await fileToBase64(file)
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      newFiles.push({ name: file.name, type: file.type, data, preview })
    }
    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles])
    }
  }, [files, onFilesChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    processFiles(e.dataTransfer.files)
  }, [disabled, processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }, [disabled])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const removeFile = useCallback((index: number) => {
    const updated = files.filter((_, i) => i !== index)
    onFilesChange(updated)
  }, [files, onFilesChange])

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea with dropzone overlay */}
      <div
        className="relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <textarea
          value={text}
          onChange={e => onTextChange(e.target.value)}
          disabled={disabled}
          rows={8}
          placeholder="Paste a customer email, type field notes, drop photos of measurements — whatever you've got"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            background: '#1c1c1a',
            border: `1px solid ${dragOver ? '#fff' : '#2a2a28'}`,
            color: '#fff',
            padding: '0.75rem',
            width: '100%',
            resize: 'vertical',
            transition: 'border-color 0.15s',
          }}
        />
        {dragOver && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '2px dashed #fff' }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>
              DROP FILES HERE
            </span>
          </div>
        )}
      </div>

      {/* File picker button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            color: '#888884',
            background: 'transparent',
            border: '1px solid #2a2a28',
            padding: '0.4rem 0.75rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          className="hover:text-white hover:border-white transition-colors"
        >
          + ATTACH PHOTOS / PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        {files.length > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555552' }}>
            {files.length} file{files.length !== 1 ? 's' : ''} attached
          </span>
        )}
      </div>

      {/* Thumbnail strip */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="relative group"
              style={{
                width: '72px', height: '72px',
                background: '#1c1c1a', border: '1px solid #2a2a28',
                overflow: 'hidden', flexShrink: 0,
              }}
            >
              {file.preview ? (
                <img src={file.preview} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#888884' }}>PDF</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  width: '18px', height: '18px',
                  fontSize: '0.6rem', lineHeight: '18px', textAlign: 'center',
                  border: 'none', cursor: 'pointer',
                }}
              >
                x
              </button>
              <div
                className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: 'rgba(0,0,0,0.7)', padding: '2px 4px',
                  fontFamily: 'var(--font-mono)', fontSize: '0.4rem', color: '#888884',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders**

Run: `npx next build 2>&1 | tail -20` (or dev server if running)
Expected: No TypeScript errors for the new component.

- [ ] **Step 3: Commit**

```bash
git add app/components/IntakeDropzone.tsx
git commit -m "feat: add IntakeDropzone component for freeform quote input"
```

---

### Task 2: Pricing Prompt Builder

**Files:**
- Create: `lib/pricing-prompt.ts`

- [ ] **Step 1: Create the pricing prompt builder**

This module builds the system prompt that tells Claude how to price a painting job. It encodes all of Cesar's pricing rules so the AI generates correct rates from freeform input.

```typescript
// lib/pricing-prompt.ts

type Market = 'reno_sparks' | 'arrowcreek' | 'tahoe'

const MARKET_LABELS: Record<Market, string> = {
  reno_sparks: 'Reno / Sparks',
  arrowcreek: 'Arrowcreek',
  tahoe: 'Lake Tahoe',
}

export function buildPricingPrompt(serviceType: 'INTERIOR' | 'EXTERIOR', market: Market): string {
  const marketLabel = MARKET_LABELS[market]
  const isHighMarket = market === 'arrowcreek' || market === 'tahoe'
  const marketNote = isHighMarket
    ? 'This is a premium market — apply 50% increase on ALL rates below.'
    : ''

  return `You are a painting contractor estimating assistant for CPP Painting & Building, based in Northern Nevada.

MARKET: ${marketLabel}
${marketNote}

SERVICE TYPE: ${serviceType}

YOUR JOB:
1. Extract ALL measurements from the text and images provided (sqft, lnft, room counts, window counts, etc.)
2. Identify conditions that affect pricing (furnished, texture type, dark colors, woodwork style, surface condition, etc.)
3. Generate a detailed quote with separate line items for each component
4. Default to the HIGHER end of rate ranges — the crew can always adjust down

PRICING RULES — ${serviceType === 'INTERIOR' ? 'INTERIOR' : 'EXTERIOR'}:
All multipliers are ADDITIVE (not compounding). Base + adder + adder = final rate.
2-coat coverage is standard and included in the base rate.

${serviceType === 'INTERIOR' ? buildInteriorRules(isHighMarket) : buildExteriorRules(isHighMarket)}

QUOTING RULES:
- Whole house sqft unless the input specifies a single room
- No minimum job size
- If 3-coat coverage is mentioned or implied, add $1.00/sqft${isHighMarket ? ' ($1.50/sqft in this market)' : ''}
- Furnished home surcharge applies to TOTAL home sqft, not just painted area
- If you detect measurements from handwritten notes or tape measure photos, include them but note any uncertainty in the label (e.g., "Walls (per field notes)")

OUTPUT FORMAT:
Return ONLY a valid JSON array of line items. No prose, no markdown, no code fences. Each item must have:
{ "label": string, "qty": number, "unit": string, "rate": number, "total": number }

Include separate line items for each component (walls, ceilings, trim, windows, accent walls, etc.).
Calculate total = qty * rate for each line item.
Use descriptive labels that reference the condition/adder when applicable (e.g., "Walls — hand-trowel texture" not just "Walls").`
}

function buildInteriorRules(isHighMarket: boolean): string {
  const m = isHighMarket ? 1.5 : 1

  return `BASE RATES:
- Walls + Ceilings: $${(2.75 * m).toFixed(2)}/sqft (use higher end of $${(2.50 * m).toFixed(2)}–$${(3.00 * m).toFixed(2)} range)
- Standard trim (baseboards, casings): $${(1.00 * m).toFixed(2)}/lnft

CONDITION ADDERS (added to base rate):
- White ceiling + two-tone walls: +$${(0.50 * m).toFixed(2)}/sqft
- Dark color coverage (kilning required): +$${(0.25 * m).toFixed(2)}/sqft
- Old world / smooth hand-trowel texture: +$${(0.50 * m).toFixed(2)}/sqft (orange peel/knockdown is standard, no adder)
- Wall repair (light — putty/bondo/sand): +$${(0.20 * m).toFixed(2)}/sqft (use higher end)
- Wall repair (heavy — drywall replacement): flag as custom scope, do NOT price automatically
- Furnished home: +$${(0.75 * m).toFixed(2)}/sqft on TOTAL home sqft (masking, furniture moving)

TRIM & WOODWORK:
- Crown molding (single level): $${(5.00 * m).toFixed(2)}/lnft
- Craftsman basic woodwork: add +$${(1.00 * m).toFixed(2)}/lnft to trim rate
- Craftsman ornate woodwork: add +$${(1.50 * m).toFixed(2)}/lnft to trim rate
- Wainscot: $${(50.00 * m).toFixed(2)}/lnft (separate line item)
- Window — regular trimmed: $${(150.00 * m).toFixed(2)}/per window (includes windowsills)
- Window — craftsman: $${(200.00 * m).toFixed(2)}/per window (includes windowsills)

SPECIAL:
- Accent wall: $${(3.00 * m).toFixed(2)}/sqft (use mid-high of $${(2.50 * m).toFixed(2)}–$${(3.50 * m).toFixed(2)} range)
- Accent wall difficult pigment (black, red, yellow, blue): add +$${(0.50 * m).toFixed(2)}/sqft
- Cabinet staining: $${(110.00 * m).toFixed(2)}/lnft`
}

function buildExteriorRules(isHighMarket: boolean): string {
  const m = isHighMarket ? 1.5 : 1

  return `BASE RATES:
- Stucco (minimal prep): $${(2.50 * m).toFixed(2)}–$${(3.00 * m).toFixed(2)}/sqft (default to higher end)
- Stucco (needs primer): $${(3.50 * m).toFixed(2)}+/sqft
- Siding (good condition): $${(2.85 * m).toFixed(2)}/sqft
- Siding (needs spot priming): up to $${(3.30 * m).toFixed(2)}/sqft

NOTES:
- If surface type is unclear from input, default to stucco at the higher prep rate
- Include separate line items for different surfaces if the home has mixed materials
- Trim and woodwork rates from interior pricing apply to exterior trim as well`
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit lib/pricing-prompt.ts 2>&1`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pricing-prompt.ts
git commit -m "feat: add pricing prompt builder with Cesar's rate rules"
```

---

### Task 3: Rework the Quote Generate API

**Files:**
- Modify: `app/api/internal/quote/generate/route.ts`

- [ ] **Step 1: Rewrite the generate endpoint to accept freeform input + images**

Replace the entire contents of the file:

```typescript
// app/api/internal/quote/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { buildPricingPrompt } from '@/lib/pricing-prompt'
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
    market: 'reno_sparks' | 'arrowcreek' | 'tahoe'
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

  const message = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit app/api/internal/quote/generate/route.ts 2>&1`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/internal/quote/generate/route.ts
git commit -m "feat: rework quote generate API for freeform text + image input"
```

---

### Task 4: Wire Freeform Intake into the New Quote Page

**Files:**
- Modify: `app/internal/projects/[id]/quote/new/page.tsx`

- [ ] **Step 1: Replace the Interior/Exterior structured fields with IntakeDropzone and add market selector**

The key changes to the existing page:
1. Import `IntakeDropzone` and its `AttachedFile` type
2. Add state for `intakeText`, `intakeFiles`, and `market`
3. Replace the structured measurement fields (Interior walls/ceiling/trim, Exterior sqft) with the IntakeDropzone
4. Add a market selector dropdown
5. Update `handleGenerate` to send the freeform payload for Interior/Exterior
6. Add a "Start Over" button and photo reliability notice
7. Keep the epoxy path completely unchanged

Replace the full file contents:

```tsx
// app/internal/projects/[id]/quote/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import IntakeDropzone, { type AttachedFile } from '@/app/components/IntakeDropzone'

interface Baseline { key: string; label: string; rate: number; unit: string }
interface LineItem { label: string; qty: number; unit: string; rate: number; total: number }
interface EpoxyRate { id: string; jobType: string; systemLevel: string; rate: number }

// Fallback constants — used until DB rates load
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  Warehouse:   { Standard: 7.5, Premium: 8.5,  Elite: 9.5  },
  Retail:      { Standard: 8.0, Premium: 9.0,  Elite: 10.0 },
  Residential: { Standard: 9.0, Premium: 10.5, Elite: 12.0 },
}

type JobType = 'Warehouse' | 'Retail' | 'Residential'
type SystemLevel = 'Standard' | 'Premium' | 'Elite'
type Market = 'reno_sparks' | 'arrowcreek' | 'tahoe'

const DEFAULT_PROFIT: Record<JobType, number> = {
  Warehouse: 10,
  Retail: 10,
  Residential: 12,
}

function calculateEpoxy(
  inputs: {
    jobType: JobType; systemLevel: SystemLevel; sqft: number
    glueLevel: number; repairPct: number; moisturePct: number
    broadcast: boolean; topcoat: boolean; surfacePatching: boolean
    overheadPct: number; profitPct: number
  },
  rateLibrary: Record<string, Record<string, number>>,
  addonRates: Record<string, number>,
) {
  const { jobType, systemLevel, sqft, glueLevel, repairPct, moisturePct, broadcast, topcoat, surfacePatching, overheadPct, profitPct } = inputs
  const baseRate = rateLibrary[jobType]?.[systemLevel] ?? FALLBACK_RATES[jobType]?.[systemLevel] ?? 8.5
  const items: LineItem[] = []

  items.push({ label: `${jobType} ${systemLevel} Epoxy Floor System`, qty: sqft, unit: 'SF', rate: baseRate, total: sqft * baseRate })

  const r = (key: string, fallback: number) => addonRates[key] ?? fallback

  if (glueLevel > 0) {
    const rate = glueLevel * r('epoxy_glue_per_level', 0.60)
    items.push({ label: `Glue Removal (Level ${glueLevel})`, qty: sqft, unit: 'SF', rate, total: sqft * rate })
  }
  if (repairPct > 0) {
    const repairedSF = sqft * (repairPct / 100)
    const rate = r('epoxy_crack_repair', 1.50)
    items.push({ label: 'Crack & Joint Repair', qty: Math.round(repairedSF), unit: 'SF', rate, total: repairedSF * rate })
  }
  if (moisturePct > 0) {
    const treatedSF = sqft * (moisturePct / 100)
    const rate = r('epoxy_moisture', 2.25)
    items.push({ label: 'Moisture Mitigation Treatment', qty: Math.round(treatedSF), unit: 'SF', rate, total: treatedSF * rate })
  }
  if (surfacePatching) {
    const rate = r('epoxy_surface_patching', 0.35)
    items.push({ label: 'Surface Patching Allowance', qty: sqft, unit: 'SF', rate, total: sqft * rate })
  }
  if (broadcast) {
    const rate = r('epoxy_broadcast', 0.85)
    items.push({ label: 'Broadcast Texture Media', qty: sqft, unit: 'SF', rate, total: sqft * rate })
  }
  if (topcoat) {
    const rate = r('epoxy_topcoat', 0.95)
    items.push({ label: 'Premium Topcoat (Polyaspartic)', qty: sqft, unit: 'SF', rate, total: sqft * rate })
  }

  const sellPrice = items.reduce((s, l) => s + l.total, 0)
  const divisor = 1 + overheadPct / 100 + profitPct / 100
  const directCost = sellPrice / divisor

  return {
    lineItems: items,
    sellPrice,
    directCost,
    overhead: directCost * (overheadPct / 100),
    profit: directCost * (profitPct / 100),
  }
}

const inputStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  background: '#1c1c1a',
  border: '1px solid #2a2a28',
  color: '#fff',
  padding: '0.5rem 0.75rem',
  width: '100%',
} as const

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  color: '#888884',
  letterSpacing: '0.12em',
  display: 'block',
  marginBottom: '0.4rem',
} as const

export default function NewQuotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [serviceType, setServiceType] = useState<'INTERIOR' | 'EXTERIOR' | 'EPOXY'>('INTERIOR')
  const [baselines, setBaselines] = useState<Baseline[]>([])
  const [epoxyRates, setEpoxyRates] = useState<EpoxyRate[]>([])

  // Freeform intake state
  const [intakeText, setIntakeText] = useState('')
  const [intakeFiles, setIntakeFiles] = useState<AttachedFile[]>([])
  const [market, setMarket] = useState<Market>('reno_sparks')

  const [epoxyInputs, setEpoxyInputs] = useState({
    jobType: 'Warehouse' as JobType,
    systemLevel: 'Premium' as SystemLevel,
    sqft: '',
    glueLevel: '0',
    repairPct: '0',
    moisturePct: '0',
    broadcast: true,
    topcoat: true,
    surfacePatching: true,
    overheadPct: '8',
    profitPct: '10',
  })
  const [epoxyBreakdown, setEpoxyBreakdown] = useState<{
    sellPrice: number; directCost: number; overhead: number; profit: number
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('50% deposit due before work begins. Balance due upon completion.')
  const [exclusions, setExclusions] = useState('')
  const [loading, setLoading] = useState(false)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [error, setError] = useState('')
  const [hadPhotos, setHadPhotos] = useState(false)

  useEffect(() => {
    fetch('/api/internal/pricing').then(r => r.json()).then(setBaselines)
    fetch('/api/internal/epoxy-rates').then(r => r.json()).then(setEpoxyRates)
  }, [])

  function setEpoxy<K extends keyof typeof epoxyInputs>(key: K, value: typeof epoxyInputs[K]) {
    setEpoxyInputs(prev => ({ ...prev, [key]: value }))
  }

  function handleJobTypeChange(jobType: JobType) {
    setEpoxyInputs(prev => ({ ...prev, jobType, profitPct: String(DEFAULT_PROFIT[jobType]) }))
  }

  function handleStartOver() {
    setLineItems([])
    setEpoxyBreakdown(null)
    setError('')
    setHadPhotos(false)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLineItems([])
    setEpoxyBreakdown(null)

    if (serviceType === 'EPOXY') {
      const sqft = parseFloat(epoxyInputs.sqft)
      if (!sqft || sqft <= 0) { setError('Enter a valid square footage.'); return }
      const rateLibrary: Record<string, Record<string, number>> = {}
      for (const r of epoxyRates) {
        if (!rateLibrary[r.jobType]) rateLibrary[r.jobType] = {}
        rateLibrary[r.jobType][r.systemLevel] = r.rate
      }
      const addonRates: Record<string, number> = {}
      for (const b of baselines) {
        if (b.key.startsWith('epoxy_')) addonRates[b.key] = b.rate
      }

      const result = calculateEpoxy(
        {
          jobType: epoxyInputs.jobType,
          systemLevel: epoxyInputs.systemLevel,
          sqft,
          glueLevel: parseInt(epoxyInputs.glueLevel),
          repairPct: parseFloat(epoxyInputs.repairPct) || 0,
          moisturePct: parseFloat(epoxyInputs.moisturePct) || 0,
          broadcast: epoxyInputs.broadcast,
          topcoat: epoxyInputs.topcoat,
          surfacePatching: epoxyInputs.surfacePatching,
          overheadPct: parseFloat(epoxyInputs.overheadPct) || 8,
          profitPct: parseFloat(epoxyInputs.profitPct) || 10,
        },
        rateLibrary,
        addonRates,
      )
      setLineItems(result.lineItems)
      setEpoxyBreakdown({ sellPrice: result.sellPrice, directCost: result.directCost, overhead: result.overhead, profit: result.profit })
      return
    }

    // Freeform intake for Interior/Exterior
    if (!intakeText && intakeFiles.length === 0) {
      setError('Add some text or photos to generate a quote.')
      return
    }

    setLoading(true)
    setHadPhotos(intakeFiles.length > 0)

    try {
      const res = await fetch('/api/internal/quote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: intakeText,
          files: intakeFiles.map(f => ({ name: f.name, type: f.type, data: f.data })),
          serviceType,
          market,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setLineItems(data.lineItems)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!lineItems.length) return
    setLoading(true)
    try {
      const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
      const res = await fetch('/api/internal/quote/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          lineItems,
          subtotal,
          total: subtotal,
          notes,
          paymentTerms,
          exclusions: exclusions || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      router.push(`/internal/quotes/${data.quoteId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
  const isPainting = serviceType === 'INTERIOR' || serviceType === 'EXTERIOR'

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
            className="hover:text-white mb-4 block"
          >
            &larr; Back
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '0.03em' }}>
            New Quote
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: form */}
          <form onSubmit={handleGenerate} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>SERVICE TYPE</label>
                <select
                  value={serviceType}
                  onChange={e => { setServiceType(e.target.value as any); setLineItems([]); setEpoxyBreakdown(null); setHadPhotos(false) }}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="INTERIOR">Interior Painting</option>
                  <option value="EXTERIOR">Exterior Painting</option>
                  <option value="EPOXY">Epoxy Floors</option>
                </select>
              </div>

              {isPainting && (
                <div>
                  <label style={labelStyle}>MARKET</label>
                  <select
                    value={market}
                    onChange={e => setMarket(e.target.value as Market)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="reno_sparks">Reno / Sparks</option>
                    <option value="arrowcreek">Arrowcreek</option>
                    <option value="tahoe">Lake Tahoe</option>
                  </select>
                </div>
              )}
            </div>

            {/* Freeform intake for painting */}
            {isPainting && (
              <IntakeDropzone
                text={intakeText}
                onTextChange={setIntakeText}
                files={intakeFiles}
                onFilesChange={setIntakeFiles}
                disabled={loading}
              />
            )}

            {/* Epoxy inputs — unchanged */}
            {serviceType === 'EPOXY' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>JOB TYPE</label>
                    <select value={epoxyInputs.jobType} onChange={e => handleJobTypeChange(e.target.value as JobType)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Retail">Retail</option>
                      <option value="Residential">Residential</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>SYSTEM LEVEL</label>
                    <select value={epoxyInputs.systemLevel} onChange={e => setEpoxy('systemLevel', e.target.value as SystemLevel)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                      <option value="Elite">Elite</option>
                    </select>
                  </div>
                </div>

                <Field label="TOTAL SQ FT" value={epoxyInputs.sqft} onChange={v => setEpoxy('sqft', v)} />

                <div>
                  <label style={labelStyle}>GLUE REMOVAL LEVEL (0-3)</label>
                  <select value={epoxyInputs.glueLevel} onChange={e => setEpoxy('glueLevel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="0">0 - None</option>
                    <option value="1">1 - Light</option>
                    <option value="2">2 - Moderate</option>
                    <option value="3">3 - Heavy</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="REPAIR AREA %" value={epoxyInputs.repairPct} onChange={v => setEpoxy('repairPct', v)} />
                  <Field label="MOISTURE MITIGATION %" value={epoxyInputs.moisturePct} onChange={v => setEpoxy('moisturePct', v)} />
                </div>

                <div>
                  <label style={labelStyle}>ADD-ONS</label>
                  <div className="flex flex-col gap-2">
                    {([
                      ['broadcast', 'Broadcast Texture ($0.85/SF)'],
                      ['topcoat', 'Premium Topcoat ($0.95/SF)'],
                      ['surfacePatching', 'Surface Patching ($0.35/SF)'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff' }}>
                        <input
                          type="checkbox"
                          checked={epoxyInputs[key]}
                          onChange={e => setEpoxy(key, e.target.checked)}
                          style={{ accentColor: '#fff', width: '14px', height: '14px' }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="OVERHEAD %" value={epoxyInputs.overheadPct} onChange={v => setEpoxy('overheadPct', v)} />
                  <Field label="TARGET PROFIT %" value={epoxyInputs.profitPct} onChange={v => setEpoxy('profitPct', v)} />
                </div>
              </>
            )}

            <div>
              <label style={labelStyle}>PAYMENT TERMS</label>
              <textarea
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>EXCLUSIONS (OPTIONAL)</label>
              <textarea
                value={exclusions}
                onChange={e => setExclusions(e.target.value)}
                rows={2}
                placeholder="Work or materials not included in this quote"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em', background: '#fff', color: '#000', padding: '0.75rem 1.5rem' }}
              className="hover:bg-zinc-200 transition-colors disabled:opacity-50 self-start uppercase"
            >
              {serviceType === 'EPOXY'
                ? 'Calculate Quote'
                : loading
                  ? 'Generating...'
                  : 'Generate Quote'}
            </button>

            {error && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#f87171' }}>{error}</p>
            )}
          </form>

          {/* Right: reference panel */}
          <div>
            {serviceType === 'EPOXY' ? (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '1rem' }}>
                  RATES LIBRARY
                </p>
                <div style={{ border: '1px solid #2a2a28' }}>
                  <div className="flex px-3 py-2" style={{ borderBottom: '1px solid #2a2a28', background: '#1c1c1a' }}>
                    {['', 'STANDARD', 'PREMIUM', 'ELITE'].map(h => (
                      <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.1em', flex: 1 }}>{h}</span>
                    ))}
                  </div>
                  {(['Warehouse', 'Retail', 'Residential'] as JobType[]).map(type => {
                    const rates = epoxyRates.filter(r => r.jobType === type)
                    const rateFor = (level: string) => rates.find(r => r.systemLevel === level)?.rate ?? FALLBACK_RATES[type]?.[level]
                    return (
                    <div key={type} className="flex items-center px-3 py-3" style={{ borderBottom: '1px solid #1c1c1a', background: epoxyInputs.jobType === type ? '#1c1c1a' : 'transparent' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: epoxyInputs.jobType === type ? '#fff' : '#888884', flex: 1 }}>{type}</span>
                      {(['Standard', 'Premium', 'Elite'] as SystemLevel[]).map(level => (
                        <span key={level} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: epoxyInputs.jobType === type && epoxyInputs.systemLevel === level ? '#fff' : '#555552', flex: 1, fontWeight: epoxyInputs.jobType === type && epoxyInputs.systemLevel === level ? 600 : 400 }}>
                          ${(rateFor(level) ?? 0).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  )})}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '1rem' }}>
                  PRICING QUICK REFERENCE
                </p>
                <div style={{ border: '1px solid #2a2a28' }}>
                  <div className="p-3" style={{ borderBottom: '1px solid #2a2a28' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555552', letterSpacing: '0.1em' }}>MARKET</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', marginTop: '4px' }}>
                      {market === 'reno_sparks' ? 'Reno / Sparks' : market === 'arrowcreek' ? 'Arrowcreek (+50%)' : 'Lake Tahoe (+50%)'}
                    </p>
                  </div>
                  {[
                    ['Walls + Ceiling', market === 'reno_sparks' ? '$2.50–$3.00/sqft' : '$3.75–$4.50/sqft'],
                    ['Trim', market === 'reno_sparks' ? '$1.00/lnft' : '$1.50/lnft'],
                    ['Crown', market === 'reno_sparks' ? '$5.00/lnft' : '$7.50/lnft'],
                    ['Windows', market === 'reno_sparks' ? '$150–$200/ea' : '$225–$300/ea'],
                    ['Furnished adder', market === 'reno_sparks' ? '+$0.75/sqft' : '+$1.13/sqft'],
                    ['Dark color', market === 'reno_sparks' ? '+$0.25/sqft' : '+$0.38/sqft'],
                  ].map(([label, rate]) => (
                    <div key={label} className="flex justify-between p-3" style={{ borderBottom: '1px solid #2a2a28' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888884' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#fff' }}>{rate}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: '#555552', marginTop: '0.75rem', lineHeight: '1.5' }}>
                  AI applies these rates + condition multipliers automatically. All rates anchor high — override down as needed.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Generated quote */}
        {lineItems.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em' }}>
                GENERATED QUOTE
              </p>
              <button
                type="button"
                onClick={handleStartOver}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555552', letterSpacing: '0.1em' }}
                className="hover:text-white transition-colors"
              >
                START OVER
              </button>
            </div>

            {hadPhotos && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', marginBottom: '1rem', fontStyle: 'italic' }}>
                Measurements parsed from photos — verify before saving
              </p>
            )}

            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a28' }}>
                  {['Description', 'Qty', 'Unit', 'Rate', 'Total'].map(h => (
                    <th key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.1em', padding: '0.5rem 0.75rem', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1c1c1a' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.6rem 0.75rem', color: '#fff' }}>{item.label}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.6rem 0.75rem', color: '#fff' }}>{item.qty.toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.6rem 0.75rem', color: '#888884' }}>{item.unit}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.6rem 0.75rem', color: '#fff' }}>${item.rate.toFixed(2)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.6rem 0.75rem', color: '#fff', fontWeight: 500 }}>${item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid #2a2a28' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888884' }}>SELL PRICE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: '#fff' }}>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            {epoxyBreakdown && (
              <div className="mt-4 p-4" style={{ background: '#1c1c1a', border: '1px solid #2a2a28' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>INTERNAL MARGIN BREAKDOWN</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    ['Direct Cost', epoxyBreakdown.directCost],
                    ['Overhead', epoxyBreakdown.overhead],
                    ['Profit', epoxyBreakdown.profit],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#555552', letterSpacing: '0.1em', marginBottom: '2px' }}>{label as string}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#888884' }}>${(val as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={loading}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em', background: '#fff', color: '#000', padding: '0.75rem 2rem', marginTop: '1.5rem' }}
              className="hover:bg-zinc-200 transition-colors disabled:opacity-50 uppercase"
            >
              Save Quote
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', display: 'block', marginBottom: '0.4rem' }}>
        {label}
      </label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', background: '#1c1c1a', border: '1px solid #2a2a28', color: '#fff', padding: '0.5rem 0.75rem', width: '100%' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the full page compiles**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/internal/projects/[id]/quote/new/page.tsx
git commit -m "feat: wire freeform intake into new quote page with market selector"
```

---

### Task 5: Update Hero Header Text

**Files:**
- Modify: `app/components/Hero.tsx`

Note: This change was already made during the brainstorming session. Verify it's in place and committed.

- [ ] **Step 1: Verify the header reads correctly**

The h1 in `app/components/Hero.tsx` should read:
```
Northern Nevada's Premier
Paint & Epoxy
Floor Provider.
```

- [ ] **Step 2: Commit if not already committed**

```bash
git add app/components/Hero.tsx
git commit -m "copy: update hero header to Northern Nevada's Premier Paint & Epoxy Floor Provider"
```

---

### Task 6: Smoke Test — End-to-End Freeform Quote Generation

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to a project and create a new quote**

Go to `/internal/projects/{any-project-id}/quote/new`

- [ ] **Step 3: Test Interior freeform intake**

1. Select "Interior Painting" + "Reno / Sparks"
2. Paste this into the textarea:
```
Customer email: "Hi, we need the whole house painted. It's about 2400 sqft, 3 bed 2 bath. The house is fully furnished. Walls are currently dark grey, we want to go lighter. Standard orange peel texture. About 180 lnft of baseboards and casings. 8 windows, regular trim. One accent wall in the living room, about 12x10ft, want it navy blue."
```
3. Click "Generate Quote"
4. Verify line items appear with:
   - Walls + ceilings at ~$2.75/sqft base + $0.75 furnished + $0.25 dark color = ~$3.75/sqft
   - Trim at $1.00/lnft
   - Windows at $150/ea
   - Accent wall at ~$3.00/sqft + $0.50 difficult pigment
   - Furnished surcharge as a separate line or baked into wall rate

- [ ] **Step 4: Test with photos**

1. Drag an iPhone photo onto the textarea
2. Verify thumbnail appears
3. Click generate, verify AI attempts to extract info from the image

- [ ] **Step 5: Test market switching**

1. Switch market to "Lake Tahoe"
2. Verify reference panel shows 50% higher rates
3. Generate — verify line items use higher rates

- [ ] **Step 6: Test epoxy is unchanged**

1. Switch to "Epoxy Floors"
2. Verify the deterministic calculator still works exactly as before

- [ ] **Step 7: Save a generated quote**

1. Click "Save Quote" after generating
2. Verify redirect to `/internal/quotes/{id}`
3. Verify line items persisted correctly

- [ ] **Step 8: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: freeform quote intake with AI parsing and photo support"
```
