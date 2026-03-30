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

  const changeOrder = await db.changeOrder.findUnique({
    where: { id },
    include: {
      quote: {
        include: {
          project: {
            include: {
              people: {
                include: { person: true },
              },
            },
          },
        },
      },
    },
  })

  if (!changeOrder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (changeOrder.status === 'SIGNED') {
    return NextResponse.json({ error: 'Change order already signed' }, { status: 409 })
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.changeOrder.update({
    where: { id },
    data: {
      status: 'SENT',
      signingToken: token,
      signingTokenExpiresAt: expiresAt,
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const signingUrl = `${baseUrl}/change-orders/${token}`

  const primaryContact = changeOrder.quote.project.people[0]?.person
  if (primaryContact?.email) {
    sendSigningLink({
      toEmail: primaryContact.email,
      toName: primaryContact.name,
      projectName: changeOrder.quote.project.name,
      signingUrl,
      documentType: 'change order',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, token, signingUrl })
}
