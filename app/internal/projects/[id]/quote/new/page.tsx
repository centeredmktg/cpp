'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  const [measurements, setMeasurements] = useState({
    wallsSqft: '',
    ceilingsSqft: '',
    trimLf: '',
    exteriorSqft: '',
  })
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

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLineItems([])
    setEpoxyBreakdown(null)

    if (serviceType === 'EPOXY') {
      const sqft = parseFloat(epoxyInputs.sqft)
      if (!sqft || sqft <= 0) { setError('Enter a valid square footage.'); return }
      // Build rate lookup maps from DB records
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

    setLoading(true)
    try {
      const res = await fetch('/api/internal/quote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurements, serviceType, baselines, notes }),
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

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
            className="hover:text-white mb-4 block"
          >
            ← Back
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '0.03em' }}>
            New Quote
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: form */}
          <form onSubmit={handleGenerate} className="flex flex-col gap-5">
            <div>
              <label style={labelStyle}>SERVICE TYPE</label>
              <select
                value={serviceType}
                onChange={e => { setServiceType(e.target.value as any); setLineItems([]); setEpoxyBreakdown(null) }}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="INTERIOR">Interior Painting</option>
                <option value="EXTERIOR">Exterior Painting</option>
                <option value="EPOXY">Epoxy Floors</option>
              </select>
            </div>

            {serviceType === 'INTERIOR' && (
              <>
                <Field label="WALLS (SQ FT)" value={measurements.wallsSqft} onChange={v => setMeasurements(m => ({ ...m, wallsSqft: v }))} />
                <Field label="CEILINGS (SQ FT)" value={measurements.ceilingsSqft} onChange={v => setMeasurements(m => ({ ...m, ceilingsSqft: v }))} />
                <Field label="TRIM (LINEAL FT)" value={measurements.trimLf} onChange={v => setMeasurements(m => ({ ...m, trimLf: v }))} />
              </>
            )}

            {serviceType === 'EXTERIOR' && (
              <Field label="EXTERIOR SURFACES (SQ FT)" value={measurements.exteriorSqft} onChange={v => setMeasurements(m => ({ ...m, exteriorSqft: v }))} />
            )}

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
                  <label style={labelStyle}>GLUE REMOVAL LEVEL (0–3)</label>
                  <select value={epoxyInputs.glueLevel} onChange={e => setEpoxy('glueLevel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="0">0 — None</option>
                    <option value="1">1 — Light</option>
                    <option value="2">2 — Moderate</option>
                    <option value="3">3 — Heavy</option>
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

            {serviceType !== 'EPOXY' && (
              <div>
                <label style={labelStyle}>NOTES / CONTEXT (OPTIONAL)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any special conditions, coats required, etc."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
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
              {serviceType === 'EPOXY' ? 'Calculate Quote →' : loading ? 'Generating...' : 'Generate with Claude →'}
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
                  CURRENT PRICING BASELINE
                </p>
                <div style={{ border: '1px solid #2a2a28' }}>
                  {baselines.map(b => (
                    <div key={b.key} className="flex justify-between p-3" style={{ borderBottom: '1px solid #2a2a28' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888884' }}>{b.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#fff' }}>${b.rate.toFixed(2)}/{b.unit}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Generated quote */}
        {lineItems.length > 0 && (
          <div className="mt-12">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '1rem' }}>
              GENERATED QUOTE
            </p>

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
