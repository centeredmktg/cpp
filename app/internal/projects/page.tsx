import { db } from '@/lib/db'
import Link from 'next/link'

const COLUMNS = [
  { key: 'LEAD', label: 'Lead' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'CONTRACTED', label: 'Contracted' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETE', label: 'Complete' },
  { key: 'LOST', label: 'Lost' },
] as const

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'INT',
  EXTERIOR: 'EXT',
  EPOXY: 'EPX',
}

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { people: { include: { person: true } } },
  })

  const byStatus = Object.fromEntries(
    COLUMNS.map(c => [c.key, projects.filter(p => p.status === c.key)])
  )

  return (
    <div className="min-h-screen p-6" style={{ background: '#111110' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: '#fff', letterSpacing: '0.03em' }}>
          Projects
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/internal/settings/pricing"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
            className="hover:text-white uppercase"
          >
            Pricing
          </Link>
          <span style={{ color: '#2a2a28' }}>|</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>
            {projects.length} total
          </span>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const items = byStatus[col.key] ?? []
          return (
            <div key={col.key} className="flex-shrink-0 w-64 flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center justify-between px-1 mb-1">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em' }}>
                  {col.label.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#2a2a28' }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              {items.map(project => {
                const primaryPerson = project.people[0]?.person
                const value = project.revenue ?? null

                return (
                  <Link
                    key={project.id}
                    href={`/internal/projects/${project.id}`}
                    className="block p-4 hover:border-white transition-colors"
                    style={{ background: '#1c1c1a', border: '1px solid #2a2a28' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.1em', background: '#2a2a28', padding: '2px 6px' }}>
                        {SERVICE_LABEL[project.serviceType] ?? project.serviceType}
                      </span>
                      {value && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#fff' }}>
                          ${value.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#fff', lineHeight: '1.4', marginBottom: '0.5rem' }}>
                      {project.name}
                    </p>
                    {primaryPerson && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884' }}>
                        {primaryPerson.name}
                      </p>
                    )}
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#2a2a28', marginTop: '0.5rem' }}>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                )
              })}

              {items.length === 0 && (
                <div className="p-4" style={{ border: '1px dashed #2a2a28' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#2a2a28' }}>Empty</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
