import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { quoteId, description, lineItems, notes } = await req.json()

  if (!quoteId || !description || !lineItems || !Array.isArray(lineItems)) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { changeOrders: { where: { status: 'SIGNED' } } },
  })

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const delta = lineItems.reduce((sum: number, item: any) => sum + (item.total ?? 0), 0)
  const priorDeltas = quote.changeOrders.reduce((sum, co) => sum + co.delta, 0)
  const newTotal = quote.total + priorDeltas + delta

  const changeOrder = await db.changeOrder.create({
    data: {
      quoteId,
      description,
      lineItems,
      delta,
      newTotal,
      notes: notes || null,
      status: 'DRAFT',
    },
  })

  return NextResponse.json({ changeOrderId: changeOrder.id })
}
