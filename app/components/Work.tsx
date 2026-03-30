const projects = [
  {
    src: '/photos/631677988_122189339552438467_755286691237048046_n.jpg',
    label: 'Commercial Exterior',
    category: 'EXTERIOR',
  },
  {
    src: '/photos/636968300_122190282218438467_2213091573843360739_n.jpg',
    label: 'Ornamental Iron — Finish',
    category: 'PAINTING',
  },
  {
    src: '/photos/631861778_122189295872438467_5152028198378439901_n.jpg',
    label: 'Interior Demo & Prep',
    category: 'INTERIOR',
  },
  {
    src: '/photos/632235922_122189339588438467_3391486058955594104_n.jpg',
    label: 'Commercial Exterior — Rear',
    category: 'EXTERIOR',
  },
  {
    src: '/photos/639973733_122190282824438467_4440928111907343242_n.jpg',
    label: 'Ornamental Iron — Primer',
    category: 'PAINTING',
  },
  {
    src: '/photos/632617857_122189295860438467_3954477696704591409_n.jpg',
    label: 'Interior Renovation',
    category: 'INTERIOR',
  },
]

export default function Work() {
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
          {projects.map((p, i) => (
            <div
              key={i}
              className="relative aspect-video overflow-hidden group"
              style={{ background: 'var(--subtle)' }}
            >
              <img
                src={p.src}
                alt={p.label}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100">
                <span
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--muted)', letterSpacing: '0.12em' }}
                >
                  {p.category}
                </span>
                <span
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#fff', marginTop: '2px' }}
                >
                  {p.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
