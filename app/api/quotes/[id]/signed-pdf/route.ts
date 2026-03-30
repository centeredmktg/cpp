import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const DOCS_DIR = process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const quote = await db.quote.findUnique({ where: { id } })

  if (!quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!quote.signedPdfPath) {
    return NextResponse.json({ error: 'No signed PDF available' }, { status: 404 })
  }

  const resolvedPath = path.resolve(quote.signedPdfPath)
  const resolvedDocsDir = path.resolve(DOCS_DIR)

  if (!resolvedPath.startsWith(resolvedDocsDir + path.sep) && resolvedPath !== resolvedDocsDir) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let fileBuffer: Buffer
  try {
    fileBuffer = readFileSync(resolvedPath)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CPP-Proposal-Signed-${id}.pdf"`,
    },
  })
}
