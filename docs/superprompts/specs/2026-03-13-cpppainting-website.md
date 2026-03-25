# CPP Painting & Building — Website Spec
**Date:** 2026-03-13
**Client:** Johnny Avila — CPP Painting & Building, Reno NV
**Phone:** (775) 386-3962 | **Email:** johnny@cpppainting.com

---

## Overview

A Next.js monolith with a public marketing site and a password-protected internal CRM + quote generator. Built on the same patterns as building-nv, reused wholesale where possible.

**Three service pillars:** Interior Paint · Exterior Paint · Epoxy Floors
**Positioning:** Production contractor, B2B-friendly (builders, property managers), no fuss.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind v4 |
| Animation | Framer Motion |
| Database | Prisma + SQLite |
| Auth | next-auth (credentials) |
| Email | Resend |
| AI | Claude API (quote generation) |
| Deployment | TBD |

---

## Public Site

### Color Palette
Near-black background (`#111110`), white text, no accent color — pure black/grey/white, industrial and minimal.

### Page Sections (top to bottom)

#### Nav
- Logo left, anchor links right: Services · About · Work · Contact
- Mobile hamburger

#### Hero
- Bold headline targeting builders/property managers: _"Production-grade painting & epoxy floors. Reno, NV."_
- Stat bar: years in business, sq ft painted, licensed/insured
- Two CTAs: **Get a Quote** + **Our Work**
- Service ticker at bottom: Interior Paint · Exterior Paint · Epoxy Floors

#### Services
Three-column cards:
- **Interior Painting** — description + measurement callout (what CPP needs to quote: sq ft of walls, ceilings, trim LF)
- **Exterior Painting** — description + measurement callout (sq ft of exterior surfaces)
- **Epoxy Floors** — description + measurement callout (sq ft of floor area)

#### Work
Static project photo grid — images in `public/`. No DB-driven gallery (YAGNI).

#### Contact
Form fields: Name, Company, Email, Phone, Service Type (dropdown), Project Description.
Submits to `/api/contact` → creates `Project` + `Person` in DB → Resend email to johnny@cpppainting.com.

#### About
Johnny Avila, qualifier and founder. Production-focused, no-fuss positioning. Licenses/credentials.

#### Footer
Logo, phone, address, license #.

---

## Internal Admin (`/internal`)

Single-user auth via next-auth credentials (same as building-nv).

### Routes

| Route | Description |
|---|---|
| `/internal` | Redirect to `/internal/projects` |
| `/internal/projects` | Kanban board |
| `/internal/projects/[id]` | Project detail |
| `/internal/projects/[id]/quote/new` | Quote generator |
| `/internal/quotes/[id]` | Quote view (printable) |
| `/internal/settings/pricing` | Pricing baseline editor |

### Kanban Board
Columns: **Lead → Quoted → Contracted → In Progress → Complete → Lost**
Cards show: project name, service type, associated person name, rough value.

### Project Detail
- Key dates: received, start, target completion, completed
- Revenue + cost fields (manual entry)
- Associated people — each with role: `homeowner | property_owner | property_manager | general_contractor | other`
- Notes field
- Linked quotes
- `hubspotId` field (nullable, hidden until used)

### Quote Generator
- Measurement input form (walls sqft, ceilings sqft, trim LF, exterior sqft, floor sqft — show/hide by service type)
- Sends measurements + current pricing baseline to Claude
- Claude returns line-item array: `[{label, qty, unit, rate, total}]`
- Saved as `Quote` record, displayed as printable breakdown

### Pricing Baseline Editor
Table of rates Johnny can update:
- Interior wall $/sqft
- Interior ceiling $/sqft
- Interior trim $/LF
- Exterior $/sqft
- Epoxy floor $/sqft
- (extensible — key/value rows)

---

## Data Model (Prisma)

```prisma
model Project {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  name        String
  serviceType ServiceType
  status      ProjectStatus @default(LEAD)
  description String?

  receivedAt   DateTime @default(now())
  startDate    DateTime?
  targetDate   DateTime?
  completedAt  DateTime?

  revenue     Float?
  cost        Float?

  notes       String?
  hubspotId   String?

  people      PersonOnProject[]
  quotes      Quote[]
}

model Person {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  name      String
  email     String?
  phone     String?
  company   String?
  hubspotId String?

  projects  PersonOnProject[]
}

model PersonOnProject {
  person    Person  @relation(fields: [personId], references: [id])
  personId  String
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  role      PersonRole

  @@id([personId, projectId])
}

model Quote {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  project   Project @relation(fields: [projectId], references: [id])
  projectId String

  lineItems Json
  subtotal  Float
  tax       Float?
  total     Float
  notes     String?
}

model PricingBaseline {
  id    String @id @default(cuid())
  key   String @unique
  label String
  rate  Float
  unit  String
}

enum ServiceType {
  INTERIOR
  EXTERIOR
  EPOXY
}

enum ProjectStatus {
  LEAD
  QUOTED
  CONTRACTED
  IN_PROGRESS
  COMPLETE
  LOST
}

enum PersonRole {
  HOMEOWNER
  PROPERTY_OWNER
  PROPERTY_MANAGER
  GENERAL_CONTRACTOR
  OTHER
}
```

---

## HubSpot Readiness
`hubspotId` is nullable on both `Project` and `Person` from day one. Future HubSpot sync is a one-sprint job when needed.

---

## Out of Scope (for now)
- DB-driven photo gallery
- Client-facing quote portal
- HubSpot sync
- Multi-user admin
