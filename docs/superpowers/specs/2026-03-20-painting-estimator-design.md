# Painting Estimator — Design Spec
**Date:** 2026-03-20
**Status:** Draft

## Overview

Replace the existing Claude-based INTERIOR/EXTERIOR painting quote flow with a deterministic, production-rate-driven multi-zone painting estimator. Logic ported directly from `cpp_full_commercial_estimator.xlsx`. No LLM involvement in estimation math.

Service types on the quote page become: `PAINTING` and `EPOXY`.

---

## Data Model

### Schema change — ServiceType enum (additive)

Add `PAINTING` to the `ServiceType` enum. **Do not remove `INTERIOR` or `EXTERIOR`** — the public contact form (`/app/components/Contact.tsx`, `/app/api/contact/route.ts`) still uses those values and is out of scope for this change. The quote page UI will stop offering them, but they remain valid enum values in the DB. Requires a migration.

### PricingBaseline — 20 new rows

The existing `PricingBaseline` table (key / label / rate / unit) absorbs 20 new rows with `paint_` prefixed keys. Seeded as Reno defaults, editable in the Pricing settings page over time.

**Storage convention:** overhead, profit, and waste values are stored as decimals (0–1 range), not percentages. `0.15` = 15%. The `unit` column shows `%` for display only. The estimation engine reads them directly as multipliers. Difficulty values are stored as direct multipliers (1.0, 1.15, 1.3), read as-is.

| Key | Label | Default | Unit |
|-----|-------|---------|------|
| `paint_labor_rate` | Loaded labor rate per painter | 42 | $/hr |
| `paint_wall_prod` | Wall production | 250 | sqft/hr |
| `paint_ceiling_prod` | Ceiling production | 300 | sqft/hr |
| `paint_trim_prod` | Trim production | 35 | lf/hr |
| `paint_door_prod` | Door production | 2 | doors/hr |
| `paint_coverage` | Paint coverage | 350 | sqft/gal |
| `paint_trim_gal_per_lf` | Trim gallons per LF per coat | 0.02 | gal/lf |
| `paint_door_gal_per_door` | Door gallons per door per coat | 0.15 | gal/door |
| `paint_waste_factor` | Material waste factor | 0.10 | % |
| `paint_overhead_mid` | Overhead — Mid | 0.15 | % |
| `paint_overhead_high` | Overhead — High-End | 0.18 | % |
| `paint_profit_mid` | Profit — Mid | 0.25 | % |
| `paint_profit_high` | Profit — High-End | 0.35 | % |
| `paint_crew_hours_per_day` | Crew day hours | 8 | hrs/day |
| `paint_mobilization_min` | Mobilization / minimum | 0 | $ |
| `paint_difficulty_easy` | Difficulty — Easy | 1.0 | x |
| `paint_difficulty_medium` | Difficulty — Medium | 1.15 | x |
| `paint_difficulty_hard` | Difficulty — Hard | 1.3 | x |
| `paint_cost_mid` | Paint cost — Mid | 38 | $/gal |
| `paint_cost_high` | Paint cost — High-End | 58 | $/gal |

---

## Estimation Engine

**File:** `lib/estimation/painting.ts`

Pure function — no side effects, no network calls. Accepts a settings map (keyed by `paint_*` keys) and returns per-zone breakdowns and totals.

### Fallback constants

The seed defaults above are duplicated as a `PAINTING_DEFAULTS` constant in the engine file. Used when settings haven't loaded from the API yet (same pattern as existing `FALLBACK_RATES` for epoxy).

### Zero-quantity zone rule

Zones where `walls + ceilings + trim + doors === 0` are **excluded** from the engine output entirely. The engine filters them before computing results. The UI does not need to enforce this — the engine handles it silently.

### Types

```ts
type Difficulty = 'Easy' | 'Medium' | 'Hard'
type MaterialTier = 'Mid' | 'High-End'
type BidTier = 'Mid' | 'High-End'

interface PaintZone {
  name: string
  scopeType: string   // free-text label only, no math impact — e.g. "Office", "Hallway", "Other"
  walls: number       // sqft
  ceilings: number    // sqft
  trim: number        // lf
  doors: number       // count
  coats: number
  difficulty: Difficulty
  prepPct: number     // 0–100, additive multiplier on total labor hours
  materialTier: MaterialTier  // drives paint cost $/gal for this zone; independent of global bidTier
  notes: string
}

interface PaintGlobalInputs {
  bidTier: BidTier    // drives overhead % and profit % for all zones
  crewSize: number    // minimum 1, enforced in UI; used only for crewDays output
}

interface ZoneResult extends PaintZone {
  laborHrs: number
  laborCost: number
  gallons: number
  matCost: number
  subtotal: number
  overhead: number
  profit: number
  total: number
}

interface EstimateResult {
  zones: ZoneResult[]
  totals: {
    laborHrs: number
    laborCost: number
    gallons: number
    matCost: number
    subtotal: number
    overhead: number
    profit: number
    total: number              // sum of zone totals; if below mobilizationMin, equals mobilizationMin
    mobilizationApplied: number  // 0 if not triggered; otherwise the mobilization floor value
    crewDays: number
  }
}
```

### Math per zone (from Excel Commercial Estimate formulas)

`bidTier` drives `overheadPct` and `profitPct` globally. `materialTier` per zone drives `paintCostPerGal` independently. `prepPct` applies as an additive multiplier on total labor hours (matches Excel behavior — not applied to materials).

