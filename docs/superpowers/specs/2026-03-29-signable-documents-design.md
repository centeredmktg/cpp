# CPP Signable Documents — Design Spec

## Overview

Transform CPP's existing plain estimate view into a stylized, signable proposal system with change order support. The signed quote serves as the binding agreement — no separate contract document. Change orders modify the original agreement and require client signature.

**Document lifecycle:** Quote (draft) -> Sent -> Signed (= contract) -> Change Orders as needed

## Reference Implementation

Building NV (`/projects/bldn-inc/building-nv/`) has a production implementation of this pattern. CPP adapts the same architecture with CPP branding (black/white/grey) and a simplified scope (no milestones, no Gantt, no payment schedule breakdown).

---

## 1. Database Schema Changes

### Quote Model — New Fields

```prisma
model Quote {
  // ... existing fields (id, createdAt, projectId, lineItems, subtotal, tax, total, notes)

  // New fields
  status                QuoteStatus  @default(DRAFT)
  paymentTerms          String?      // e.g. "50% deposit, 50% on completion"
  exclusions            String?      // What's not included
  termsAndConditions    String?      // Boilerplate T&C (defaults provided)

  // Signing flow
  signingToken          String?      @unique
  signingTokenExpiresAt DateTime?
  signedAt              DateTime?
  signedPdfPath         String?

  // Relations
  acceptance            Acceptance?
  changeOrders          ChangeOrder[]
}
```

### New Enum: QuoteStatus

```prisma
enum QuoteStatus {
  DRAFT
  SENT
  SIGNED
}
```

### New Model: Acceptance

One-to-one with Quote or ChangeOrder. Captures the signature event for audit.

```prisma
model Acceptance {
  id               String       @id @default(cuid())
  signerName       String
  acceptedAt       DateTime
  ipAddress        String
  signaturePngPath String

  // Polymorphic: linked to either a Quote or a ChangeOrder (exactly one)
  quote            Quote?       @relation(fields: [quoteId], references: [id])
  quoteId          String?      @unique
  changeOrder      ChangeOrder? @relation(fields: [changeOrderId], references: [id])
  changeOrderId    String?      @unique
}
```

### New Model: ChangeOrder

```prisma
model ChangeOrder {
  id                    String       @id @default(cuid())
  createdAt             DateTime     @default(now())
  quote                 Quote        @relation(fields: [quoteId], references: [id])
  quoteId               String
  description           String       // What changed and why
  lineItems             Json         // Same LineItem[] format as Quote
  delta                 Float        // Net change (+/-)
  newTotal              Float        // Original quote total + sum of all COs up to this one
  status                ChangeOrderStatus @default(DRAFT)
  notes                 String?

  // Signing flow (same pattern as Quote)
  signingToken          String?      @unique
  signingTokenExpiresAt DateTime?
  signedAt              DateTime?
  signedPdfPath         String?

  acceptance            Acceptance?
}
```

### New Enum: ChangeOrderStatus

```prisma
enum ChangeOrderStatus {
  DRAFT
  SENT
  SIGNED
}
```

---

## 2. Proposal View (Public Signing Page)

**Route:** `/proposals/[token]/page.tsx` (public, no auth required)

**Layout — CPP branded, black/white/grey:**

Uses CPP's existing design tokens:
- Background: `#111110` (--bg)
- Foreground: `#ffffff` (--fg)
- Muted text: `#888884` (--muted)
- Borders: `#2a2a28` (--border)
- Subtle bg: `#1c1c1a` (--subtle)
- Fonts: `var(--font-display)`, `var(--font-sans)`, `var(--font-mono)`

**Sections (top to bottom):**

1. **Header** — "PROPOSAL" in display font, quote ID + date in mono
2. **From / To** — Two-column: CPP info (left), client info (right). Same layout as existing estimate view.
3. **Service Type** — Label: "Interior Painting" / "Exterior Painting" / "Epoxy Floors"
4. **Line Items Table** — Description, Qty, Unit, Rate, Amount columns. Existing format.
5. **Totals** — Subtotal, Tax (if any), Total. Existing format.
6. **Payment Terms** — Section with payment terms text (e.g. "50% deposit due before work begins. Balance due upon completion.")
7. **Exclusions** — Section listing what's not included
8. **Terms & Conditions** — Boilerplate legal terms (see Section 6)
9. **Notes** — If present
10. **Acceptance Block** — Signature pad + name input + submit button (only if not yet signed)
11. **Signed Confirmation** — Green success state with signer name + timestamp (if already signed)

**Print/PDF considerations:**
- Acceptance block hidden in print
- `@media print` styles: white background, black text, no shadows
- `print-color-adjust: exact` for borders

### For the PDF template (`lib/docs/proposal-template.ts`)

Server-only HTML template (no React) matching the same layout. Used by Puppeteer for signed PDF generation. Same structure as the proposal view but rendered as plain HTML with inline styles for PDF fidelity.

