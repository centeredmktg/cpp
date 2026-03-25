export default function Work() {
  const placeholders = Array.from({ length: 6 }, (_, i) => i)

  return (
    <section id="work" className="py-24" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-baseline gap-6 mb-16">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>
            OUR WORK
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {placeholders.map(i => (
            <div
              key={i}
              className="aspect-video flex items-end p-4"
              style={{ background: 'var(--subtle)', border: '1px solid var(--border)' }}
            >
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--border)', letterSpacing: '0.1em' }}
              >
                PROJECT {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>

        <p
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '2rem' }}
        >
          Photos coming soon. Call (775) 386-3962 for a portfolio walkthrough.
        </p>
      </div>
    </section>
  )
}
