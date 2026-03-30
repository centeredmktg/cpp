import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { DEFAULT_PAYMENT_TERMS, DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/defaults'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, lineItems, subtotal, total, notes, paymentTerms, exclusions, termsAndConditions } = await req.json()

  if (!projectId || !lineItems || !subtotal || !total) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const quote = await db.quote.create({
    data: {
      projectId,
      lineItems,
      subtotal,
      total,
      notes: notes || null,
      paymentTerms: paymentTerms || DEFAULT_PAYMENT_TERMS,
      exclusions: exclusions || null,
      termsAndConditions: termsAndConditions || DEFAULT_TERMS_AND_CONDITIONS,
      status: 'DRAFT',
    },
  })

  await db.project.update({
    where: { id: projectId },
    data: { status: 'QUOTED' },
  })

  return NextResponse.json({ quoteId: quote.id })
}
