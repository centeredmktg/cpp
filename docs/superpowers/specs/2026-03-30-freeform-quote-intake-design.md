# Freeform Quote Intake

**Date:** 2026-03-30
**Status:** Design
**Scope:** Replace structured measurement inputs with freeform intake for painting quotes

---

## Problem

The current quote creation flow requires manual entry into structured fields (walls sqft, ceiling sqft, trim lnft). In practice, estimators have a mix of customer emails, field notes, iPhone photos of tape measures, and mental notes. The structured form is a bottleneck — it forces translation from messy real-world input into clean fields before anything can happen.

## Solution

A freeform intake zone that accepts any combination of text, photos, and PDFs. The AI parses everything, applies CPP's pricing rules, and returns a generated quote with editable line items. Speed to a reviewable v1, not perfection on first pass.

## UX Reference

Inspired by BuildingNV's intake pattern — single input area, dump everything, get a quote back.

---

## Page Design

### Location

Same page: `app/internal/projects/[id]/quote/new/page.tsx`

The service type selector (Interior / Exterior / Epoxy) stays. When Interior or Exterior is selected, the freeform intake replaces the current structured fields. Epoxy keeps its deterministic calculator unchanged.

### Input Area

- Large textarea (~8 rows, full width)
- Placeholder: *"Paste a customer email, type field notes, drop photos of measurements — whatever you've got"*
- The textarea doubles as a dropzone — drag files anywhere onto it
- Accepted file types: images (jpg, png, heic), PDFs
- Thumbnail strip below textarea for attached files, each with a remove button
- Market selector: Reno/Sparks (default) | Arrowcreek | Lake Tahoe
- "Generate Quote" button

### Processing State

- Input area dims, not hidden (user can still see what they submitted)
- Spinner with status text: "Reading your input..." → "Generating line items..."

### Results (same page, below input)

- Line items table appears (same as current: label, qty, unit, rate, total)
- All cells editable inline — click to modify
- Add row / remove row controls
- Subtotal + total
- Payment terms textarea (pre-filled with default)
- Exclusions textarea (optional)
- "Save Quote" button → saves and redirects to quote detail page
- "Start Over" link → clears results, returns to input state

### Reliability Notice

When photos are included in the input, show a subtle note below the generated results:
*"Measurements parsed from photos — verify before saving"*

This sets expectations for handwritten notes and tape measure photos without being intrusive.

---

## API Design

### Endpoint

`POST /api/internal/quote/generate` (rework existing)

### Request

```typescript
{
  text: string           // freeform text input
  files: {               // attached photos/PDFs
    name: string
    type: string         // mime type
    data: string         // base64 encoded
  }[]
  serviceType: 'INTERIOR' | 'EXTERIOR'
  market: 'reno_sparks' | 'arrowcreek' | 'tahoe'
  baselines: Baseline[]  // pricing baselines from DB (existing behavior)
}
```

### Processing

1. Write uploaded files to `{DOCS_DIR}/intake/{timestamp}-{filename}` (temp storage)
2. Build system prompt containing:
   - Full pricing reference (base rates, multipliers, market adjustments)
   - Market-specific rate selection based on `market` param
   - Instructions to extract measurements from text AND images
   - Instructions to identify conditions (furnished, texture, dark colors, woodwork, etc.)
   - Output format: JSON array of line items
3. Send to Claude with vision (images as base64 content blocks, text as user message)
4. Parse JSON response
5. Return `{ lineItems, parsedContext? }` — parsedContext is optional metadata about what the AI detected (for debugging, not shown to user in v1)

### Response

```typescript
{
  lineItems: {
    label: string
    qty: number
    unit: string
    rate: number
    total: number
  }[]
}
```

### System Prompt — Pricing Rules

The prompt must encode the full pricing logic so Claude generates correct rates:

**Interior base rates by market:**
- Reno/Sparks: $2.50–$3.00/sqft walls+ceiling, $1.00/lnft trim
- Arrowcreek/Tahoe: 50% more on everything

**Additive multipliers (applied on top of base):**
- White ceiling + two-tone walls: +$0.50/sqft
- Dark color coverage: +$0.25/sqft
- Old world / hand-trowel texture: +$0.50/sqft
- Wall repair: +$0.15–$0.20/sqft
- Furnished home: +$0.75/sqft on total home sqft
- Craftsman basic woodwork: +$1.00/lnft
- Craftsman ornate woodwork: +$1.50/lnft
- 3-coat coverage: +$1.00/sqft

**Trim & woodwork:**
- Standard trim: $1.00/lnft
- Crown molding (single level): $5.00/lnft
- Wainscot: $50.00/lnft
- Window regular: $150/per
- Window craftsman: $200/per

**Accent walls:**
- Base: $2.50–$3.50/sqft
- Difficult pigments (black, red, yellow, blue): +$0.50/sqft

**Exterior:**
- Stucco minimal prep: $2.00–$3.00/sqft
- Stucco needs primer: $3.50+/sqft
- Siding good condition: $2.85/sqft
- Siding needs spot priming: up to $3.30/sqft

**Cabinet staining:** $110.00/lnft

**Rules:**
- 2-coat is standard (included in base)
- All multipliers are additive, not compounding
- Default to higher end of ranges (anchor high, crew can override down)
- Whole house sqft unless input specifies single room
- No minimum job size

### Image Handling

- Photos sent as base64 image content blocks in the Claude API call
- Claude vision extracts: tape measure readings, room dimensions, surface conditions, texture type, woodwork style, furnishing level, color observations
- Handwritten notes: attempt OCR via vision, expect lower reliability
- PDFs: extract text content, treat same as pasted text

---

## File Changes

### Modified

1. **`app/internal/projects/[id]/quote/new/page.tsx`**
   - Add freeform textarea + dropzone for Interior/Exterior (replaces structured fields)
   - Add market selector dropdown
   - Add file thumbnail strip with remove buttons
   - Add reliability notice when photos are included
   - Keep epoxy calculator path unchanged

2. **`app/api/internal/quote/generate/route.ts`**
   - Accept new payload shape (text, files, market)
   - Build pricing-aware system prompt
   - Send images via Claude vision API
   - Write temp files to filesystem
   - Return line items

### New

3. **Dropzone component** — textarea overlay that handles drag-and-drop + file picker
   - Accepts images (jpg, png, heic) and PDFs
   - Converts to base64 for API transmission
   - Shows thumbnails with remove buttons
   - Reusable but only used here for now

### Unchanged

- Epoxy calculator (deterministic, stays as-is)
- Quote save endpoint and flow
- Quote detail/review page
- Proposal and signing flow
- Pricing settings page

---

## Data Model

No schema changes. Uploaded files are temp storage on filesystem only — not persisted in DB.

---

## Not In Scope

- Room-by-room breakdown UI (whole house default, single room via text input)
- Photo gallery or permanent image storage (use Google Drive/OneDrive for that)
- Changes to epoxy calculator
- Inline editing of the freeform input after generation (just "Start Over")
- Mobile-optimized camera capture (works via standard file picker on mobile Safari/Chrome)

---

## Open Questions

None — ready for implementation planning.
