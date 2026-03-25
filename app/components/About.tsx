export default function About() {
  return (
    <section id="about" className="py-24" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-baseline gap-6 mb-16">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>
            ABOUT
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left: name block */}
          <div>
            <h2
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', letterSpacing: '0.03em', lineHeight: '1', color: 'var(--fg)' }}
            >
              Johnny Avila
            </h2>
            <p
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em', color: 'var(--muted)', marginTop: '0.75rem' }}
            >
              QUALIFIER · FOUNDER · LICENSED CONTRACTOR
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {[
                ['License', 'NV Contractors Board #0071837'],
                ['Coverage', 'General Liability + Workers Comp'],
                ['Specialty', 'Production & Commercial Work'],
                ['Territory', 'Reno / Sparks / Northern Nevada'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.1em', minWidth: '72px', paddingTop: '2px' }}>
                    {k}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: 'var(--fg)' }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: copy */}
          <div className="flex flex-col gap-5">
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.8' }}>
              CPP Painting & Building has been operating in the Reno market for over 15 years. We built our reputation on volume production work — apartment turns, new construction phases, and commercial interiors — where schedule reliability and consistent quality matter more than anything else.
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.8' }}>
              Johnny Avila holds the qualifying license and is on every job. We&apos;re not a general contractor with subs — we self-perform all painting and epoxy work with our own crews. That&apos;s what keeps callbacks near zero.
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: 'var(--muted)', lineHeight: '1.8' }}>
              We work directly with general contractors, property managers, and developers. Owners welcome too. If you need a fast, accurate bid, call us — we turn around most quotes in 24–48 hours.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
