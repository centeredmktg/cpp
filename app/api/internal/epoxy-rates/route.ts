import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rates = await db.epoxyRate.findMany({ orderBy: [{ jobType: 'asc' }, { systemLevel: 'asc' }] })
  return NextResponse.json(rates)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, rate } = await req.json()
  if (!id || typeof rate !== 'number' || rate < 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const updated = await db.epoxyRate.update({ where: { id }, data: { rate } })
  return NextResponse.json(updated)
}