CPP branding in PDF: white background, dark text (inverted from dark site theme for print readability). Clean, professional.

---

## 3. Change Order View (Public Signing Page)

**Route:** `/change-orders/[token]/page.tsx` (public, no auth required)

**Layout — same CPP tokens as proposal:**

**Sections (top to bottom):**

1. **Header** — "CHANGE ORDER" in display font, CO ID + date
2. **Reference** — "Amendment to Proposal #XXXXXX dated [date]"
3. **From / To** — Same as proposal
4. **Description** — What changed and why
5. **Line Items Table** — Additions and removals with +/- amounts
6. **Summary** — Original Total, This Change Order (+/-), New Project Total
7. **Notes** — If present
8. **Acceptance Block** — Same signature mechanism as proposals
9. **Signed Confirmation** — Same pattern

### PDF template (`lib/docs/change-order-template.ts`)

Same approach as proposal template. Server-only HTML for Puppeteer rendering.

---

## 4. Acceptance Block Component

**File:** `app/components/AcceptanceBlock.tsx` (shared between proposals and change orders)

Adapted from Building NV's AcceptanceBlock but styled with CPP tokens:

**Unsigned state:**
- Header bar: `#1c1c1a` background with white text "Acceptance of Proposal" (or "Sign Change Order")
- Authorization text in muted color
- "Full Name" label in mono, uppercase, `#888884`
- Text input: dark background (`#1c1c1a`), white text, border `#2a2a28`
- "Signature" label same style
- Canvas: dark background, white stroke for signature
- "Clear signature" link in muted
- Submit button: white text on `#2a2a28` border, hover to white border. Uppercase mono.

**Signed state:**
- Bordered box with subtle green tint (keeping it minimal — `border-green-800`, muted dark green background)
- Checkmark + "Proposal Accepted" / "Change Order Signed"
- Signer name + timestamp

**Props:**
```typescript
{
  documentType: 'proposal' | 'change-order'
  token: string
  accepted: boolean
  signerName?: string
  acceptedAt?: string
}
```

**Dependency:** `signature_pad` npm package

---

## 5. Internal Pages (Authenticated)

### Modified: Quote View (`/internal/quotes/[id]`)

The existing estimate view gets upgraded to match the proposal layout (same sections), plus action buttons:

**New buttons (print:hidden):**
- "Send to Client" — generates signing token, emails link
- "Sign In-Person" — navigates to `/proposals/[token]` for on-site signing
- "Print / Save PDF" — existing, kept

**Status indicator:**
- DRAFT / SENT / SIGNED badge next to quote ID

**If signed:** show acceptance info (signer name, date, IP), link to download signed PDF

### Modified: Project Detail (`/internal/projects/[id]`)

**New section: Change Orders**
- List of change orders with: date, description, delta, status
- Running total: Original Quote + all signed COs = Current Project Value
- "New Change Order" button

### New: Create Change Order (`/internal/projects/[id]/change-order/new`)

**Form fields:**
- Description (textarea) — what changed and why
- Line items editor — add/remove rows (label, qty, unit, rate)
  - Each item can be positive (addition) or negative (removal/credit)
- Notes (textarea, optional)
- Auto-calculated: delta (sum of line items), new total (quote total + all prior CO deltas + this delta)

**Actions:**
- "Save as Draft" — saves CO in DRAFT status
- "Send to Client" — saves, generates token, emails signing link

### Modified: Quote Creation Flow

Add two fields to the quote creation/save flow:
- Payment Terms (textarea, with default text)
- Exclusions (textarea)

Terms & Conditions use a system default that can be overridden per-quote.

---

## 6. Default Terms & Conditions

Adapted from Building NV's terms for a single-trade contractor:

```
A. Interest of 1.5% per month on overdue accounts.
B. Any alteration from above specifications will be charged via written change order.
C. All agreements contingent upon strikes, accidents, or delays beyond our control.
D. Warranty void by act of God or non-payment. Coverage begins at final payment.
E. Unforeseen conditions not included. Additional fees added via change order.
F. Payment due net 30 from invoice date.
```

Stored as a default string. Can be overridden per-quote via the `termsAndConditions` field.

---

## 7. API Routes

### New Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/quotes/[id]/send` | Generate signing token, email link to client |
| POST | `/api/sign/quote/[token]` | Accept signature, generate signed PDF, email PDF |
| GET | `/api/quotes/[id]/signed-pdf` | Download signed PDF (auth required) |
| POST | `/api/internal/change-orders` | Create a change order |
| POST | `/api/change-orders/[id]/send` | Generate CO signing token, email link |
| POST | `/api/sign/change-order/[token]` | Accept CO signature, generate signed PDF |

### Quote Send Flow (`/api/quotes/[id]/send`)

