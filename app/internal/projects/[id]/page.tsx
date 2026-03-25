import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StatusSelector from './StatusSelector'

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'Interior Painting',
  EXTERIOR: 'Exterior Painting',
  EPOXY: 'Epoxy Floors',
}

const ROLE_LABEL: Record<string, string> = {
  HOMEOWNER: 'Homeowner',
  PROPERTY_OWNER: 'Property Owner',
  PROPERTY_MANAGER: 'Property Manager',
  GENERAL_CONTRACTOR: 'General Contractor',
  OTHER: 'Other',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({
    where: { id },
    include: {
      people: { include: { person: true } },
      quotes: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!project) notFound()

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div key={label} className="flex gap-6 py-3" style={{ borderBottom: '1px solid #2a2a28' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.1em', minWidth: '100px', paddingTop: '2px' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#fff' }}>{value}</span>
      </div>
    ) : null

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/internal/projects"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
          className="hover:text-white mb-4 block"
        >
          ← Projects
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.1em' }}>
              {SERVICE_LABEL[project.serviceType] ?? project.serviceType}
            </span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', letterSpacing: '0.03em', marginTop: '0.25rem' }}>
              {project.name}
            </h1>
          </div>
          <StatusSelector projectId={project.id} currentStatus={project.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: project details */}
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
              PROJECT DETAILS
            </p>
            <div>
              {row('Received', new Date(project.receivedAt).toLocaleDateString())}
              {row('Start', project.startDate ? new Date(project.startDate).toLocaleDateString() : null)}
              {row('Target', project.targetDate ? new Date(project.targetDate).toLocaleDateString() : null)}
              {row('Completed', project.completedAt ? new Date(project.completedAt).toLocaleDateString() : null)}
              {row('Revenue', project.revenue ? `$${project.revenue.toLocaleString()}` : null)}
              {row('Cost', project.cost ? `$${project.cost.toLocaleString()}` : null)}
              {project.description && row('Description', project.description)}
              {project.notes && row('Notes', project.notes)}
            </div>

            {/* People */}
            {project.people.length > 0 && (
              <div className="mt-8">
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
                  CONTACTS
                </p>
                {project.people.map(pop => (
                  <div key={pop.personId} className="p-4 mb-2" style={{ border: '1px solid #2a2a28' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#fff' }}>
                        {pop.person.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.1em' }}>
                        {ROLE_LABEL[pop.role] ?? pop.role}
                      </span>
                    </div>
                    {pop.person.email && (
                      <a href={`mailto:${pop.person.email}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884' }} className="block hover:text-white">
                        {pop.person.email}
                      </a>
                    )}
                    {pop.person.phone && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', display: 'block' }}>
                        {pop.person.phone}
                      </span>
                    )}
                    {pop.person.company && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', display: 'block' }}>
                        {pop.person.company}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: quotes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em' }}>
                QUOTES
              </p>
              <Link
                href={`/internal/projects/${project.id}/quote/new`}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: '#fff', border: '1px solid #2a2a28', padding: '0.3rem 0.75rem' }}
                className="hover:border-white transition-colors uppercase"
              >
                + New Quote
              </Link>
            </div>

            {project.quotes.length === 0 ? (
              <div className="p-6 text-center" style={{ border: '1px dashed #2a2a28' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884' }}>No quotes yet</span>
              </div>
            ) : (
              project.quotes.map(q => (
                <Link
                  key={q.id}
                  href={`/internal/quotes/${q.id}`}
                  className="block p-4 mb-2 hover:border-white transition-colors"
                  style={{ border: '1px solid #2a2a28' }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884' }}>
                      {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: '#fff' }}>
                      ${q.total.toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
