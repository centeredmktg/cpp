'use client'

import { useState } from 'react'

interface Baseline { id: string; key: string; label: string; rate: number; unit: string }

export default function PricingEditor({ initialBaselines }: { initialBaselines: Baseline[] }) {
  const [baselines, setBaselines] = useState<Baseline[]>(initialBaselines)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function handleSave(id: string) {
    const rate = parseFloat(editing[id])
    if (isNaN(rate) || rate < 0) return

    setSaving(id)
    const res = await fetch('/api/internal/pricing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rate }),
    })

    if (res.ok) {
      const updated = await res.json()
      setBaselines(bs => bs.map(b => b.id === id ? updated : b))
      setEditing(e => { const next = { ...e }; delete next[id]; return next })
      setSaved(id)
      setTimeout(() => setSaved(null), 2000)
    }
    setSaving(null)
  }

  return (
    <div style={{ border: '1px solid #2a2a28' }}>
      <div className="flex px-4 py-2" style={{ borderBottom: '1px solid #2a2a28', background: '#1c1c1a' }}>
        {['Service', 'Rate', 'Unit', ''].map(h => (
          <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', flex: h === 'Service' ? 3 : 1 }}>
            {h}
          </span>
        ))}
      </div>

      {baselines.map(b => {
        const isEditing = (id: string) => id in editing
        const currentVal = editing[b.id] ?? String(b.rate)

        return (
          <div key={b.id} className="flex items-center px-4 py-4" style={{ borderBottom: '1px solid #1c1c1a' }}>
            <div style={{ flex: 3 }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#fff' }}>{b.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', marginTop: '2px' }}>{b.key}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-1">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888884' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentVal}
                  onChange={e => setEditing(ed => ({ ...ed, [b.id]: e.target.value }))}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #2a2a28',
                    color: '#fff',
                    width: '70px',
                    padding: '2px 0',
                    outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderBottomColor = '#fff')}
                  onBlur={e => (e.target.style.borderBottomColor = '#2a2a28')}
                />
              </div>
            </div>

            <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888884' }}>
              /{b.unit}
            </div>

            <div style={{ flex: 1 }}>
              {b.id in editing ? (
                <button
                  onClick={() => handleSave(b.id)}
                  disabled={saving === b.id}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em', background: '#fff', color: '#000', padding: '0.3rem 0.75rem' }}
                  className="hover:bg-zinc-200 transition-colors disabled:opacity-50 uppercase"
                >
                  {saving === b.id ? '…' : 'Save'}
                </button>
              ) : saved === b.id ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#4ade80' }}>✓</span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
