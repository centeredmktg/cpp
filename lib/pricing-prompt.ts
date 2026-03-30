// lib/pricing-prompt.ts

export type Market = 'reno_sparks' | 'arrowcreek' | 'tahoe'

const MARKET_LABELS: Record<Market, string> = {
  reno_sparks: 'Reno / Sparks',
  arrowcreek: 'Arrowcreek',
  tahoe: 'Lake Tahoe',
}

export function buildPricingPrompt(serviceType: 'INTERIOR' | 'EXTERIOR', market: Market): string {
  const marketLabel = MARKET_LABELS[market]
  const isHighMarket = market === 'arrowcreek' || market === 'tahoe'
  const marketNote = isHighMarket
    ? 'This is a premium market. Rates below already reflect the market adjustment.'
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
