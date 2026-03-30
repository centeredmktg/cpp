# CPP Signable Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add signable proposals, signed PDF generation, and change order lifecycle to the CPP quote system.

**Architecture:** Extend the existing Quote model with signing fields and status tracking. New public routes for token-gated signing views. Puppeteer generates signed PDFs. Resend delivers emails. Change orders link to quotes and track cumulative deltas. The signed quote is the contract.

**Tech Stack:** Next.js 16, Prisma/Postgres, signature_pad (canvas signatures), Puppeteer (PDF generation), Resend (email)

**Spec:** `docs/superpowers/specs/2026-03-29-signable-documents-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `lib/docs/pdf.ts` | Puppeteer PDF generation (signed + unsigned) |
| `lib/docs/proposal-template.ts` | Server-only HTML template for proposal PDFs |
| `lib/docs/change-order-template.ts` | Server-only HTML template for CO PDFs |
| `lib/docs/email.ts` | Email sending functions (signing links + signed PDFs) |
| `lib/defaults.ts` | Default terms & conditions text |
| `app/proposals/[token]/page.tsx` | Public proposal signing view (server component) |
| `app/proposals/[token]/AcceptanceBlock.tsx` | Client component: signature pad + submit |
| `app/change-orders/[token]/page.tsx` | Public change order signing view |
| `app/change-orders/[token]/ChangeOrderSigningBlock.tsx` | Client component: CO signature pad |
| `app/api/sign/quote/[token]/route.ts` | POST: process quote signature, generate PDF, email |
| `app/api/sign/change-order/[token]/route.ts` | POST: process CO signature, generate PDF, email |
| `app/api/quotes/[id]/send/route.ts` | POST: generate token, email signing link |
| `app/api/quotes/[id]/signed-pdf/route.ts` | GET: download signed PDF (auth required) |
| `app/api/internal/change-orders/route.ts` | POST: create change order |
| `app/api/change-orders/[id]/send/route.ts` | POST: generate CO token, email signing link |
| `app/internal/projects/[id]/change-order/new/page.tsx` | Internal: create change order form |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | New enums, models, Quote fields |
| `app/api/internal/quote/save/route.ts` | Accept paymentTerms, exclusions, termsAndConditions |
| `app/internal/projects/[id]/quote/new/page.tsx` | Add payment terms + exclusions fields |
| `app/internal/quotes/[id]/page.tsx` | Upgrade to styled proposal view with send/sign actions |
| `app/internal/projects/[id]/page.tsx` | Add change order section with running total |
| `package.json` | Add signature_pad, puppeteer |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install signature_pad and puppeteer**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npm install signature_pad puppeteer
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
node -e "require('signature_pad'); require('puppeteer'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add package.json package-lock.json
git commit -m "chore: add signature_pad and puppeteer dependencies"
```

---

## Task 2: Schema Changes + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums, new Quote fields, Acceptance model, and ChangeOrder model**

In `prisma/schema.prisma`, add two new enums after the existing `ProjectStatus` enum:

```prisma
enum QuoteStatus {
  DRAFT
  SENT
  SIGNED
}

enum ChangeOrderStatus {
  DRAFT
  SENT
  SIGNED
}
```

Replace the existing `Quote` model with:

```prisma
model Quote {
  id                    String       @id @default(cuid())
  createdAt             DateTime     @default(now())
  project               Project      @relation(fields: [projectId], references: [id])
  projectId             String
  lineItems             Json
  subtotal              Float
  tax                   Float?
  total                 Float
  notes                 String?
  status                QuoteStatus  @default(DRAFT)
  paymentTerms          String?
  exclusions            String?
  termsAndConditions    String?
  signingToken          String?      @unique
  signingTokenExpiresAt DateTime?
  signedAt              DateTime?
  signedPdfPath         String?
  acceptance            Acceptance?
  changeOrders          ChangeOrder[]
}
```

Add after the `EpoxyRate` model:

```prisma
model Acceptance {
  id               String       @id @default(cuid())
  signerName       String
  acceptedAt       DateTime
  ipAddress        String
  signaturePngPath String
  quote            Quote?       @relation(fields: [quoteId], references: [id])
  quoteId          String?      @unique
  changeOrder      ChangeOrder? @relation(fields: [changeOrderId], references: [id])
  changeOrderId    String?      @unique
}

model ChangeOrder {
  id                    String            @id @default(cuid())
  createdAt             DateTime          @default(now())
  quote                 Quote             @relation(fields: [quoteId], references: [id])
  quoteId               String
  description           String
  lineItems             Json
  delta                 Float
  newTotal              Float
  status                ChangeOrderStatus @default(DRAFT)
  notes                 String?
  signingToken          String?           @unique
  signingTokenExpiresAt DateTime?
  signedAt              DateTime?
  signedPdfPath         String?
  acceptance            Acceptance?
}
```

- [ ] **Step 2: Generate Prisma client and create migration**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx prisma migrate dev --name add-signable-documents
```

Expected: Migration created and applied successfully. Prisma client regenerated.

- [ ] **Step 3: Verify the schema compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx prisma validate
```

Expected: `The schema is valid.` (or similar success message)

- [ ] **Step 4: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add prisma/ app/generated/
git commit -m "feat: add schema for signable documents and change orders"
```

---

## Task 3: Default Terms & PDF Utilities

**Files:**
- Create: `lib/defaults.ts`
- Create: `lib/docs/pdf.ts`

- [ ] **Step 1: Create lib/defaults.ts with default terms text**

```typescript
// lib/defaults.ts

export const DEFAULT_TERMS_AND_CONDITIONS = `A. Interest of 1.5% per month on overdue accounts.
B. Any alteration from above specifications will be charged via written change order.
C. All agreements contingent upon strikes, accidents, or delays beyond our control.
D. Warranty void by act of God or non-payment. Coverage begins at final payment.
E. Unforeseen conditions not included. Additional fees added via change order.
F. Payment due net 30 from invoice date.`

export const DEFAULT_PAYMENT_TERMS = '50% deposit due before work begins. Balance due upon completion.'
```

- [ ] **Step 2: Create lib/docs/pdf.ts**

```typescript
// lib/docs/pdf.ts
import 'server-only'
import puppeteer from 'puppeteer'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

export async function generateSignedPDF(
  documentHtml: string,
  outputPath: string,
  signaturePng: string,
): Promise<void> {
  const signedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const signatureBlock = `
<div style="margin-top:48px;padding:24px;border:1px solid #ccc;border-radius:4px;">
  <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Electronic Signature</p>
  <p style="color:#555;font-size:0.85em;">Signed on ${signedAt}</p>
  <img src="${signaturePng}" style="max-width:360px;border:1px solid #ccc;display:block;margin-top:8px;" alt="Signature" />
</div>`

  const signedHtml = documentHtml.replace('</body>', `${signatureBlock}\n</body>`)

  mkdirSync(dirname(outputPath), { recursive: true })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(signedHtml, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
    })
  } finally {
    await browser.close()
  }
}

export async function generatePDF(
  documentHtml: string,
  outputPath: string,
): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true })

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(documentHtml, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
    })
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add lib/defaults.ts lib/docs/pdf.ts
git commit -m "feat: add default terms and PDF generation utilities"
```

---

## Task 4: Email Utilities

**Files:**
- Create: `lib/docs/email.ts`

- [ ] **Step 1: Create lib/docs/email.ts**

```typescript
// lib/docs/email.ts
import 'server-only'
import { Resend } from 'resend'
import { readFileSync } from 'fs'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'CPP Painting & Building <noreply@cpppainting.com>'
const BCC = process.env.RESEND_BCC ?? undefined

