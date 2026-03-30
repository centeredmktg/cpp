import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendSigningLink } from '@/lib/docs/email'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          people: {
            include: { person: true },
          },
        },
      },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (quote.status === 'SIGNED') {
    return NextResponse.json({ error: 'Quote already signed' }, { status: 409 })
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.quote.update({
    where: { id },
    data: {
      status: 'SENT',
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const signingUrl = `${baseUrl}/proposals/${token}`

  const primaryContact = quote.project.people[0]?.person
  if (primaryContact?.email) {
    sendSigningLink({
      toEmail: primaryContact.email,
      toName: primaryContact.name,
      projectName: quote.project.name,
      signingUrl,
      documentType: 'proposal',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, token, signingUrl })
}
