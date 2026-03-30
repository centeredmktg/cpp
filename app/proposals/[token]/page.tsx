import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import AcceptanceBlock from './AcceptanceBlock'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'Interior Painting',
  EXTERIOR: 'Exterior Painting',
  EPOXY: 'Epoxy Floors',
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const quote = await db.quote.findFirst({
    where: { signingToken: token },
    include: {
      project: { include: { people: { include: { person: true } } } },
      acceptance: true,
    },
  })

  if (!quote) notFound()

  if (quote.signingTokenExpiresAt && new Date() > quote.signingTokenExpiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111110', color: '#fff' }}>
        <div className="text-center">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Link Expired</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888884', marginTop: '0.5rem' }}>
            This signing link has expired. Please contact CPP Painting & Building for a new link.
          </p>
        </div>
      </div>
    )
  }

  const lineItems = quote.lineItems as unknown as LineItem[]
  const primaryPerson = quote.project.people[0]?.person
  const accepted = quote.status === 'SIGNED'
  const terms = quote.termsAndConditions

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: '0.03em', lineHeight: '1' }}>PROPOSAL</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginTop: '0.5rem' }}>
            #{quote.id.slice(-8).toUpperCase()} &middot; {new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10 pb-10" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FROM</p>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              <div style={{ fontWeight: 600 }}>CPP Painting & Building</div>
              <div style={{ color: '#888884' }}>Johnny Avila</div>
              <div style={{ color: '#888884' }}>(775) 386-3962</div>
              <div style={{ color: '#888884' }}>NV Lic. #0071837</div>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FOR</p>
            {primaryPerson ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ fontWeight: 600 }}>{primaryPerson.name}</div>
                {primaryPerson.company && <div style={{ color: '#888884' }}>{primaryPerson.company}</div>}
                {primaryPerson.email && <div style={{ color: '#888884' }}>{primaryPerson.email}</div>}
                {primaryPerson.phone && <div style={{ color: '#888884' }}>{primaryPerson.phone}</div>}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884' }}>{quote.project.name}</div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>
            {SERVICE_LABEL[quote.project.serviceType] ?? quote.project.serviceType}
          </span>
        </div>

        <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a28' }}>
              {['Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                <th key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', padding: '0.5rem 0.5rem', textAlign: h === 'Amount' || h === 'Rate' ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1c1c1a' }}>
                <td style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.qty.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#888884' }}>{item.unit}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right' }}>${item.rate.toFixed(2)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right', fontWeight: 500 }}>${item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col items-end gap-2 pb-8 mb-8" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div className="flex gap-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>SUBTOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.subtotal.toFixed(2)}</span>
          </div>
          {quote.tax && (
            <div className="flex gap-8">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>TAX</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex gap-8 pt-2" style={{ borderTop: '1px solid #2a2a28' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.total.toFixed(2)}</span>
          </div>
        </div>

        {quote.paymentTerms && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>PAYMENT TERMS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.paymentTerms}</p>
          </div>
        )}

        {quote.exclusions && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>EXCLUSIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.exclusions}</p>
          </div>
        )}

        {terms && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>TERMS & CONDITIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: '#555552', lineHeight: '1.8', whiteSpace: 'pre-line' }}>{terms}</p>
          </div>
        )}

        {quote.notes && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>NOTES</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.notes}</p>
          </div>
        )}

        <div className="mb-8 print:mb-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', lineHeight: '1.8' }}>
          <p>This proposal is valid for 30 days from issue date.</p>
          <p>CPP Painting & Building &middot; (775) 386-3962 &middot; NV Lic. #0071837</p>
        </div>

        <AcceptanceBlock
          documentType="proposal"
          token={token}
          accepted={accepted}
          signerName={quote.acceptance?.signerName}
          acceptedAt={quote.acceptance?.acceptedAt?.toISOString()}
        />
      </div>
    </div>
  )
}
