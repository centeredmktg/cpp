import { db } from '@/lib/db'
import PricingEditor from './PricingEditor'
import EpoxyRatesEditor from './EpoxyRatesEditor'
import Link from 'next/link'

export default async function PricingPage() {
  const [baselines, epoxyRates] = await Promise.all([
    db.pricingBaseline.findMany({ orderBy: { key: 'asc' } }),
    db.epoxyRate.findMany({ orderBy: [{ jobType: 'asc' }, { systemLevel: 'asc' }] }),
  ])

  const paintingBaselines = baselines.filter(b => !b.key.startsWith('epoxy_'))
  const epoxyAddonBaselines = baselines.filter(b => b.key.startsWith('epoxy_'))

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/internal/projects"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
          className="hover:text-white mb-6 block"
        >
          ← Projects
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', letterSpacing: '0.03em', marginBottom: '2.5rem' }}>
          Pricing
        </h1>

        {/* Epoxy base rates */}
        <div className="mb-12">
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#fff', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
            EPOXY — BASE RATES ($/SF)
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
            Sell price per square foot by job type and system level.
          </p>
          <EpoxyRatesEditor initialRates={epoxyRates} />
        </div>

        {/* Epoxy add-on rates */}
        <div className="mb-12">
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#fff', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
            EPOXY — ADD-ON RATES
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
            Applied on top of the base rate when selected on a quote.
          </p>
          <PricingEditor initialBaselines={epoxyAddonBaselines} />
        </div>

        {/* Painting baselines */}
        <div className="mb-12">
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#fff', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
            PAINTING — BASELINES
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
            Reference rates passed to Claude when generating painting quotes.
          </p>
          <PricingEditor initialBaselines={paintingBaselines} />
        </div>
      </div>
    </div>
  )
}
