import { NextRequest, NextResponse } from 'next/server'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { generateSignedPDF } from '@/lib/docs/pdf'
import { sendSignedPDF } from '@/lib/docs/email'
import { renderChangeOrderHtml } from '@/lib/docs/change-order-template'

const DOCS_DIR = process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const changeOrder = await db.changeOrder.findFirst({
    where: { signingToken: token },
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
      acceptance: true,
    },
  })

  if (!changeOrder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (changeOrder.status === 'SIGNED') {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }

  if (changeOrder.signingTokenExpiresAt && changeOrder.signingTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 410 })
  }

  const body = await req.json()
  const { signature, signerName } = body

  if (!signature || typeof signature !== 'string' || !signerName || typeof signerName !== 'string') {
    return NextResponse.json({ error: 'Missing signature or signerName' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  mkdirSync(DOCS_DIR, { recursive: true })

  const sigPngPath = path.join(DOCS_DIR, `co-${token}-sig.png`)
  const base64Data = signature.replace(/^data:image\/png;base64,/, '')
  writeFileSync(sigPngPath, Buffer.from(base64Data, 'base64'))

  const primaryContact = changeOrder.quote.project.people[0]?.person
  const lineItems = changeOrder.lineItems as {
    label: string
    qty: number
    unit: string
    rate: number
    total: number
  }[]

  const changeOrderData = {
    changeOrderId: changeOrder.id,
    createdAt: changeOrder.createdAt,
    description: changeOrder.description,
    lineItems,
    delta: changeOrder.delta,
    newTotal: changeOrder.newTotal,
    notes: changeOrder.notes,
    quoteId: changeOrder.quote.id,
    quoteDate: changeOrder.quote.createdAt,
    quoteTotal: changeOrder.quote.total,
    clientName: primaryContact?.name ?? signerName,
    clientCompany: primaryContact?.company ?? null,
    clientEmail: primaryContact?.email ?? null,
    clientPhone: primaryContact?.phone ?? null,
    projectName: changeOrder.quote.project.name,
  }

  const html = renderChangeOrderHtml(changeOrderData)

  const signedPdfPath = path.join(DOCS_DIR, `co-${token}-signed.pdf`)
  await generateSignedPDF(html, signedPdfPath, signature)

  const acceptedAt = new Date()

  if (changeOrder.acceptance) {
    await db.acceptance.update({
      where: { id: changeOrder.acceptance.id },
      data: {
        signerName,
        signaturePngPath: sigPngPath,
        acceptedAt,
        ipAddress: ip,
      },
    })
  } else {
    await db.acceptance.create({
      data: {
        signerName,
        signaturePngPath: sigPngPath,
        acceptedAt,
        ipAddress: ip,
        changeOrderId: changeOrder.id,
      },
    })
  }

  await db.changeOrder.update({
    where: { id: changeOrder.id },
    data: {
      status: 'SIGNED',
      signedAt: acceptedAt,
      signedPdfPath,
    },
  })

  if (primaryContact?.email) {
    sendSignedPDF({
      toEmail: primaryContact.email,
      toName: primaryContact.name,
      projectName: changeOrder.quote.project.name,
      signedPdfPath,
      documentType: 'change order',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, signedAt: acceptedAt })
}
