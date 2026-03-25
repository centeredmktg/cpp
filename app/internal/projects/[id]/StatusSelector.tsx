'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = ['LEAD', 'QUOTED', 'CONTRACTED', 'IN_PROGRESS', 'COMPLETE', 'LOST'] as const
type Status = typeof STATUSES[number]

const STATUS_LABEL: Record<Status, string> = {
  LEAD: 'Lead',
  QUOTED: 'Quoted',
  CONTRACTED: 'Contracted',
  IN_PROGRESS: 'In Progress',
  COMPLETE: 'Complete',
  LOST: 'Lost',
}

export default function StatusSelector({
  projectId,
  currentStatus,
}: {
  projectId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState<Status>(currentStatus as Status)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleChange(newStatus: Status) {
    setSaving(true)
    setStatus(newStatus)
    await fetch(`/api/internal/projects/${projectId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={e => handleChange(e.target.value as Status)}
        disabled={saving}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          letterSpacing: '0.08em',
          background: '#1c1c1a',
          border: '1px solid #2a2a28',
          color: '#fff',
          padding: '0.4rem 0.75rem',
          cursor: 'pointer',
        }}
      >
        {STATUSES.map(s => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>
      {saving && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884' }}>Saving…</span>}
    </div>
  )
}
