'use client'

import { useState } from 'react'

interface EpoxyRate { id: string; jobType: string; systemLevel: string; rate: number }

const JOB_TYPES = ['Warehouse', 'Retail', 'Residential']
const SYSTEM_LEVELS = ['Standard', 'Premium', 'Elite']

export default function EpoxyRatesEditor({ initialRates }: { initialRates: EpoxyRate[] }) {
  const [rates, setRates] = useState<EpoxyRate[]>(initialRates)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  function getRate(jobType: string, systemLevel: string) {
    return rates.find(r => r.jobType === jobType && r.systemLevel === systemLevel)
  }

  async function handleSave(id: string) {
    const rate = parseFloat(editing[id])
    if (isNaN(rate) || rate < 0) return

    setSaving(id)
    const res = await fetch('/api/internal/epoxy-rates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rate }),
    })

    if (res.ok) {
      const updated = await res.json()
      setRates(rs => rs.map(r => r.id === id ? updated : r))
      setEditing(e => { const next = { ...e }; delete next[id]; return next })
      setSaved(id)
      setTimeout(() => setSaved(null), 2000)
    }
    setSaving(null)
  }

  return (
    <div style={{ border: '1px solid #2a2a28' }}>
      {/* Header row */}
      <div className="flex px-4 py-2" style={{ borderBottom: '1px solid #2a2a28', background: '#1c1c1a' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', flex: 2 }} />
        {SYSTEM_LEVELS.map(level => (
          <span key={level} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', flex: 1, textAlign: 'center' }}>
            {level.toUpperCase()}
          </span>
        ))}
      </div>

      {JOB_TYPES.map(jobType => (
        <div key={jobType} className="flex items-center px-4 py-4" style={{ borderBottom: '1px solid #1c1c1a' }}>
          <div style={{ flex: 2, fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#fff' }}>
            {jobType}
          </div>

          {SYSTEM_LEVELS.map(level => {
            const entry = getRate(jobType, level)
            if (!entry) return <div key={level} style={{ flex: 1 }} />

            const currentVal = editing[entry.id] ?? String(entry.rate)
            return (
              <div key={level} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div className="flex items-center gap-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888884' }}>$</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={currentVal}
                    onChange={e => setEditing(ed => ({ ...ed, [entry.id]: e.target.value }))}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #2a2a28',
                      color: '#fff',
                      width: '60px',
                      padding: '2px 0',
                      outline: 'none',
                      textAlign: 'center',
                    }}
                    onFocus={e => (e.target.style.borderBottomColor = '#fff')}
                    onBlur={e => (e.target.style.borderBottomColor = '#2a2a28')}
                  />
                </div>
                <div style={{ height: '18px', display: 'flex', alignItems: 'center' }}>
                  {entry.id in editing ? (
                    <button
                      onClick={() => handleSave(entry.id)}
                      disabled={saving === entry.id}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.1em', background: '#fff', color: '#000', padding: '0.2rem 0.5rem' }}
                      className="hover:bg-zinc-200 transition-colors disabled:opacity-50 uppercase"
                    >
                      {saving === entry.id ? '…' : 'Save'}
                    </button>
                  ) : saved === entry.id ? (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#4ade80' }}>✓</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
