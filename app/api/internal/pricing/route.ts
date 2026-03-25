import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const baselines = await db.pricingBaseline.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json(baselines)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, rate } = await req.json()
  if (!id || typeof rate !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updated = await db.pricingBaseline.update({
    where: { id },
    data: { rate },
  })
  return NextResponse.json(updated)
}
