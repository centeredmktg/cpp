import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const quotes = await db.quote.findMany({
    where: { projectId: id },
    select: { id: true, total: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quotes)
}
