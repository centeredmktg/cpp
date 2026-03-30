'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

export default function AcceptanceBlock({
  documentType,
  token,
  accepted,
  signerName: initialName,
  acceptedAt: initialDate,
}: {
  documentType: 'proposal' | 'change-order'
  token: string
  accepted: boolean
  signerName?: string
  acceptedAt?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>(accepted ? 'done' : 'idle')
  const [finalName, setFinalName] = useState(initialName ?? '')
  const [finalDate, setFinalDate] = useState(initialDate ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    padRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(28,28,26)',
      penColor: '#ffffff',
    })

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const data = padRef.current?.toData()
      const height = canvas.offsetHeight || 120
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = height * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
      if (data) padRef.current?.fromData(data)
    }

    window.addEventListener('resize', resize)
    resize()
    return () => window.removeEventListener('resize', resize)
  }, [])

  const handleClear = () => padRef.current?.clear()

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      setError('Please sign before submitting.')
      return
    }
    setError('')
    setStatus('loading')

    const signature = padRef.current.toDataURL('image/png')
    const endpoint =
      documentType === 'proposal'
        ? `/api/sign/quote/${token}`
        : `/api/sign/change-order/${token}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName: name }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      setStatus('idle')
      return
    }

    const data = await res.json()
    setFinalName(name)
    setFinalDate(data.signedAt ? new Date(data.signedAt).toLocaleString() : new Date().toLocaleString())
    setStatus('done')
  }

  const label = documentType === 'proposal' ? 'Proposal' : 'Change Order'

  if (status === 'done') {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-green-800 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 font-semibold text-sm">{label} Accepted</p>
        </div>
        <p className="text-[#888884] text-sm ml-7">
          Signed by <span className="text-white font-medium">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden print:hidden" style={{ border: '1px solid #2a2a28' }}>
      <div style={{ background: '#1c1c1a', padding: '1rem 1.5rem' }}>
        <h3 className="text-white font-semibold text-sm">
          {documentType === 'proposal' ? 'Acceptance of Proposal' : 'Sign Change Order'}
        </h3>
        <p style={{ color: '#888884', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: '1.5' }}>
          By signing below and clicking Submit, you authorize CPP Painting & Building to proceed with the
          {documentType === 'proposal' ? ' work described above' : ' changes described above'}, and agree to the stated terms.
        </p>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', background: '#1c1c1a', border: '1px solid #2a2a28', color: '#fff', padding: '0.75rem 1rem', fontSize: '0.9rem', fontFamily: 'var(--font-sans)' }}
            className="placeholder-[#555552] focus:outline-none focus:border-white transition-colors"
          />
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Signature
          </label>
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: '120px', touchAction: 'none', border: '1px solid #2a2a28', background: '#1c1c1a' }}
          />
        </div>

        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <button type="button" onClick={handleClear} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555552' }} className="hover:text-white transition-colors">
            Clear signature
          </button>
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#f87171', marginBottom: '0.75rem' }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid #2a2a28', color: '#fff', padding: '0.85rem', background: 'transparent' }}
          className="hover:border-white transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Submitting...' : `Submit Signed ${label}`}
        </button>
      </div>
    </div>
  )
}