function signingLinkHtml(
  firstName: string,
  projectName: string,
  signingUrl: string,
  documentType: 'proposal' | 'change order',
): string {
  return `
<div style="font-family:sans-serif;color:#111;max-width:520px;margin:0 auto;padding:32px 0;">
  <p>Hi ${firstName},</p>
  <p>Please review and sign the ${documentType} for <strong>${projectName}</strong>:</p>
  <p style="margin:24px 0;">
    <a href="${signingUrl}" style="display:inline-block;background:#111110;color:#fff;text-decoration:none;padding:12px 28px;font-size:14px;letter-spacing:0.05em;">
      Review &amp; Sign ${documentType === 'proposal' ? 'Proposal' : 'Change Order'}
    </a>
  </p>
  <p style="color:#888;font-size:13px;">This link expires in 30 days.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
  <p style="color:#888;font-size:12px;">
    CPP Painting &amp; Building<br/>
    (775) 386-3962
  </p>
</div>`
}

export async function sendSigningLink(opts: {
  toEmail: string
  toName: string
  projectName: string
  signingUrl: string
  documentType: 'proposal' | 'change order'
}): Promise<void> {
  const firstName = opts.toName.split(' ')[0]
  const label = opts.documentType === 'proposal' ? 'Proposal' : 'Change Order'

  await resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    bcc: BCC,
    subject: `${label} from CPP Painting & Building — ${opts.projectName}`,
    html: signingLinkHtml(firstName, opts.projectName, opts.signingUrl, opts.documentType),
  })
}

