export default function Footer() {
  return (
    <footer className="py-12" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          {/* Logo + tagline */}
          <div>
            <div
              style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.05em', color: 'var(--fg)', lineHeight: '1' }}
            >
              CPP
            </div>
            <div
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.15em', color: 'var(--muted)', marginTop: '2px' }}
            >
              PAINTING & BUILDING
            </div>
          </div>

          {/* Contact info */}
          <div className="flex flex-col gap-2">
            {[
              '(775) 386-3962',
              'johnny@cpppainting.com',
              'Reno, NV',
            ].map(v => (
              <span key={v} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.08em' }}>
                {v}
              </span>
            ))}
          </div>

          {/* License */}
          <div className="flex flex-col gap-2">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.08em' }}>
              NV Lic. #0071837
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Licensed · Bonded · Insured
            </span>
            <a
              href="/internal"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--border)', letterSpacing: '0.08em', marginTop: '0.5rem' }}
              className="hover:text-zinc-600 transition-colors"
            >
              Admin
            </a>
          </div>
        </div>

        <p
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--border)', letterSpacing: '0.08em', marginTop: '3rem' }}
        >
          © {new Date().getFullYear()} CPP Painting & Building. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
