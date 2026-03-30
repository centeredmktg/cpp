'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Quote {
  id: string
  total: number
  createdAt: string
  status: string
}

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  background: '#1c1c1a',
  border: '1px solid #2a2a28',
  color: '#fff',
  padding: '0.5rem 0.75rem',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  color: '#888884',
  letterSpacing: '0.12em',
  display: 'block',
  marginBottom: '0.4rem',
}

export default function NewChangeOrderPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteId, setQuoteId] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { label: '', qty: 1, unit: 'ea', rate: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/internal/projects/${projectId}/quotes`)
      .then((r) => r.json())
      .then((data) => {
        setQuotes(data)
        if (data.length > 0) setQuoteId(data[0].id)
      })
      .catch(() => setError('Failed to load quotes'))
  }, [projectId])

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const updated = [...prev]
      const item = { ...updated[index], [field]: value }
      if (field === 'qty' || field === 'rate') {
        item.total = Number(item.qty) * Number(item.rate)
      }
      updated[index] = item
      return updated
    })
  }

  function addItem() {
    setItems((prev) => [...prev, { label: '', qty: 1, unit: 'ea', rate: 0, total: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const delta = items.reduce((sum, item) => sum + (item.total ?? 0), 0)

  async function handleSave() {
    setError('')
    if (!quoteId || !description || items.length === 0) {
      setError('Quote, description, and at least one line item are required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/internal/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, description, lineItems: items, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save change order')
        return
      }
      router.push(`/internal/projects/${projectId}`)
    } catch {
      setError('Unexpected error saving change order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.1rem',
            color: '#fff',
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          NEW CHANGE ORDER
        </h1>
      </div>

      {error && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: '#f87171',
            marginBottom: '1.5rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid #f87171',
            background: '#1c1c1a',
          }}
        >
          {error}
        </div>
      )}

      {/* Quote selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>QUOTE</label>
        <select
          value={quoteId}
          onChange={(e) => setQuoteId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {quotes.length === 0 && <option value="">No quotes found</option>}
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>
              {q.id} — ${q.total.toLocaleString()} — {new Date(q.createdAt).toLocaleDateString()} [{q.status}]
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>DESCRIPTION</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Describe the change order..."
        />
      </div>

      {/* Line items */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>LINE ITEMS</label>

        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '4fr 2fr 1fr 2fr 2fr 1fr',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          {['LABEL', 'QTY', 'UNIT', 'RATE', 'TOTAL', ''].map((h) => (
            <span key={h} style={{ ...labelStyle, marginBottom: 0 }}>
              {h}
            </span>
          ))}
        </div>

        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '4fr 2fr 1fr 2fr 2fr 1fr',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={item.label}
              onChange={(e) => updateItem(i, 'label', e.target.value)}
              placeholder="Item label"
              style={inputStyle}
            />
            <input
              type="number"
              value={item.qty}
              min={0}
              onChange={(e) => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
            <input
              type="text"
              value={item.unit}
              onChange={(e) => updateItem(i, 'unit', e.target.value)}
              placeholder="ea"
              style={inputStyle}
            />
            <input
              type="number"
              value={item.rate}
              min={0}
              step={0.01}
              onChange={(e) => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
            <div
              style={{
                ...inputStyle,
                color: '#888884',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button
              onClick={() => removeItem(i)}
              disabled={items.length === 1}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                background: 'transparent',
                border: '1px solid #2a2a28',
                color: items.length === 1 ? '#444' : '#f87171',
                cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                padding: '0.5rem',
                width: '100%',
              }}
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={addItem}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            background: 'transparent',
            border: '1px solid #2a2a28',
            color: '#888884',
            cursor: 'pointer',
            padding: '0.4rem 0.75rem',
            marginTop: '0.25rem',
            letterSpacing: '0.08em',
          }}
        >
          + ADD LINE
        </button>
      </div>

      {/* Delta display */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '0.75rem',
          background: '#1c1c1a',
          border: '1px solid #2a2a28',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ ...labelStyle, marginBottom: 0 }}>CHANGE ORDER DELTA</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            color: delta >= 0 ? '#4ade80' : '#f87171',
            fontWeight: 600,
          }}
        >
          {delta >= 0 ? '+' : ''}$
          {Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={labelStyle}>NOTES (OPTIONAL)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Internal notes..."
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            background: saving ? '#2a2a28' : '#fff',
            color: saving ? '#888884' : '#000',
            border: 'none',
            padding: '0.6rem 1.5rem',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'SAVING...' : 'SAVE CHANGE ORDER'}
        </button>
        <button
          onClick={() => router.push(`/internal/projects/${projectId}`)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            background: 'transparent',
            color: '#888884',
            border: '1px solid #2a2a28',
            padding: '0.6rem 1.5rem',
            cursor: 'pointer',
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}