export async function sendSignedPDF(opts: {
  toEmail: string
  toName: string
  projectName: string
  signedPdfPath: string
  documentType: 'proposal' | 'change order'
}): Promise<void> {
  const label = opts.documentType === 'proposal' ? 'Proposal' : 'Change Order'
  const pdfBuffer = readFileSync(opts.signedPdfPath)

  await resend.emails.send({
    from: FROM,
    to: opts.toEmail,
    bcc: BCC,
    subject: `Signed ${label} — ${opts.projectName}`,
    html: `
<div style="font-family:sans-serif;color:#111;max-width:520px;margin:0 auto;padding:32px 0;">
  <p>Your signed ${opts.documentType} for <strong>${opts.projectName}</strong> is attached.</p>
  <p>We look forward to working with you.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
  <p style="color:#888;font-size:12px;">
    CPP Painting &amp; Building<br/>
    (775) 386-3962
  </p>
</div>`,
    attachments: [
      {
        filename: `CPP-${label.replace(' ', '-')}-Signed.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add lib/docs/email.ts
git commit -m "feat: add email utilities for signing links and signed PDFs"
```

---

## Task 5: Proposal HTML Template

**Files:**
- Create: `lib/docs/proposal-template.ts`

- [ ] **Step 1: Create lib/docs/proposal-template.ts**

This is a server-only HTML renderer for the proposal PDF. White background, dark text (inverted from site theme for print).

```typescript
// lib/docs/proposal-template.ts
import 'server-only'
import { DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/defaults'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

interface ProposalData {
  quoteId: string
  createdAt: Date
  serviceType: string
  lineItems: LineItem[]
  subtotal: number
  tax: number | null
  total: number
  paymentTerms: string | null
  exclusions: string | null
  termsAndConditions: string | null
  notes: string | null
  clientName: string | null
  clientCompany: string | null
  clientEmail: string | null
  clientPhone: string | null
  projectName: string
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'Interior Painting',
  EXTERIOR: 'Exterior Painting',
  EPOXY: 'Epoxy Floors',
}

export function renderProposalHtml(data: ProposalData): string {
  const dateStr = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const terms = data.termsAndConditions ?? DEFAULT_TERMS_AND_CONDITIONS

  const lineItemsHtml = data.lineItems
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px 12px;font-size:13px;">${esc(item.label)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${item.qty.toLocaleString()}</td>
      <td style="padding:8px 12px;font-size:13px;color:#888;">${esc(item.unit)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">$${item.rate.toFixed(2)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:500;">$${item.total.toFixed(2)}</td>
    </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 14px; line-height: 1.5; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #888; margin-bottom: 4px; }
  .divider { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; padding: 8px 12px; border-bottom: 1px solid #ddd; }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #ddd;">
    <div>
      <h1 style="margin:0;font-size:20px;font-weight:700;">CPP Painting & Building</h1>
      <p style="color:#888;font-size:12px;margin:4px 0 0;">Johnny Avila &middot; (775) 386-3962 &middot; NV Lic. #0071837</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:20px;font-weight:700;margin:0;letter-spacing:0.05em;">PROPOSAL</p>
      <p style="color:#888;font-size:12px;margin:4px 0 0;">#${esc(data.quoteId.slice(-8).toUpperCase())} &middot; ${dateStr}</p>
    </div>
  </div>

  <!-- From / To -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #ddd;">
    <div>
      <p class="label">FROM</p>
      <p style="font-weight:600;margin:0;">CPP Painting & Building</p>
      <p style="color:#888;font-size:13px;margin:2px 0 0;">Johnny Avila</p>
      <p style="color:#888;font-size:13px;margin:2px 0 0;">(775) 386-3962</p>
      <p style="color:#888;font-size:13px;margin:2px 0 0;">NV Lic. #0071837</p>
    </div>
    <div>
      <p class="label">FOR</p>
      ${data.clientName ? `<p style="font-weight:600;margin:0;">${esc(data.clientName)}</p>` : ''}
      ${data.clientCompany ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientCompany)}</p>` : ''}
      ${data.clientEmail ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientEmail)}</p>` : ''}
      ${data.clientPhone ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientPhone)}</p>` : ''}
      ${!data.clientName ? `<p style="font-weight:600;margin:0;">${esc(data.projectName)}</p>` : ''}
    </div>
  </div>

  <!-- Service type -->
  <p class="label">${esc(SERVICE_LABEL[data.serviceType] ?? data.serviceType)}</p>

  <!-- Line items -->
  <table style="margin:16px 0 24px;">
    <thead>
      <tr>
        <th style="text-align:left;">Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:left;">Unit</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="text-align:right;margin-bottom:24px;">
    <div style="display:inline-flex;flex-direction:column;gap:4px;">
      <div style="display:flex;justify-content:space-between;gap:32px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em;">Subtotal</span>
        <span style="font-size:14px;">$${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.tax ? `
      <div style="display:flex;justify-content:space-between;gap:32px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em;">Tax</span>
        <span style="font-size:14px;">$${data.tax.toFixed(2)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;gap:32px;border-top:1px solid #ddd;padding-top:8px;margin-top:4px;">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Total</span>
        <span style="font-size:18px;font-weight:700;">$${data.total.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <hr class="divider">

  <!-- Payment terms -->
  ${data.paymentTerms ? `
  <div style="margin-bottom:20px;">
    <p class="label" style="margin-bottom:6px;">Payment Terms</p>
    <p style="font-size:13px;color:#444;">${esc(data.paymentTerms)}</p>
  </div>` : ''}

  <!-- Exclusions -->
  ${data.exclusions ? `
  <div style="margin-bottom:20px;">
    <p class="label" style="margin-bottom:6px;">Exclusions</p>
    <p style="font-size:13px;color:#444;">${esc(data.exclusions)}</p>
  </div>` : ''}

  <!-- Terms & Conditions -->
  <div style="margin-bottom:20px;">
    <p class="label" style="margin-bottom:6px;">Terms & Conditions</p>
    <div style="font-size:12px;color:#555;white-space:pre-line;">${esc(terms)}</div>
  </div>

  <!-- Notes -->
  ${data.notes ? `
  <div style="margin-bottom:20px;">
    <p class="label" style="margin-bottom:6px;">Notes</p>
    <p style="font-size:13px;color:#444;">${esc(data.notes)}</p>
  </div>` : ''}

  <!-- Signature area (replaced by actual signature in signed PDF) -->
  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #ddd;">
    <p style="font-size:12px;color:#888;">By signing below, you authorize CPP Painting & Building to proceed with the above scope and agree to the stated terms.</p>
  </div>
</body>
</html>`
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add lib/docs/proposal-template.ts
git commit -m "feat: add proposal HTML template for PDF generation"
```

---

## Task 6: Change Order HTML Template

**Files:**
- Create: `lib/docs/change-order-template.ts`

- [ ] **Step 1: Create lib/docs/change-order-template.ts**

```typescript
// lib/docs/change-order-template.ts
import 'server-only'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

interface ChangeOrderData {
  changeOrderId: string
  createdAt: Date
  description: string
  lineItems: LineItem[]
  delta: number
  newTotal: number
  notes: string | null
  // Original quote reference
  quoteId: string
  quoteDate: Date
  quoteTotal: number
  // Client info
  clientName: string | null
  clientCompany: string | null
  clientEmail: string | null
  clientPhone: string | null
  projectName: string
}

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderChangeOrderHtml(data: ChangeOrderData): string {
  const dateStr = new Date(data.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const quoteDateStr = new Date(data.quoteDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lineItemsHtml = data.lineItems
    .map(
      (item) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px 12px;font-size:13px;">${esc(item.label)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${item.qty.toLocaleString()}</td>
      <td style="padding:8px 12px;font-size:13px;color:#888;">${esc(item.unit)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">$${item.rate.toFixed(2)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:500;">$${item.total >= 0 ? '' : '-'}$${Math.abs(item.total).toFixed(2)}</td>
    </tr>`,
    )
    .join('')

  const deltaSign = data.delta >= 0 ? '+' : '-'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 48px 32px; font-size: 14px; line-height: 1.5; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #888; margin-bottom: 4px; }
  .divider { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #888; padding: 8px 12px; border-bottom: 1px solid #ddd; }
</style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #ddd;">
    <div>
      <h1 style="margin:0;font-size:20px;font-weight:700;">CPP Painting & Building</h1>
      <p style="color:#888;font-size:12px;margin:4px 0 0;">Johnny Avila &middot; (775) 386-3962 &middot; NV Lic. #0071837</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:20px;font-weight:700;margin:0;letter-spacing:0.05em;">CHANGE ORDER</p>
      <p style="color:#888;font-size:12px;margin:4px 0 0;">#${esc(data.changeOrderId.slice(-8).toUpperCase())} &middot; ${dateStr}</p>
    </div>
  </div>

  <!-- Reference -->
  <p style="font-size:13px;color:#555;margin-bottom:24px;">
    Amendment to Proposal <strong>#${esc(data.quoteId.slice(-8).toUpperCase())}</strong> dated ${quoteDateStr}
  </p>

  <!-- From / To -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #ddd;">
    <div>
      <p class="label">FROM</p>
      <p style="font-weight:600;margin:0;">CPP Painting & Building</p>
      <p style="color:#888;font-size:13px;margin:2px 0 0;">Johnny Avila</p>
      <p style="color:#888;font-size:13px;margin:2px 0 0;">(775) 386-3962</p>
    </div>
    <div>
      <p class="label">FOR</p>
      ${data.clientName ? `<p style="font-weight:600;margin:0;">${esc(data.clientName)}</p>` : ''}
      ${data.clientCompany ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientCompany)}</p>` : ''}
      ${data.clientEmail ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientEmail)}</p>` : ''}
      ${data.clientPhone ? `<p style="color:#888;font-size:13px;margin:2px 0 0;">${esc(data.clientPhone)}</p>` : ''}
      ${!data.clientName ? `<p style="font-weight:600;margin:0;">${esc(data.projectName)}</p>` : ''}
    </div>
  </div>

  <!-- Description -->
  <div style="margin-bottom:24px;">
    <p class="label" style="margin-bottom:6px;">Description of Changes</p>
    <p style="font-size:13px;color:#444;">${esc(data.description)}</p>
  </div>

  <!-- Line items -->
  <table style="margin:0 0 24px;">
    <thead>
      <tr>
        <th style="text-align:left;">Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:left;">Unit</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHtml}
    </tbody>
  </table>

  <hr class="divider">

  <!-- Summary -->
  <div style="text-align:right;margin-bottom:24px;">
    <div style="display:inline-flex;flex-direction:column;gap:6px;">
      <div style="display:flex;justify-content:space-between;gap:32px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em;">Original Total</span>
        <span style="font-size:14px;">$${data.quoteTotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:32px;">
        <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.1em;">This Change Order</span>
        <span style="font-size:14px;">${deltaSign}$${Math.abs(data.delta).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:32px;border-top:1px solid #ddd;padding-top:8px;margin-top:4px;">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">New Project Total</span>
        <span style="font-size:18px;font-weight:700;">$${data.newTotal.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- Notes -->
  ${data.notes ? `
  <div style="margin-bottom:20px;">
    <p class="label" style="margin-bottom:6px;">Notes</p>
    <p style="font-size:13px;color:#444;">${esc(data.notes)}</p>
  </div>` : ''}

  <!-- Signature area -->
  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #ddd;">
    <p style="font-size:12px;color:#888;">By signing below, you authorize CPP Painting & Building to proceed with the changes described above.</p>
  </div>
</body>
</html>`
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add lib/docs/change-order-template.ts
git commit -m "feat: add change order HTML template for PDF generation"
```

---

## Task 7: Update Quote Save API + Quote Creation Form

**Files:**
- Modify: `app/api/internal/quote/save/route.ts`
- Modify: `app/internal/projects/[id]/quote/new/page.tsx`

- [ ] **Step 1: Update the quote save API to accept new fields**

In `app/api/internal/quote/save/route.ts`, replace the entire file:

```typescript
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

  // Bump project status to QUOTED if it's still a LEAD
  await db.project.update({
    where: { id: projectId },
    data: { status: 'QUOTED' },
  })

  return NextResponse.json({ quoteId: quote.id })
}
```

- [ ] **Step 2: Add payment terms and exclusions fields to the quote creation form**

In `app/internal/projects/[id]/quote/new/page.tsx`, add two new state variables after the existing `notes` state (around line 132):

```typescript
  const [paymentTerms, setPaymentTerms] = useState('50% deposit due before work begins. Balance due upon completion.')
  const [exclusions, setExclusions] = useState('')
```

Then in the `handleSave` function, include these in the POST body. Replace the existing `handleSave` function (lines 209-227) with:

```typescript
  async function handleSave() {
    if (!lineItems.length) return
    setLoading(true)
    try {
      const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
      const res = await fetch('/api/internal/quote/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: id,
          lineItems,
          subtotal,
          total: subtotal,
          notes,
          paymentTerms,
          exclusions: exclusions || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      router.push(`/internal/quotes/${data.quoteId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
```

Then add the form fields in the JSX. Insert after the notes textarea (after the closing `)}` for `{serviceType !== 'EPOXY' && (` block, around line 352) and before the generate button:

```tsx
            {/* Payment terms & exclusions — shown for all service types */}
            <div>
              <label style={labelStyle}>PAYMENT TERMS</label>
              <textarea
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>EXCLUSIONS (OPTIONAL)</label>
              <textarea
                value={exclusions}
                onChange={e => setExclusions(e.target.value)}
                rows={2}
                placeholder="Work or materials not included in this quote"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/api/internal/quote/save/route.ts app/internal/projects/[id]/quote/new/page.tsx
git commit -m "feat: add payment terms and exclusions to quote creation flow"
```

---

## Task 8: AcceptanceBlock Component

**Files:**
- Create: `app/proposals/[token]/AcceptanceBlock.tsx`

- [ ] **Step 1: Create the AcceptanceBlock component**

```tsx
// app/proposals/[token]/AcceptanceBlock.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

export default function AcceptanceBlock({
  documentType,
  token,
  accepted,
  signerName: initialName,
  acceptedAt: initialDate,
}: {
  documentType: 'proposal' | 'change-order'
  token: string
  accepted: boolean
  signerName?: string
  acceptedAt?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>(accepted ? 'done' : 'idle')
  const [finalName, setFinalName] = useState(initialName ?? '')
  const [finalDate, setFinalDate] = useState(initialDate ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    padRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(28,28,26)',
      penColor: '#ffffff',
    })

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const data = padRef.current?.toData()
      const height = canvas.offsetHeight || 120
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = height * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      padRef.current?.clear()
      if (data) padRef.current?.fromData(data)
    }

    window.addEventListener('resize', resize)
    resize()
    return () => window.removeEventListener('resize', resize)
  }, [])

  const handleClear = () => padRef.current?.clear()

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      setError('Please sign before submitting.')
      return
    }
    setError('')
    setStatus('loading')

    const signature = padRef.current.toDataURL('image/png')
    const endpoint =
      documentType === 'proposal'
        ? `/api/sign/quote/${token}`
        : `/api/sign/change-order/${token}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, signerName: name }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      setStatus('idle')
      return
    }

    const data = await res.json()
    setFinalName(name)
    setFinalDate(data.signedAt ? new Date(data.signedAt).toLocaleString() : new Date().toLocaleString())
    setStatus('done')
  }

  const label = documentType === 'proposal' ? 'Proposal' : 'Change Order'

  if (status === 'done') {
    return (
      <div className="border border-green-800 bg-green-950/30 rounded-sm px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-green-800 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-400 font-semibold text-sm">{label} Accepted</p>
        </div>
        <p className="text-[#888884] text-sm ml-7">
          Signed by <span className="text-white font-medium">{finalName}</span>
          {finalDate && <> on {finalDate}</>}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden print:hidden" style={{ border: '1px solid #2a2a28' }}>
      <div style={{ background: '#1c1c1a', padding: '1rem 1.5rem' }}>
        <h3 className="text-white font-semibold text-sm">
          {documentType === 'proposal' ? 'Acceptance of Proposal' : 'Sign Change Order'}
        </h3>
        <p style={{ color: '#888884', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: '1.5' }}>
          By signing below and clicking Submit, you authorize CPP Painting & Building to proceed with the
          {documentType === 'proposal' ? ' work described above' : ' changes described above'}, and agree to the stated terms.
        </p>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#888884',
              letterSpacing: '0.12em',
              display: 'block',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
            }}
          >
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              background: '#1c1c1a',
              border: '1px solid #2a2a28',
              color: '#fff',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-sans)',
            }}
            className="placeholder-[#555552] focus:outline-none focus:border-white transition-colors"
          />
        </div>

        <div style={{ marginBottom: '0.5rem' }}>
          <label
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: '#888884',
              letterSpacing: '0.12em',
              display: 'block',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
            }}
          >
            Signature
          </label>
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{
              height: '120px',
              touchAction: 'none',
              border: '1px solid #2a2a28',
              background: '#1c1c1a',
            }}
          />
        </div>

        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={handleClear}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555552' }}
            className="hover:text-white transition-colors"
          >
            Clear signature
          </button>
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#f87171', marginBottom: '0.75rem' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: '1px solid #2a2a28',
            color: '#fff',
            padding: '0.85rem',
            background: 'transparent',
          }}
          className="hover:border-white transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Submitting...' : `Submit Signed ${label}`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/proposals/[token]/AcceptanceBlock.tsx