1. Validate quote exists and is in DRAFT status
2. Generate UUID signing token
3. Set expiration: 30 days from now
4. Update quote: `status: SENT`, `signingToken`, `signingTokenExpiresAt`
5. Resolve primary contact email from project
6. Send email with signing link: `{BASE_URL}/proposals/{token}`
7. Return `{ ok: true, token }`

### Quote Sign Flow (`/api/sign/quote/[token]`)

Adapted from Building NV's implementation:

1. Validate token format (UUID, prevents path traversal)
2. Find quote by signing token, include project + people
3. Check not already signed (409 if so)
4. Check token not expired (410 if so)
5. Validate request body: `signature` (PNG data URL) + `signerName`
6. Save signature PNG to `DOCS_DIR/{token}-sig.png`
7. Render proposal HTML via `renderProposalHtml(quote)`
8. Inject signature block, generate PDF via Puppeteer
9. Save PDF to `DOCS_DIR/{token}-signed.pdf`
10. Create Acceptance record (signerName, acceptedAt, ipAddress, signaturePngPath)
11. Update quote: `status: SIGNED`, `signedAt`, `signedPdfPath`
12. Email signed PDF to client (async, non-blocking)
13. Return `{ ok: true, signedAt }`

### Change Order flows follow the same pattern.

---

## 8. Email Integration

Uses Resend (already in CPP's dependencies).

### Signing Link Email

```
Subject: Proposal from CPP Painting & Building — {ProjectName}

Hi {firstName},

Please review and sign the proposal for {projectName}:

[Review & Sign Proposal]  (button linking to /proposals/{token})

This link expires in 30 days.

— CPP Painting & Building
(775) 386-3962
```

### Signed PDF Email

```
Subject: Signed Proposal — {ProjectName}

Your signed proposal for {projectName} is attached.

We look forward to working with you.

— CPP Painting & Building
(775) 386-3962
```

### Change Order emails follow the same pattern with adjusted copy.

---

## 9. PDF Generation

**Dependency:** `puppeteer` npm package

**Approach:** Same as Building NV — render HTML template with Puppeteer headless Chrome.

**Two functions in `lib/docs/pdf.ts`:**
- `generateSignedPDF(html, outputPath, signaturePng)` — injects signature block, renders to PDF
- `generatePDF(html, outputPath)` — plain PDF without signature (for draft downloads)

**PDF styling:** White background, dark text (inverted from dark site theme). Professional print layout. Letter format, 1" margins.

**File storage:** `DOCS_DIR` env var (default: `./docs-storage`). Signature PNGs and signed PDFs stored here.

---

## 10. Environment Variables (New)

```
NEXT_PUBLIC_BASE_URL    # For signing link URLs (e.g. https://cpppainting.com)
DOCS_DIR                # File storage path (default: ./docs-storage)
PUPPETEER_EXECUTABLE_PATH  # Chrome binary for PDF generation (optional, for Docker/Railway)
```

Resend variables already exist from the contact form.

---

## 11. Dependencies to Add

```
signature_pad    # Canvas-based signature capture
puppeteer        # Headless Chrome for PDF generation
```

---

## 12. File Summary

### New Files

| File | Purpose |
|------|---------|
| `app/proposals/[token]/page.tsx` | Public proposal signing view |
| `app/proposals/[token]/AcceptanceBlock.tsx` | Signature capture component (shared logic) |
| `app/change-orders/[token]/page.tsx` | Public change order signing view |
| `app/change-orders/[token]/ChangeOrderSigningBlock.tsx` | CO signature component |
| `app/internal/projects/[id]/change-order/new/page.tsx` | Create change order (internal) |
| `app/api/quotes/[id]/send/route.ts` | Send signing link |
| `app/api/quotes/[id]/signed-pdf/route.ts` | Download signed PDF |
| `app/api/sign/quote/[token]/route.ts` | Process quote signature |
| `app/api/sign/change-order/[token]/route.ts` | Process CO signature |
| `app/api/internal/change-orders/route.ts` | Create change order |
| `app/api/change-orders/[id]/send/route.ts` | Send CO signing link |
| `lib/docs/proposal-template.ts` | HTML template for proposal PDF |
| `lib/docs/change-order-template.ts` | HTML template for CO PDF |
| `lib/docs/pdf.ts` | Puppeteer PDF generation |
| `lib/docs/email.ts` | Email templates and send functions |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add QuoteStatus, ChangeOrderStatus enums, Acceptance model, ChangeOrder model, new Quote fields |
| `app/internal/quotes/[id]/page.tsx` | Upgrade to styled proposal view with send/sign actions |
| `app/internal/projects/[id]/page.tsx` | Add change order section with running total |
| `app/internal/projects/[id]/quote/new/page.tsx` | Add payment terms + exclusions fields to quote creation |
| `app/api/internal/quote/save/route.ts` | Save new quote fields (paymentTerms, exclusions, status) |
