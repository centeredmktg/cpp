'use client'

import { useState, useEffect } from 'react'

const links = [
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
          background: scrolled ? 'rgba(17,17,16,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(8px)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex flex-col leading-none group">
            <span
              style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.05em', color: 'var(--fg)' }}
            >
              CPP
            </span>
            <span
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.15em', color: 'var(--muted)', marginTop: '-2px' }}
            >
              PAINTING & BUILDING
            </span>
          </a>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--muted)' }}
                  className="hover:text-white transition-colors uppercase"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#contact"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em' }}
                className="border border-white/30 text-white px-4 py-1.5 hover:bg-white hover:text-black transition-all uppercase"
              >
                Get a Quote
              </a>
            </li>
          </ul>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <span className={`block h-px w-6 bg-white transition-all duration-300 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-px w-6 bg-white transition-all duration-300 ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-px w-6 bg-white transition-all duration-300 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <ul className="flex flex-col items-center gap-10">
            {[...links, { label: 'Get a Quote', href: '#contact' }].map(l => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '0.05em' }}
                  className="text-white hover:text-zinc-400 transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em', marginTop: '3rem' }}>
            (775) 386-3962
          </div>
        </div>
      )}
    </>
  )
}