git commit -m "feat: add AcceptanceBlock component with signature pad"
```

---

## Task 9: Public Proposal Signing Page

**Files:**
- Create: `app/proposals/[token]/page.tsx`

- [ ] **Step 1: Create the public proposal page**

```tsx
// app/proposals/[token]/page.tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import AcceptanceBlock from './AcceptanceBlock'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'Interior Painting',
  EXTERIOR: 'Exterior Painting',
  EPOXY: 'Epoxy Floors',
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const quote = await db.quote.findFirst({
    where: { signingToken: token },
    include: {
      project: { include: { people: { include: { person: true } } } },
      acceptance: true,
    },
  })

  if (!quote) notFound()

  // Check expiration
  if (quote.signingTokenExpiresAt && new Date() > quote.signingTokenExpiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111110', color: '#fff' }}>
        <div className="text-center">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Link Expired</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888884', marginTop: '0.5rem' }}>
            This signing link has expired. Please contact CPP Painting & Building for a new link.
          </p>
        </div>
      </div>
    )
  }

  const lineItems = quote.lineItems as unknown as LineItem[]
  const primaryPerson = quote.project.people[0]?.person
  const accepted = quote.status === 'SIGNED'
  const terms = quote.termsAndConditions

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: '0.03em', lineHeight: '1' }}>
            PROPOSAL
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginTop: '0.5rem' }}>
            #{quote.id.slice(-8).toUpperCase()} &middot;{' '}
            {new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-8 mb-10 pb-10" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FROM</p>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              <div style={{ fontWeight: 600 }}>CPP Painting & Building</div>
              <div style={{ color: '#888884' }}>Johnny Avila</div>
              <div style={{ color: '#888884' }}>(775) 386-3962</div>
              <div style={{ color: '#888884' }}>NV Lic. #0071837</div>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FOR</p>
            {primaryPerson ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ fontWeight: 600 }}>{primaryPerson.name}</div>
                {primaryPerson.company && <div style={{ color: '#888884' }}>{primaryPerson.company}</div>}
                {primaryPerson.email && <div style={{ color: '#888884' }}>{primaryPerson.email}</div>}
                {primaryPerson.phone && <div style={{ color: '#888884' }}>{primaryPerson.phone}</div>}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884' }}>
                {quote.project.name}
              </div>
            )}
          </div>
        </div>

        {/* Service type */}
        <div className="mb-6">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>
            {SERVICE_LABEL[quote.project.serviceType] ?? quote.project.serviceType}
          </span>
        </div>

        {/* Line items */}
        <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a28' }}>
              {['Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.55rem',
                    color: '#888884',
                    letterSpacing: '0.12em',
                    padding: '0.5rem 0.5rem',
                    textAlign: h === 'Amount' || h === 'Rate' ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1c1c1a' }}>
                <td style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.qty.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#888884' }}>{item.unit}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right' }}>${item.rate.toFixed(2)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right', fontWeight: 500 }}>${item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex flex-col items-end gap-2 pb-8 mb-8" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div className="flex gap-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>SUBTOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.subtotal.toFixed(2)}</span>
          </div>
          {quote.tax && (
            <div className="flex gap-8">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>TAX</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex gap-8 pt-2" style={{ borderTop: '1px solid #2a2a28' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Terms */}
        {quote.paymentTerms && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>PAYMENT TERMS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.paymentTerms}</p>
          </div>
        )}

        {/* Exclusions */}
        {quote.exclusions && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>EXCLUSIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.exclusions}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {terms && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>TERMS & CONDITIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: '#555552', lineHeight: '1.8', whiteSpace: 'pre-line' }}>{terms}</p>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>NOTES</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mb-8 print:mb-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', lineHeight: '1.8' }}>
          <p>This proposal is valid for 30 days from issue date.</p>
          <p>CPP Painting & Building &middot; (775) 386-3962 &middot; NV Lic. #0071837</p>
        </div>

        {/* Acceptance Block */}
        <AcceptanceBlock
          documentType="proposal"
          token={token}
          accepted={accepted}
          signerName={quote.acceptance?.signerName}
          acceptedAt={quote.acceptance?.acceptedAt?.toISOString()}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/proposals/
git commit -m "feat: add public proposal signing page"
```

---

## Task 10: Quote Sign API

**Files:**
- Create: `app/api/sign/quote/[token]/route.ts`

- [ ] **Step 1: Create the signing endpoint**

```typescript
// app/api/sign/quote/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSignedPDF } from '@/lib/docs/pdf'
import { renderProposalHtml } from '@/lib/docs/proposal-template'
import { sendSignedPDF } from '@/lib/docs/email'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const quote = await db.quote.findFirst({
    where: { signingToken: token },
    include: {
      project: { include: { people: { include: { person: true } } } },
      acceptance: true,
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status === 'SIGNED') return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  if (quote.signingTokenExpiresAt && new Date() > quote.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  let body: { signature?: string; signerName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  if (!body.signerName) return NextResponse.json({ error: 'Missing signerName' }, { status: 400 })
  if (!body.signature.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const docsDir = DOCS_DIR()
  mkdirSync(docsDir, { recursive: true })

  // Save signature PNG
  const sigBase64 = body.signature.replace(/^data:image\/png;base64,/, '')
  const sigPath = path.join(docsDir, `${token}-sig.png`)
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'))

  // Build template data
  const primaryPerson = quote.project.people[0]?.person
  const proposalHtml = renderProposalHtml({
    quoteId: quote.id,
    createdAt: quote.createdAt,
    serviceType: quote.project.serviceType,
    lineItems: quote.lineItems as any[],
    subtotal: quote.subtotal,
    tax: quote.tax,
    total: quote.total,
    paymentTerms: quote.paymentTerms,
    exclusions: quote.exclusions,
    termsAndConditions: quote.termsAndConditions,
    notes: quote.notes,
    clientName: primaryPerson?.name ?? null,
    clientCompany: primaryPerson?.company ?? null,
    clientEmail: primaryPerson?.email ?? null,
    clientPhone: primaryPerson?.phone ?? null,
    projectName: quote.project.name,
  })

  // Generate signed PDF
  const pdfPath = path.join(docsDir, `${token}-signed.pdf`)
  try {
    await generateSignedPDF(proposalHtml, pdfPath, body.signature)
  } catch (err) {
    console.error('PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  const signedAt = new Date()

  // Create or update Acceptance
  if (quote.acceptance) {
    await db.acceptance.update({
      where: { quoteId: quote.id },
      data: { signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    })
  } else {
    await db.acceptance.create({
      data: { quoteId: quote.id, signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    })
  }

  await db.quote.update({
    where: { id: quote.id },
    data: { status: 'SIGNED', signedAt, signedPdfPath: pdfPath },
  })

  // Send signed PDF — don't fail the request if email fails
  if (primaryPerson?.email) {
    try {
      await sendSignedPDF({
        toEmail: primaryPerson.email,
        toName: primaryPerson.name,
        projectName: quote.project.name,
        signedPdfPath: pdfPath,
        documentType: 'proposal',
      })
    } catch (err) {
      console.error('Email failed after signing:', err)
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() })
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/api/sign/quote/
git commit -m "feat: add quote signing API with PDF generation"
```

---

## Task 11: Quote Send API + Signed PDF Download

**Files:**
- Create: `app/api/quotes/[id]/send/route.ts`
- Create: `app/api/quotes/[id]/signed-pdf/route.ts`

- [ ] **Step 1: Create the send endpoint**

```typescript
// app/api/quotes/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendSigningLink } from '@/lib/docs/email'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const quote = await db.quote.findUnique({
    where: { id },
    include: { project: { include: { people: { include: { person: true } } } } },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status === 'SIGNED') return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.quote.update({
    where: { id },
    data: { status: 'SENT', signingToken: token, signingTokenExpiresAt: expiresAt },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const signingUrl = `${baseUrl}/proposals/${token}`

  // Try to send email to primary contact
  const primaryPerson = quote.project.people[0]?.person
  if (primaryPerson?.email) {
    try {
      await sendSigningLink({
        toEmail: primaryPerson.email,
        toName: primaryPerson.name,
        projectName: quote.project.name,
        signingUrl,
        documentType: 'proposal',
      })
    } catch (err) {
      console.error('Failed to send signing link email:', err)
    }
  }

  return NextResponse.json({ ok: true, token, signingUrl })
}
```

- [ ] **Step 2: Create the signed PDF download endpoint**

```typescript
// app/api/quotes/[id]/signed-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const quote = await db.quote.findUnique({ where: { id } })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!quote.signedPdfPath) return NextResponse.json({ error: 'No signed PDF available' }, { status: 404 })

  // Validate the path is within DOCS_DIR to prevent path traversal
  const docsDir = DOCS_DIR()
  const resolved = path.resolve(quote.signedPdfPath)
  if (!resolved.startsWith(path.resolve(docsDir))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  if (!existsSync(resolved)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const pdf = readFileSync(resolved)
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="CPP-Proposal-${quote.id.slice(-8).toUpperCase()}-Signed.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/api/quotes/
git commit -m "feat: add quote send and signed PDF download APIs"
```

---

## Task 12: Upgrade Internal Quote View

**Files:**
- Modify: `app/internal/quotes/[id]/page.tsx`

- [ ] **Step 1: Replace the existing quote view with the styled proposal view + action buttons**

Replace the entire contents of `app/internal/quotes/[id]/page.tsx` with:

```tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import QuoteActions from './QuoteActions'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

const SERVICE_LABEL: Record<string, string> = {
  INTERIOR: 'Interior Painting',
  EXTERIOR: 'Exterior Painting',
  EPOXY: 'Epoxy Floors',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  SIGNED: 'Signed',
}

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      project: { include: { people: { include: { person: true } } } },
      acceptance: true,
    },
  })

  if (!quote) notFound()

  const lineItems = quote.lineItems as unknown as LineItem[]
  const primaryPerson = quote.project.people[0]?.person
  const status = quote.status ?? 'DRAFT'

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        {/* Nav + Actions */}
        <div className="flex justify-between items-center mb-10 print:hidden">
          <Link
            href={`/internal/projects/${quote.projectId}`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
            className="hover:text-white"
          >
            &larr; Project
          </Link>
          <QuoteActions quoteId={quote.id} status={status} signingToken={quote.signingToken} />
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: '0.03em', lineHeight: '1' }}>
              PROPOSAL
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                letterSpacing: '0.1em',
                padding: '0.25rem 0.6rem',
                border: '1px solid #2a2a28',
                color: status === 'SIGNED' ? '#4ade80' : '#888884',
              }}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginTop: '0.5rem' }}>
            #{quote.id.slice(-8).toUpperCase()} &middot;{' '}
            {new Date(quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-8 mb-10 pb-10" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FROM</p>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              <div style={{ fontWeight: 600 }}>CPP Painting & Building</div>
              <div style={{ color: '#888884' }}>Johnny Avila</div>
              <div style={{ color: '#888884' }}>(775) 386-3962</div>
              <div style={{ color: '#888884' }}>NV Lic. #0071837</div>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FOR</p>
            {primaryPerson ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ fontWeight: 600 }}>{primaryPerson.name}</div>
                {primaryPerson.company && <div style={{ color: '#888884' }}>{primaryPerson.company}</div>}
                {primaryPerson.email && <div style={{ color: '#888884' }}>{primaryPerson.email}</div>}
                {primaryPerson.phone && <div style={{ color: '#888884' }}>{primaryPerson.phone}</div>}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884' }}>
                {quote.project.name}
              </div>
            )}
          </div>
        </div>

        {/* Service type */}
        <div className="mb-6">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>
            {SERVICE_LABEL[quote.project.serviceType] ?? quote.project.serviceType}
          </span>
        </div>

        {/* Line items */}
        <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a28' }}>
              {['Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.55rem',
                    color: '#888884',
                    letterSpacing: '0.12em',
                    padding: '0.5rem 0.5rem',
                    textAlign: h === 'Amount' || h === 'Rate' ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1c1c1a' }}>
                <td style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.qty.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#888884' }}>{item.unit}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right' }}>${item.rate.toFixed(2)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right', fontWeight: 500 }}>${item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex flex-col items-end gap-2 pb-8 mb-8" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div className="flex gap-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>SUBTOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.subtotal.toFixed(2)}</span>
          </div>
          {quote.tax && (
            <div className="flex gap-8">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>TAX</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex gap-8 pt-2" style={{ borderTop: '1px solid #2a2a28' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${quote.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Terms */}
        {quote.paymentTerms && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>PAYMENT TERMS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.paymentTerms}</p>
          </div>
        )}

        {/* Exclusions */}
        {quote.exclusions && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>EXCLUSIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.exclusions}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {quote.termsAndConditions && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>TERMS & CONDITIONS</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: '#555552', lineHeight: '1.8', whiteSpace: 'pre-line' }}>{quote.termsAndConditions}</p>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>NOTES</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{quote.notes}</p>
          </div>
        )}

        {/* Acceptance info (if signed) */}
        {quote.acceptance && (
          <div className="mb-8 p-4" style={{ border: '1px solid #2a2a28', background: '#1c1c1a' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#4ade80', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>SIGNED</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#888884' }}>
              Signed by <span style={{ color: '#fff' }}>{quote.acceptance.signerName}</span> on{' '}
              {new Date(quote.acceptance.acceptedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555552', marginTop: '0.25rem' }}>
              IP: {quote.acceptance.ipAddress}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.08em', lineHeight: '1.8' }}>
          <p>This proposal is valid for 30 days from issue date.</p>
          <p>CPP Painting & Building &middot; (775) 386-3962 &middot; johnny@cpppainting.com &middot; NV Lic. #0071837</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the QuoteActions client component**

Create `app/internal/quotes/[id]/QuoteActions.tsx`:

```tsx
// app/internal/quotes/[id]/QuoteActions.tsx
'use client'

import { useState } from 'react'

const btnStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  letterSpacing: '0.1em',
  border: '1px solid #2a2a28',
  color: '#888884',
  padding: '0.4rem 1rem',
  textTransform: 'uppercase' as const,
  background: 'transparent',
}

export default function QuoteActions({
  quoteId,
  status,
  signingToken,
}: {
  quoteId: string
  status: string
  signingToken: string | null
}) {
  const [sending, setSending] = useState(false)
  const [sentUrl, setSentUrl] = useState<string | null>(null)

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
      const data = await res.json()
      if (data.signingUrl) setSentUrl(data.signingUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => window.print()

  const effectiveToken = sentUrl ? new URL(sentUrl).pathname.split('/').pop() : signingToken

  return (
    <div className="flex gap-2 items-center">
      {status !== 'SIGNED' && (
        <button
          onClick={handleSend}
          disabled={sending}
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors disabled:opacity-50"
        >
          {sending ? 'Sending...' : status === 'SENT' ? 'Resend' : 'Send to Client'}
        </button>
      )}

      {effectiveToken && status !== 'SIGNED' && (
        <a
          href={`/proposals/${effectiveToken}`}
          target="_blank"
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors inline-block"
        >
          Sign In-Person
        </a>
      )}

      {status === 'SIGNED' && (
        <a
          href={`/api/quotes/${quoteId}/signed-pdf`}
          style={btnStyle}
          className="hover:border-white hover:text-white transition-colors inline-block"
        >
          Download Signed PDF
        </a>
      )}

      <button
        onClick={handlePrint}
        style={btnStyle}
        className="hover:border-white hover:text-white transition-colors"
      >
        Print / Save PDF
      </button>

      {sentUrl && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#4ade80' }}>Sent!</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/internal/quotes/
git commit -m "feat: upgrade quote view to styled proposal with send/sign actions"
```

---

## Task 13: Change Order Creation API + Form

**Files:**
- Create: `app/api/internal/change-orders/route.ts`
- Create: `app/internal/projects/[id]/change-order/new/page.tsx`

- [ ] **Step 1: Create the change order API**

```typescript
// app/api/internal/change-orders/route.ts
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

  // Get the quote and all existing signed change orders to calculate running total
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
```

- [ ] **Step 2: Create the change order form page**

```tsx
// app/internal/projects/[id]/change-order/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

const inputStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  background: '#1c1c1a',
  border: '1px solid #2a2a28',
  color: '#fff',
  padding: '0.5rem 0.75rem',
  width: '100%',
} as const

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  color: '#888884',
  letterSpacing: '0.12em',
  display: 'block' as const,
  marginBottom: '0.4rem',
}

export default function NewChangeOrderPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()

  const [quoteId, setQuoteId] = useState('')
  const [quotes, setQuotes] = useState<{ id: string; total: number; createdAt: string }[]>([])
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([{ label: '', qty: 1, unit: 'EA', rate: 0, total: 0 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch signed quotes for this project to reference
    fetch(`/api/internal/projects/${projectId}/quotes`)
      .then((r) => r.json())
      .then((data) => {
        setQuotes(data)
        if (data.length > 0) setQuoteId(data[0].id)
      })
      .catch(() => {})
  }, [projectId])

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item, [field]: value }
        if (field === 'qty' || field === 'rate') {
          updated.total = Number(updated.qty) * Number(updated.rate)
        }
        return updated
      }),
    )
  }

  function addItem() {
    setItems((prev) => [...prev, { label: '', qty: 1, unit: 'EA', rate: 0, total: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const delta = items.reduce((sum, item) => sum + item.total, 0)

  async function handleSave() {
    if (!quoteId || !description.trim() || items.length === 0) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/internal/change-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, description, lineItems: items, notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      router.push(`/internal/projects/${projectId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
          className="hover:text-white mb-4 block"
        >
          &larr; Back
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '0.03em', marginBottom: '2rem' }}>
          New Change Order
        </h1>

        <div className="flex flex-col gap-5">
          {/* Quote selector */}
          {quotes.length > 0 && (
            <div>
              <label style={labelStyle}>QUOTE REFERENCE</label>
              <select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    #{q.id.slice(-8).toUpperCase()} — ${q.total.toLocaleString()} ({new Date(q.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label style={labelStyle}>DESCRIPTION OF CHANGES</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What changed and why"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Line items */}
          <div>
            <label style={labelStyle}>LINE ITEMS</label>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  className="col-span-4"
                  placeholder="Description"
                  value={item.label}
                  onChange={(e) => updateItem(i, 'label', e.target.value)}
                  style={inputStyle}
                />
                <input
                  className="col-span-2"
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
                <input
                  className="col-span-1"
                  placeholder="Unit"
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  style={inputStyle}
                />
                <input
                  className="col-span-2"
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
                <div className="col-span-2 flex items-center" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#fff' }}>
                  ${item.total.toFixed(2)}
                </div>
                <button
                  onClick={() => removeItem(i)}
                  className="col-span-1 flex items-center justify-center hover:text-red-400 transition-colors"
                  style={{ color: '#555552', fontSize: '1.2rem' }}
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}
              className="hover:text-white transition-colors mt-1"
            >
              + Add Line Item
            </button>
          </div>

          {/* Delta */}
          <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid #2a2a28' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#888884' }}>CHANGE ORDER TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', color: delta >= 0 ? '#fff' : '#f87171' }}>
              {delta >= 0 ? '+' : '-'}${Math.abs(delta).toFixed(2)}
            </span>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>NOTES (OPTIONAL)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#f87171' }}>{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em', background: '#fff', color: '#000', padding: '0.75rem 2rem' }}
            className="hover:bg-zinc-200 transition-colors disabled:opacity-50 self-start uppercase"
          >
            {loading ? 'Saving...' : 'Save Change Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the quotes list API for the project (needed by the CO form)**

Create `app/api/internal/projects/[id]/quotes/route.ts`:

```typescript
// app/api/internal/projects/[id]/quotes/route.ts
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
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/api/internal/change-orders/ app/internal/projects/[id]/change-order/ app/api/internal/projects/[id]/quotes/
git commit -m "feat: add change order creation API and form"
```

---

## Task 14: Change Order Signing (Public Page + API)

**Files:**
- Create: `app/change-orders/[token]/page.tsx`
- Create: `app/change-orders/[token]/ChangeOrderSigningBlock.tsx`
- Create: `app/api/sign/change-order/[token]/route.ts`
- Create: `app/api/change-orders/[id]/send/route.ts`

- [ ] **Step 1: Create ChangeOrderSigningBlock**

This is a thin wrapper around AcceptanceBlock, or we can reuse it directly. Since AcceptanceBlock already supports `documentType: 'change-order'`, we just need to symlink the import. Create `app/change-orders/[token]/ChangeOrderSigningBlock.tsx`:

```tsx
// app/change-orders/[token]/ChangeOrderSigningBlock.tsx
// Re-export the shared AcceptanceBlock for change orders
export { default } from '@/app/proposals/[token]/AcceptanceBlock'
```

- [ ] **Step 2: Create the public change order signing page**

```tsx
// app/change-orders/[token]/page.tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import ChangeOrderSigningBlock from './ChangeOrderSigningBlock'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

export default async function ChangeOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const changeOrder = await db.changeOrder.findFirst({
    where: { signingToken: token },
    include: {
      quote: {
        include: { project: { include: { people: { include: { person: true } } } } },
      },
      acceptance: true,
    },
  })

  if (!changeOrder) notFound()

  if (changeOrder.signingTokenExpiresAt && new Date() > changeOrder.signingTokenExpiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111110', color: '#fff' }}>
        <div className="text-center">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Link Expired</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#888884', marginTop: '0.5rem' }}>
            This signing link has expired. Please contact CPP Painting & Building for a new link.
          </p>
        </div>
      </div>
    )
  }

  const lineItems = changeOrder.lineItems as unknown as LineItem[]
  const primaryPerson = changeOrder.quote.project.people[0]?.person
  const accepted = changeOrder.status === 'SIGNED'
  const deltaSign = changeOrder.delta >= 0 ? '+' : '-'
  const quoteDateStr = new Date(changeOrder.quote.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen p-8" style={{ background: '#111110', color: '#fff' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: '0.03em', lineHeight: '1' }}>
            CHANGE ORDER
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em', marginTop: '0.5rem' }}>
            #{changeOrder.id.slice(-8).toUpperCase()} &middot;{' '}
            {new Date(changeOrder.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Reference */}
        <div className="mb-8">
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#888884' }}>
            Amendment to Proposal <span style={{ color: '#fff' }}>#{changeOrder.quote.id.slice(-8).toUpperCase()}</span> dated {quoteDateStr}
          </p>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-8 mb-10 pb-10" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FROM</p>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              <div style={{ fontWeight: 600 }}>CPP Painting & Building</div>
              <div style={{ color: '#888884' }}>Johnny Avila</div>
              <div style={{ color: '#888884' }}>(775) 386-3962</div>
            </div>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>FOR</p>
            {primaryPerson ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ fontWeight: 600 }}>{primaryPerson.name}</div>
                {primaryPerson.company && <div style={{ color: '#888884' }}>{primaryPerson.company}</div>}
                {primaryPerson.email && <div style={{ color: '#888884' }}>{primaryPerson.email}</div>}
                {primaryPerson.phone && <div style={{ color: '#888884' }}>{primaryPerson.phone}</div>}
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884' }}>
                {changeOrder.quote.project.name}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>DESCRIPTION OF CHANGES</p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#fff', lineHeight: '1.7' }}>{changeOrder.description}</p>
        </div>

        {/* Line items */}
        <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a28' }}>
              {['Description', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.55rem',
                    color: '#888884',
                    letterSpacing: '0.12em',
                    padding: '0.5rem 0.5rem',
                    textAlign: h === 'Amount' || h === 'Rate' ? 'right' : 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1c1c1a' }}>
                <td style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.label}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff' }}>{item.qty.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#888884' }}>{item.unit}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: '#fff', textAlign: 'right' }}>${item.rate.toFixed(2)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '0.7rem 0.5rem', color: item.total >= 0 ? '#fff' : '#f87171', textAlign: 'right', fontWeight: 500 }}>
                  {item.total >= 0 ? '' : '-'}${Math.abs(item.total).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="flex flex-col items-end gap-2 pb-8 mb-8" style={{ borderBottom: '1px solid #2a2a28' }}>
          <div className="flex gap-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>ORIGINAL TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${changeOrder.quote.total.toFixed(2)}</span>
          </div>
          <div className="flex gap-8">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884', letterSpacing: '0.1em' }}>THIS CHANGE ORDER</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: changeOrder.delta >= 0 ? '#fff' : '#f87171', minWidth: '100px', textAlign: 'right' }}>
              {deltaSign}${Math.abs(changeOrder.delta).toFixed(2)}
            </span>
          </div>
          <div className="flex gap-8 pt-2" style={{ borderTop: '1px solid #2a2a28' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fff', letterSpacing: '0.1em' }}>NEW PROJECT TOTAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: '#fff', minWidth: '100px', textAlign: 'right' }}>${changeOrder.newTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {changeOrder.notes && (
          <div className="mb-8">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#888884', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>NOTES</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9rem', color: '#888884', lineHeight: '1.7' }}>{changeOrder.notes}</p>
          </div>
        )}

        {/* Acceptance Block */}
        <ChangeOrderSigningBlock
          documentType="change-order"
          token={token}
          accepted={accepted}
          signerName={changeOrder.acceptance?.signerName}
          acceptedAt={changeOrder.acceptance?.acceptedAt?.toISOString()}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the CO signing API**

```typescript
// app/api/sign/change-order/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSignedPDF } from '@/lib/docs/pdf'
import { renderChangeOrderHtml } from '@/lib/docs/change-order-template'
import { sendSignedPDF } from '@/lib/docs/email'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const DOCS_DIR = () => process.env.DOCS_DIR ?? path.join(process.cwd(), 'docs-storage')

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const changeOrder = await db.changeOrder.findFirst({
    where: { signingToken: token },
    include: {
      quote: { include: { project: { include: { people: { include: { person: true } } } } } },
      acceptance: true,
    },
  })

  if (!changeOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (changeOrder.status === 'SIGNED') return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  if (changeOrder.signingTokenExpiresAt && new Date() > changeOrder.signingTokenExpiresAt) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  let body: { signature?: string; signerName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  if (!body.signerName) return NextResponse.json({ error: 'Missing signerName' }, { status: 400 })
  if (!body.signature.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
  const docsDir = DOCS_DIR()
  mkdirSync(docsDir, { recursive: true })

  const sigBase64 = body.signature.replace(/^data:image\/png;base64,/, '')
  const sigPath = path.join(docsDir, `co-${token}-sig.png`)
  writeFileSync(sigPath, Buffer.from(sigBase64, 'base64'))

  const primaryPerson = changeOrder.quote.project.people[0]?.person
  const coHtml = renderChangeOrderHtml({
    changeOrderId: changeOrder.id,
    createdAt: changeOrder.createdAt,
    description: changeOrder.description,
    lineItems: changeOrder.lineItems as any[],
    delta: changeOrder.delta,
    newTotal: changeOrder.newTotal,
    notes: changeOrder.notes,
    quoteId: changeOrder.quote.id,
    quoteDate: changeOrder.quote.createdAt,
    quoteTotal: changeOrder.quote.total,
    clientName: primaryPerson?.name ?? null,
    clientCompany: primaryPerson?.company ?? null,
    clientEmail: primaryPerson?.email ?? null,
    clientPhone: primaryPerson?.phone ?? null,
    projectName: changeOrder.quote.project.name,
  })

  const pdfPath = path.join(docsDir, `co-${token}-signed.pdf`)
  try {
    await generateSignedPDF(coHtml, pdfPath, body.signature)
  } catch (err) {
    console.error('PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  const signedAt = new Date()

  if (changeOrder.acceptance) {
    await db.acceptance.update({
      where: { changeOrderId: changeOrder.id },
      data: { signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    })
  } else {
    await db.acceptance.create({
      data: { changeOrderId: changeOrder.id, signerName: body.signerName, signaturePngPath: sigPath, acceptedAt: signedAt, ipAddress: ip },
    })
  }

  await db.changeOrder.update({
    where: { id: changeOrder.id },
    data: { status: 'SIGNED', signedAt, signedPdfPath: pdfPath },
  })

  if (primaryPerson?.email) {
    try {
      await sendSignedPDF({
        toEmail: primaryPerson.email,
        toName: primaryPerson.name,
        projectName: changeOrder.quote.project.name,
        signedPdfPath: pdfPath,
        documentType: 'change order',
      })
    } catch (err) {
      console.error('Email failed after signing:', err)
    }
  }

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString() })
}
```

- [ ] **Step 4: Create the CO send endpoint**

```typescript
// app/api/change-orders/[id]/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendSigningLink } from '@/lib/docs/email'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const changeOrder = await db.changeOrder.findUnique({
    where: { id },
    include: { quote: { include: { project: { include: { people: { include: { person: true } } } } } } },
  })

  if (!changeOrder) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (changeOrder.status === 'SIGNED') return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await db.changeOrder.update({
    where: { id },
    data: { status: 'SENT', signingToken: token, signingTokenExpiresAt: expiresAt },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const signingUrl = `${baseUrl}/change-orders/${token}`

  const primaryPerson = changeOrder.quote.project.people[0]?.person
  if (primaryPerson?.email) {
    try {
      await sendSigningLink({
        toEmail: primaryPerson.email,
        toName: primaryPerson.name,
        projectName: changeOrder.quote.project.name,
        signingUrl,
        documentType: 'change order',
      })
    } catch (err) {
      console.error('Failed to send CO signing link:', err)
    }
  }

  return NextResponse.json({ ok: true, token, signingUrl })
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/change-orders/ app/api/sign/change-order/ app/api/change-orders/
git commit -m "feat: add change order signing page, signing API, and send API"
```

---

## Task 15: Update Project Detail Page with Change Orders

**Files:**
- Modify: `app/internal/projects/[id]/page.tsx`

- [ ] **Step 1: Update the project detail page**

In `app/internal/projects/[id]/page.tsx`, update the db query at the top of the component to include change orders. Replace the existing `db.project.findUnique` call (lines 21-27) with:

```typescript
  const project = await db.project.findUnique({
    where: { id },
    include: {
      people: { include: { person: true } },
      quotes: {
        orderBy: { createdAt: 'desc' },
        include: {
          changeOrders: { orderBy: { createdAt: 'desc' } },
          acceptance: true,
        },
      },
    },
  })
```

Then add a change orders section after the quotes section in the right column. Find the closing `</div>` of the quotes section (after the `project.quotes.map` block, around line 158) and add:

```tsx
          {/* Change Orders */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.12em' }}>
                CHANGE ORDERS
              </p>
              {project.quotes.some(q => q.status === 'SIGNED') && (
                <Link
                  href={`/internal/projects/${project.id}/change-order/new`}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: '#fff', border: '1px solid #2a2a28', padding: '0.3rem 0.75rem' }}
                  className="hover:border-white transition-colors uppercase"
                >
                  + New Change Order
                </Link>
              )}
            </div>

            {(() => {
              const allCOs = project.quotes.flatMap(q => q.changeOrders.map(co => ({ ...co, quoteTotal: q.total })))
              if (allCOs.length === 0) {
                return (
                  <div className="p-6 text-center" style={{ border: '1px dashed #2a2a28' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884' }}>No change orders</span>
                  </div>
                )
              }

              const signedQuote = project.quotes.find(q => q.status === 'SIGNED')
              const signedCODeltas = allCOs.filter(co => co.status === 'SIGNED').reduce((sum, co) => sum + co.delta, 0)
              const currentValue = (signedQuote?.total ?? 0) + signedCODeltas

              return (
                <>
                  {allCOs.map(co => (
                    <div key={co.id} className="p-4 mb-2" style={{ border: '1px solid #2a2a28' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888884' }}>
                          {new Date(co.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-3">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: co.status === 'SIGNED' ? '#4ade80' : '#888884', letterSpacing: '0.1em' }}>
                            {co.status}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: co.delta >= 0 ? '#fff' : '#f87171' }}>
                            {co.delta >= 0 ? '+' : '-'}${Math.abs(co.delta).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: '#888884' }}>
                        {co.description}
                      </p>
                    </div>
                  ))}

                  {signedQuote && (
                    <div className="mt-3 p-4" style={{ background: '#1c1c1a', border: '1px solid #2a2a28' }}>
                      <div className="flex justify-between items-center">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#888884', letterSpacing: '0.1em' }}>CURRENT PROJECT VALUE</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: '#fff' }}>${currentValue.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx next build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add app/internal/projects/[id]/page.tsx
git commit -m "feat: add change order section with running total to project detail"
```

---

## Task 16: Add docs-storage to .gitignore + Environment Variables

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add docs-storage to .gitignore**

Append to `.gitignore`:

```
# Signed documents storage
docs-storage/
```

- [ ] **Step 2: Add environment variables to .env.example (or .env.local if it exists)**

If `.env.example` or `.env.local` exists, add:

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DOCS_DIR=./docs-storage
# PUPPETEER_EXECUTABLE_PATH=  # Only needed in Docker/Railway
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git add .gitignore
git commit -m "chore: add docs-storage to gitignore and document env vars"
```

---

## Task 17: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify all new routes are recognized**

Check the build output for the following routes:
- `/proposals/[token]`
- `/change-orders/[token]`
- `/internal/projects/[id]/change-order/new`
- `/api/sign/quote/[token]`
- `/api/sign/change-order/[token]`
- `/api/quotes/[id]/send`
- `/api/quotes/[id]/signed-pdf`
- `/api/change-orders/[id]/send`
- `/api/internal/change-orders`
- `/api/internal/projects/[id]/quotes`

- [ ] **Step 3: Commit any remaining changes**

```bash
cd /Users/dcox/centered-os/projects/bldn-inc/cpp
git status
```

If clean, no action needed. If there are uncommitted changes, stage and commit them.
