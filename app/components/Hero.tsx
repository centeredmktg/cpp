'use client'

import { motion } from 'framer-motion'

const stats = [
  { value: '15+', label: 'Years in Business' },
  { value: '2M+', label: 'Sq Ft Painted' },
  { value: 'LIC #', label: '0071837 · Insured' },
]

const ticker = [
  'Interior Paint',
  'Exterior Paint',
  'Epoxy Floors',
  'Interior Paint',
  'Exterior Paint',
  'Epoxy Floors',
]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

const item = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex flex-col justify-between"
      style={{ minHeight: '100svh', paddingTop: '4rem' }}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/photos/633060646_122189339612438467_3360463541866408099_n.jpg"
          alt="CPP commercial exterior project"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(17,17,16,0.95) 0%, rgba(17,17,16,0.8) 50%, rgba(17,17,16,0.6) 100%)' }} />
      </div>

      {/* Thin vertical line accent */}
      <div
        className="absolute left-6 top-24 bottom-24 w-px hidden lg:block"
        style={{ background: 'var(--border)' }}
      />

      {/* Main content */}
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 w-full flex flex-col justify-center flex-1 py-16"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Preheader */}
        <motion.p
          variants={item}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--muted)' }}
          className="uppercase mb-6"
        >
          Reno, NV · Production Contractor
        </motion.p>

        {/* Headline */}
        <motion.h1
          variants={item}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 10vw, 9rem)',
            lineHeight: '0.92',
            letterSpacing: '0.02em',
            color: 'var(--fg)',
            maxWidth: '900px',
          }}
        >
          Production-Grade
          <br />
          Painting &
          <br />
          <span style={{ color: 'var(--muted)' }}>Epoxy Floors.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={item}
          style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', color: 'var(--muted)', maxWidth: '480px', lineHeight: '1.6' }}
          className="mt-8"
        >
          Built for builders, property managers, and developers who need work done right. No fuss, no callbacks.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={item} className="flex gap-4 mt-10 flex-wrap">
          <a
            href="#contact"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em' }}
            className="bg-white text-black px-8 py-3.5 hover:bg-zinc-200 transition-colors uppercase"
          >
            Get a Quote
          </a>
          <a
            href="#work"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.1em', border: '1px solid var(--border)', color: 'var(--muted)' }}
            className="px-8 py-3.5 hover:border-white hover:text-white transition-colors uppercase"
          >
            Our Work
          </a>
        </motion.div>

        {/* Stat bar */}
        <motion.div
          variants={item}
          className="mt-16 pt-8 flex gap-10 flex-wrap"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {stats.map(s => (
            <div key={s.label}>
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', color: 'var(--fg)', fontWeight: 500 }}
              >
                {s.value}
              </div>
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em', marginTop: '4px' }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Service ticker */}
      <div
        className="relative z-10 overflow-hidden py-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="ticker-track">
          {[...ticker, ...ticker].map((t, i) => (
            <span
              key={i}
              style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.08em', color: 'var(--muted)', paddingRight: '4rem' }}
            >
              {t} ·
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
