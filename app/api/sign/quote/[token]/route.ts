import { NextRequest, NextResponse } from 'next/server'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { generateSignedPDF } from '@/lib/docs/pdf'
import { sendSignedPDF } from '@/lib/docs/email'
import { renderProposalHtml } from '@/lib/docs/proposal-template'

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

  const quote = await db.quote.findFirst({
    where: { signingToken: token },
    include: {
      project: {
        include: {
          people: {
            include: { person: true },
          },
        },
      },
      acceptance: true,
    },
  })

  if (!quote) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (quote.status === 'SIGNED') {
    return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  }

  if (quote.signingTokenExpiresAt && quote.signingTokenExpiresAt < new Date()) {
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

  const sigPngPath = path.join(DOCS_DIR, `${token}-sig.png`)
  const base64Data = signature.replace(/^data:image\/png;base64,/, '')
  writeFileSync(sigPngPath, Buffer.from(base64Data, 'base64'))

  const primaryContact = quote.project.people[0]?.person
  const lineItems = quote.lineItems as {
    label: string
    qty: number
    unit: string
    rate: number
    total: number
  }[]

  const proposalData = {
    quoteId: quote.id,
    createdAt: quote.createdAt,
    serviceType: quote.project.serviceType,
    lineItems,
    subtotal: quote.subtotal,
    tax: quote.tax ?? null,
    total: quote.total,
    paymentTerms: quote.paymentTerms ?? null,
    exclusions: quote.exclusions ?? null,
    termsAndConditions: quote.termsAndConditions ?? null,
    notes: quote.notes ?? null,
    clientName: primaryContact?.name ?? signerName,
    clientCompany: primaryContact?.company ?? null,
    clientEmail: primaryContact?.email ?? null,
    clientPhone: primaryContact?.phone ?? null,
    projectName: quote.project.name,
  }

  const html = renderProposalHtml(proposalData)

  const signedPdfPath = path.join(DOCS_DIR, `${token}-signed.pdf`)
  await generateSignedPDF(html, signedPdfPath, signature)

  const acceptedAt = new Date()

  if (quote.acceptance) {
    await db.acceptance.update({
      where: { id: quote.acceptance.id },
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
        quoteId: quote.id,
      },
    })
  }

  await db.quote.update({
    where: { id: quote.id },
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
      projectName: quote.project.name,
      signedPdfPath,
      documentType: 'proposal',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, signedAt: acceptedAt })
}
