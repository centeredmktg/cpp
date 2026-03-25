'use client'

import { useState } from 'react'

const inputStyle = {
  fontFamily: 'var(--font-sans)',
  fontSize: '0.9rem',
  background: 'var(--subtle)',
  border: '1px solid var(--border)',
  color: 'var(--fg)',
  padding: '0.75rem 1rem',
  width: '100%',
  outline: 'none',
} as const

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  color: 'var(--muted)',
  letterSpacing: '0.12em',
  display: 'block',
  marginBottom: '0.4rem',
} as const

export default function Contact() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      serviceType: (form.elements.namedItem('serviceType') as HTMLSelectElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('success')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="py-24" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-baseline gap-6 mb-16">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>
            CONTACT
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left: info */}
          <div>
            <h2
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '0.03em', lineHeight: '1', color: 'var(--fg)' }}
            >
              Start a Project
            </h2>
            <p
              style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.7', marginTop: '1.5rem', maxWidth: '380px' }}
            >
              Tell us about your project and we&apos;ll get back to you within one business day with a quote or next steps.
            </p>
            <div className="mt-10 flex flex-col gap-4">
              {[
                ['Phone', '(775) 386-3962'],
                ['Email', 'johnny@cpppainting.com'],
                ['Location', 'Reno, NV'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-6">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.1em', minWidth: '64px', paddingTop: '2px' }}>
                    {k}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.95rem', color: 'var(--fg)' }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>NAME *</label>
                <input name="name" type="text" required style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'white')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <div>
                <label style={labelStyle}>COMPANY</label>
                <input name="company" type="text" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'white')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>EMAIL *</label>
                <input name="email" type="email" required style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'white')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
              <div>
                <label style={labelStyle}>PHONE</label>
                <input name="phone" type="tel" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'white')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>SERVICE TYPE *</label>
              <select
                name="serviceType"
                required
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => (e.target.style.borderColor = 'white')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              >
                <option value="">Select a service</option>
                <option value="INTERIOR">Interior Painting</option>
                <option value="EXTERIOR">Exterior Painting</option>
                <option value="EPOXY">Epoxy Floors</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>PROJECT DESCRIPTION *</label>
              <textarea
                name="description"
                required
                rows={5}
                placeholder="Describe the project, location, timeline, and any measurements you have..."
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = 'white')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {status === 'success' && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#4ade80', letterSpacing: '0.08em' }}>
                ✓ Received. We&apos;ll be in touch within one business day.
              </p>
            )}
            {status === 'error' && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#f87171', letterSpacing: '0.08em' }}>
                Something went wrong. Call us at (775) 386-3962.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em' }}
              className="bg-white text-black px-8 py-3.5 hover:bg-zinc-200 transition-colors uppercase self-start disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
