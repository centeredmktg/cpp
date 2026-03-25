'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const services = [
  {
    id: '01',
    name: 'Interior Painting',
    description:
      'Walls, ceilings, trim, and millwork. We work alongside active construction schedules and return-ready timelines. Minimal disruption, maximum coverage.',
    callout: 'To quote: sq ft of walls, sq ft of ceilings, lineal ft of trim',
    type: 'INTERIOR',
  },
  {
    id: '02',
    name: 'Exterior Painting',
    description:
      'Full exterior systems including prep, prime, and finish coat. Siding, stucco, fascia, and decks. We handle HOA submittals and color matching.',
    callout: 'To quote: total sq ft of exterior surfaces',
    type: 'EXTERIOR',
  },
  {
    id: '03',
    name: 'Epoxy Floors',
    description:
      'High-build epoxy and polyaspartic coatings for garages, warehouses, retail, and residential. Prep-to-finish in 1–2 days.',
    callout: 'To quote: sq ft of floor area + concrete condition',
    type: 'EPOXY',
  },
]

export default function Services() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="services" ref={ref} className="py-24" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-baseline gap-6 mb-16">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.15em' }}>
            SERVICES
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
          {services.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="flex flex-col p-8"
              style={{ background: 'var(--bg)' }}
            >
              {/* Number */}
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em' }}
              >
                {s.id}
              </span>

              {/* Name */}
              <h3
                style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', letterSpacing: '0.03em', color: 'var(--fg)', lineHeight: '1', marginTop: '1rem' }}
              >
                {s.name}
              </h3>

              {/* Description */}
              <p
                style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: 'var(--muted)', lineHeight: '1.7', marginTop: '1rem', flexGrow: 1 }}
              >
                {s.description}
              </p>

              {/* Measurement callout */}
              <div
                className="mt-6 p-4"
                style={{ border: '1px solid var(--border)', background: 'var(--subtle)' }}
              >
                <p
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', letterSpacing: '0.08em', lineHeight: '1.6' }}
                >
                  ↳ {s.callout}
                </p>
              </div>

              {/* CTA */}
              <a
                href="#contact"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--muted)', marginTop: '1.5rem' }}
                className="hover:text-white transition-colors uppercase flex items-center gap-2"
              >
                Request Quote <span>→</span>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