```
difficultyFactor = settings[paint_difficulty_{easy|medium|hard}]  // direct multiplier

laborHrs  = ((walls / wallProd) + (ceilings / ceilProd) + (trim / trimProd) + (doors / doorProd))
            * coats * (1 + prepPct/100) * difficultyFactor

laborCost = laborHrs * laborRate

paintCostPerGal = zone.materialTier === 'High-End' ? paint_cost_high : paint_cost_mid

gallons   = ((walls + ceilings) / coverage + trim * trimGalPerLf + doors * doorGalPerDoor)
            * coats * (1 + wasteFactor)

matCost   = gallons * paintCostPerGal

subtotal  = laborCost + matCost

overheadPct = bidTier === 'High-End' ? paint_overhead_high : paint_overhead_mid
profitPct   = bidTier === 'High-End' ? paint_profit_high : paint_profit_mid

overhead  = subtotal * overheadPct
profit    = (subtotal + overhead) * profitPct
total     = subtotal + overhead + profit
```

### Totals

Sum all zone values. `totals.laborHrs` is the sum of all `zone.laborHrs`.

```
rawTotal         = sum of zone totals
mobilizationMin  = settings[paint_mobilization_min]
totals.total     = rawTotal < mobilizationMin ? mobilizationMin : rawTotal
mobilizationApplied = rawTotal < mobilizationMin ? mobilizationMin : 0
crewDays         = totals.laborHrs / max(crewSize, 1) / crewHoursPerDay
```

Mobilization is a floor — it replaces the total, it does not add to it. No mobilization line item is appended. When triggered, the UI shows a note; the saved quote total reflects the mobilization floor.

---

## API

- `/api/internal/pricing` — already returns all `PricingBaseline` rows. The 20 new `paint_` rows included automatically.
- `/api/internal/quote/save` — unchanged. `total` field should be `result.totals.total` (not `lineItems.reduce(...)`) so the mobilization floor is reflected correctly.
- `/api/internal/quote/generate/route.ts` — **delete after confirming no other callers** (currently called only by the INTERIOR/EXTERIOR path in the quote page, which is being replaced).

### Line items mapping (ZoneResult → LineItem)

Each non-zero zone maps to one `LineItem`. Blank zones (filtered by engine) are excluded.

```ts
{
  label: `${zone.name}${zone.scopeType ? ` — ${zone.scopeType}` : ''}`,
  qty: zone.walls + zone.ceilings,   // total painted sqft as reference quantity
  unit: 'SF',
  rate: zone.total / (zone.walls + zone.ceilings || 1),  // effective $/SF
  total: zone.total,
}
```

**No mobilization line item is appended.** If `mobilizationApplied > 0`, the saved total uses `result.totals.total` (the floor value) — line item totals will not sum to the saved total in this edge case, which is acceptable since this is a minimum charge scenario.

---

## UI

### Quote Page (`app/internal/projects/[id]/quote/new/page.tsx`)

Service type selector: `PAINTING` | `EPOXY`. INTERIOR and EXTERIOR removed from the UI only.

**PAINTING form layout:**

1. **Global controls** — Bid Tier (Mid / High-End), Crew Size (number, min 1, default 2)

2. **Zone table** — one row per zone; starts with one row; add/remove buttons
   - Inputs: Zone Name, Scope Type (text), Walls (sqft), Ceilings (sqft), Trim (lf), Doors (#), Coats, Difficulty (Easy/Medium/Hard), Prep % (0–100), Material Tier (Mid/High-End), Notes

3. **Calculate button** — triggers client-side `calculatePainting()`. No server round-trip.

4. **Results panel** — zone-by-zone table: Zone, Labor Hrs, Labor $, Gallons, Mat $, Subtotal, Overhead, Profit, Total. Grand total row. Crew days shown below. If `mobilizationApplied > 0`, show a note: "Mobilization minimum applied — total set to $X."

5. **Save Quote** — uses `result.totals.total` as the saved total; maps zones to `LineItem[]` per mapping above; posts to `/api/internal/quote/save`; redirects to quote detail.

### Pricing Settings Page (`app/internal/settings/pricing/page.tsx`)

New section at top: **PAINTING — PRODUCTION SETTINGS**
New component: `PaintingSettingsEditor` — same inline edit-save pattern as existing `PricingEditor`.

**Production Rates sub-section:**
`paint_labor_rate`, `paint_wall_prod`, `paint_ceiling_prod`, `paint_trim_prod`, `paint_door_prod`, `paint_coverage`, `paint_trim_gal_per_lf`, `paint_door_gal_per_door`, `paint_waste_factor`, `paint_crew_hours_per_day`, `paint_mobilization_min`, `paint_difficulty_easy`, `paint_difficulty_medium`, `paint_difficulty_hard`

**Margins & Material Costs sub-section:**
`paint_overhead_mid`, `paint_overhead_high`, `paint_profit_mid`, `paint_profit_high`, `paint_cost_mid`, `paint_cost_high`

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PAINTING` to `ServiceType` enum (additive — INTERIOR/EXTERIOR remain) |
| `prisma/migrations/…` | Migration for enum addition |
| `prisma/seed.ts` | Add 20 `paint_` PricingBaseline rows |
| `lib/estimation/painting.ts` | New — pure estimation engine |
| `app/internal/projects/[id]/quote/new/page.tsx` | Replace INTERIOR/EXTERIOR UI with PAINTING multi-zone form |
| `app/internal/settings/pricing/PaintingSettingsEditor.tsx` | New — editor component |
| `app/internal/settings/pricing/page.tsx` | Add PaintingSettingsEditor section |
| `app/api/internal/quote/generate/route.ts` | Delete (confirm no callers first) |

---

## Out of Scope

- Public contact form service type update (INTERIOR/EXTERIOR remain valid for public form)
- Zone-count complexity multiplier (deferred)
- Quick Bid mode (single-zone is just the multi-zone form with one row)
- Scope Library modifiers from Excel
