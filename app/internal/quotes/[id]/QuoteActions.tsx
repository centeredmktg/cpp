'use client'

import { useState } from 'react'

const btnStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  letterSpacing: '0.1em',
  border: '1px solid #2a2a28',
  color: '#888884',
  padding: '0.4rem 1rem',
  textTransform: 'uppercase' as const,
  background: 'transparent',
}

export default function QuoteActions({
  quoteId,
  status,
  signingToken,
}: {
  quoteId: string
  status: string
  signingToken: string | null
}) {
  const [sending, setSending] = useState(false)
  const [sentUrl, setSentUrl] = useState<string | null>(null)

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
      const data = await res.json()
      if (data.signingUrl) setSentUrl(data.signingUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => window.print()

  const effectiveToken = sentUrl ? new URL(sentUrl).pathname.split('/').pop() : signingToken

  return (
    <div className="flex gap-2 items-center">
      {status !== 'SIGNED' && (
        <button
          onClick={handleSend}
          disabled={sending}
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors disabled:opacity-50"
        >
          {sending ? 'Sending...' : status === 'SENT' ? 'Resend' : 'Send to Client'}
        </button>
      )}

      {effectiveToken && status !== 'SIGNED' && (
        <a
          href={`/proposals/${effectiveToken}`}
          target="_blank"
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors inline-block"
        >
          Sign In-Person
        </a>
      )}

      {status === 'SIGNED' && (
        <a
          href={`/api/quotes/${quoteId}/signed-pdf`}
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors inline-block"
        >
          Download Signed PDF
        </a>
      )}

      <button
        onClick={handlePrint}
        style={btnStyle}
        className="hover:border-white hover:text-white transition-colors"
      >
        Print / Save PDF
      </button>

      {sentUrl && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#4ade80' }}>Sent!</span>
      )}
    </div>
  )
}
