# CPP Painting & Building Website Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js monolith with a public marketing site and password-protected internal CRM + AI quote generator for CPP Painting & Building.

**Architecture:** One Next.js 16 app with App Router. Public routes serve the marketing site. `/internal` routes are protected by next-auth credentials auth. Prisma + SQLite for data. Claude API for quote generation. Resend for email.

**Tech Stack:** Next.js 16, Tailwind v4, Framer Motion, Prisma + SQLite, next-auth, Claude API (Anthropic SDK), Resend

**Spec:** `docs/superprompts/specs/2026-03-13-cpppainting-website.md`

---

## Chunk 1: Foundation

### File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies |
| `next.config.ts` | Next.js config |
| `tailwind.config.ts` | Tailwind v4 config |
| `prisma/schema.prisma` | Data model |
| `prisma/seed.ts` | Seed pricing baseline |
| `lib/db.ts` | Prisma client singleton |
| `lib/auth.ts` | next-auth config (credentials provider) |
| `app/api/auth/[...nextauth]/route.ts` | next-auth route handler |
| `app/internal/layout.tsx` | Auth guard for all `/internal` routes |
| `.env.local` | Environment variables (not committed) |
| `__tests__/lib/db.test.ts` | DB client instantiation test |

---

### Task 1: Initialize the project

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/dcox/cpp
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Expected: Next.js 16 project scaffolded in `/Users/dcox/cpp`

- [ ] **Step 2: Install dependencies**

```bash
npm install prisma @prisma/client next-auth@beta framer-motion resend @anthropic-ai/sdk
npm install -D @types/node jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest ts-node
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 4: Create `.env.local`** (never commit this)

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-with-strong-password"
ANTHROPIC_API_KEY="sk-ant-..."
RESEND_API_KEY="re_..."
RESEND_TO="johnny@cpppainting.com"
RESEND_FROM="noreply@cpppainting.com"
```

- [ ] **Step 5: Configure Jest** — create `jest.config.ts`

```typescript
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
}

export default config
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json next.config.ts tailwind.config.ts jest.config.ts .gitignore
git commit -m "chore: initialize next.js project with dependencies"
```

---

### Task 2: Prisma schema

- [ ] **Step 1: Write the failing test** — create `__tests__/lib/db.test.ts`

```typescript
import { PrismaClient } from '@prisma/client'

describe('db client', () => {
  it('instantiates without throwing', () => {
    expect(() => new PrismaClient()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/db.test.ts -v
```

Expected: FAIL — no generated Prisma client yet.

- [ ] **Step 3: Replace `prisma/schema.prisma` with full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Project {
  id          String        @id @default(cuid())
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  name        String
  serviceType ServiceType
  status      ProjectStatus @default(LEAD)
  description String?
  receivedAt  DateTime      @default(now())
  startDate   DateTime?
  targetDate  DateTime?
  completedAt DateTime?
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
  person    Person     @relation(fields: [personId], references: [id])
  personId  String
  project   Project    @relation(fields: [projectId], references: [id])
  projectId String
  role      PersonRole
  @@id([personId, projectId])
}

model Quote {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id])
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

- [ ] **Step 4: Generate client and run migration**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` created, `dev.db` created.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/lib/db.test.ts -v
```

Expected: PASS

- [ ] **Step 6: Create `lib/db.ts`** (Prisma client singleton)

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 7: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const baselines = [
    { key: 'interior_wall_sqft',    label: 'Interior Wall (per sqft)',    rate: 1.50, unit: 'sqft' },
    { key: 'interior_ceiling_sqft', label: 'Interior Ceiling (per sqft)', rate: 1.75, unit: 'sqft' },
    { key: 'interior_trim_lf',      label: 'Interior Trim (per LF)',      rate: 2.00, unit: 'lf'   },
    { key: 'exterior_sqft',         label: 'Exterior (per sqft)',         rate: 2.25, unit: 'sqft' },
    { key: 'epoxy_sqft',            label: 'Epoxy Floor (per sqft)',      rate: 3.50, unit: 'sqft' },
  ]

  for (const b of baselines) {
    await prisma.pricingBaseline.upsert({
      where: { key: b.key },
      update: {},
      create: b,
    })
  }

  console.log('Seeded pricing baselines.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [ ] **Step 8: Run seed**

```bash
npx prisma db seed
```

Expected: "Seeded pricing baselines."

- [ ] **Step 9: Commit**

```bash
git add prisma/ lib/db.ts __tests__/lib/db.test.ts
git commit -m "feat: add prisma schema, migration, seed data, and db client"
```

---

### Task 3: Auth

- [ ] **Step 1: Write failing test** — create `__tests__/lib/auth.test.ts`

```typescript
describe('auth config', () => {
  it('exports authOptions with credentials provider', async () => {
    const { authOptions } = await import('@/lib/auth')
    expect(authOptions.providers).toHaveLength(1)
    expect(authOptions.providers[0].id).toBe('credentials')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/auth.test.ts -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/auth.ts`**

```typescript
import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.ADMIN_USERNAME &&
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return { id: '1', name: 'Admin' }
        }
        return null
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/internal/login' },
}
```

- [ ] **Step 4: Create `app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 5: Create `app/internal/login/page.tsx`**

```tsx
'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const result = await signIn('credentials', {
      username: (form.elements.namedItem('username') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      redirect: false,
    })
    if (result?.ok) router.push('/internal/projects')
    else setError('Invalid credentials')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111110]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1 className="text-white text-xl font-semibold">CPP Admin</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input name="username" type="text" placeholder="Username"
          className="bg-zinc-900 text-white border border-zinc-700 rounded px-3 py-2" />
        <input name="password" type="password" placeholder="Password"
          className="bg-zinc-900 text-white border border-zinc-700 rounded px-3 py-2" />
        <button type="submit"
          className="bg-white text-black font-medium rounded px-3 py-2 hover:bg-zinc-200">
          Sign in
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/internal/layout.tsx`** (auth guard)

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/internal/login')
  return <div className="min-h-screen bg-[#111110] text-white">{children}</div>
}
```

- [ ] **Step 7: Run auth test**

```bash
npx jest __tests__/lib/auth.test.ts -v
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/auth.ts app/api/auth/ app/internal/login/ app/internal/layout.tsx __tests__/lib/auth.test.ts
git commit -m "feat: add next-auth credentials auth with admin login page"
```

---

## Chunk 2: Public Site

### File Map

| File | Responsibility |
|---|---|
| `app/layout.tsx` | Root layout (fonts, metadata) |
| `app/page.tsx` | Public home — assembles all sections |
| `app/globals.css` | Global styles, Tailwind base |
| `components/public/Nav.tsx` | Nav bar with mobile hamburger |
| `components/public/Hero.tsx` | Hero section with stat bar + CTAs |
| `components/public/Services.tsx` | Three-column service cards |
| `components/public/Work.tsx` | Static photo grid |
| `components/public/About.tsx` | About section |
| `components/public/Contact.tsx` | Contact form (client component) |
| `components/public/Footer.tsx` | Footer |
| `app/api/contact/route.ts` | Contact form API handler |
| `lib/resend.ts` | Resend email helper |
| `__tests__/api/contact.test.ts` | Contact API route test |

---

### Task 4: Root layout and global styles

- [ ] **Step 1: Update `app/globals.css`**

Replace the scaffolded content with:

```css
@import "tailwindcss";

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  -webkit-font-smoothing: antialiased;
}

input, textarea, select, button {
  font-family: inherit;
}

@media print {
  .print\:hidden { display: none !important; }
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'CPP Painting & Building | Reno, NV',
  description: 'Production-grade painting and epoxy floors in Reno, NV. Interior, exterior, and epoxy floor specialists serving builders and property managers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="bg-[#111110] text-white antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "chore: configure root layout, fonts, and global styles"
```

---

### Task 5: Nav component

- [ ] **Step 1: Write failing test** — create `__tests__/components/Nav.test.tsx`

Update `jest.config.ts` to use `jsdom` environment for component tests:
```typescript
// In jest.config.ts, add testEnvironmentOptions or use per-file docblock
// Add this to the top of Nav.test.tsx:
// @jest-environment jsdom
```

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Nav from '@/components/public/Nav'

describe('Nav', () => {
  it('renders logo text', () => {
    render(<Nav />)
    expect(screen.getByText(/CPP/i)).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Nav />)
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/Nav.test.tsx -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/public/Nav.tsx`**

```tsx
'use client'

import { useState } from 'react'

const links = [
  { label: 'Services', href: '#services' },
  { label: 'Work', href: '#work' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#111110]/90 backdrop-blur border-b border-zinc-800">
      <a href="/" className="text-white font-bold text-lg tracking-tight">CPP</a>

      {/* Desktop links */}
      <ul className="hidden md:flex gap-8">
        {links.map(l => (
          <li key={l.label}>
            <a href={l.href} className="text-zinc-400 hover:text-white text-sm transition-colors">
              {l.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Mobile hamburger */}
      <button className="md:hidden text-zinc-400" onClick={() => setOpen(!open)} aria-label="Menu">
        <span className="block w-5 h-px bg-current mb-1" />
        <span className="block w-5 h-px bg-current mb-1" />
        <span className="block w-5 h-px bg-current" />
      </button>

      {/* Mobile menu */}
      {open && (
        <ul className="absolute top-full left-0 right-0 bg-[#111110] border-b border-zinc-800 flex flex-col md:hidden">
          {links.map(l => (
            <li key={l.label}>
              <a href={l.href} onClick={() => setOpen(false)}
                className="block px-6 py-3 text-zinc-400 hover:text-white text-sm border-t border-zinc-800">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/Nav.test.tsx -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/public/Nav.tsx __tests__/components/Nav.test.tsx
git commit -m "feat: add nav component with mobile hamburger"
```

---

### Task 6: Hero component

- [ ] **Step 1: Write failing test** — create `__tests__/components/Hero.test.tsx`

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Hero from '@/components/public/Hero'

describe('Hero', () => {
  it('renders headline', () => {
    render(<Hero />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('renders Get a Quote CTA', () => {
    render(<Hero />)
    expect(screen.getByText(/Get a Quote/i)).toBeInTheDocument()
  })

  it('renders service ticker items', () => {
    render(<Hero />)
    expect(screen.getByText(/Interior Paint/i)).toBeInTheDocument()
    expect(screen.getByText(/Epoxy Floors/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/Hero.test.tsx -v
```

Expected: FAIL

- [ ] **Step 3: Create `components/public/Hero.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'

const stats = [
  { value: '15+', label: 'Years in business' },
  { value: '2M+', label: 'Sq ft painted' },
  { value: 'Licensed', label: '& insured, NV' },
]

const services = ['Interior Paint', 'Exterior Paint', 'Epoxy Floors']

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col justify-center pt-20 px-6 md:px-12 max-w-6xl mx-auto">
      <motion.h1
        className="text-5xl md:text-7xl font-bold leading-tight tracking-tight max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        Production-grade painting & epoxy floors.
        <span className="text-zinc-400"> Reno, NV.</span>
      </motion.h1>

      {/* Stat bar */}
      <motion.div
        className="flex flex-wrap gap-8 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        {stats.map(s => (
          <div key={s.label}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-zinc-500 text-sm">{s.label}</div>
          </div>
        ))}
      </motion.div>

      {/* CTAs */}
      <motion.div
        className="flex gap-4 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <a href="#contact"
          className="bg-white text-black font-semibold px-6 py-3 rounded hover:bg-zinc-200 transition-colors">
          Get a Quote
        </a>
        <a href="#work"
          className="border border-zinc-600 text-white font-semibold px-6 py-3 rounded hover:border-white transition-colors">
          Our Work
        </a>
      </motion.div>

      {/* Service ticker */}
      <div className="mt-16 pt-8 border-t border-zinc-800 flex gap-6 text-zinc-500 text-sm">
        {services.map((s, i) => (
          <span key={s}>
            {s}{i < services.length - 1 && <span className="ml-6 text-zinc-700">·</span>}
          </span>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/Hero.test.tsx -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/public/Hero.tsx __tests__/components/Hero.test.tsx
git commit -m "feat: add hero section with stat bar, CTAs, and service ticker"
```

---

### Task 7: Services component

- [ ] **Step 1: Write failing test** — create `__tests__/components/Services.test.tsx`

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Services from '@/components/public/Services'

describe('Services', () => {
  it('renders all three service cards', () => {
    render(<Services />)
    expect(screen.getByText('Interior Painting')).toBeInTheDocument()
    expect(screen.getByText('Exterior Painting')).toBeInTheDocument()
    expect(screen.getByText('Epoxy Floors')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/Services.test.tsx -v
```

Expected: FAIL

- [ ] **Step 3: Create `components/public/Services.tsx`**

```tsx
const services = [
  {
    title: 'Interior Painting',
    description: 'Walls, ceilings, trim, and doors. We work around occupied spaces and tight timelines.',
    measureNote: 'To quote: wall sqft, ceiling sqft, trim linear feet.',
  },
  {
    title: 'Exterior Painting',
    description: 'Siding, stucco, fascia, and trim. Proper prep and durable coatings built for Nevada weather.',
    measureNote: 'To quote: exterior surface sqft.',
  },
  {
    title: 'Epoxy Floors',
    description: 'Garages, warehouses, and commercial floors. High-build epoxy with broadcast or solid finish.',
    measureNote: 'To quote: floor sqft.',
  },
]

export default function Services() {
  return (
    <section id="services" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-12">Services</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {services.map(s => (
          <div key={s.title} className="border border-zinc-800 rounded-lg p-6 flex flex-col gap-4">
            <h3 className="text-xl font-semibold">{s.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{s.description}</p>
            <p className="text-zinc-600 text-xs mt-auto pt-4 border-t border-zinc-800">{s.measureNote}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/Services.test.tsx -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/public/Services.tsx __tests__/components/Services.test.tsx
git commit -m "feat: add services section with three-column cards"
```

---

### Task 8: Work, About, and Footer components

These are static layout components with no branching logic — no unit tests needed.

- [ ] **Step 1: Create `components/public/Work.tsx`**

```tsx
// Drop project photos into public/work/ as work-1.jpg, work-2.jpg, etc.
// Update the images array as photos are added.
const images = [
  '/work/work-1.jpg',
  '/work/work-2.jpg',
  '/work/work-3.jpg',
  '/work/work-4.jpg',
  '/work/work-5.jpg',
  '/work/work-6.jpg',
]

export default function Work() {
  return (
    <section id="work" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-12">Work</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((src, i) => (
          <div key={i} className="aspect-square bg-zinc-900 overflow-hidden rounded">
            <img src={src} alt={`Project ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `components/public/About.tsx`**

```tsx
export default function About() {
  return (
    <section id="about" className="py-24 px-6 md:px-12 max-w-6xl mx-auto border-t border-zinc-800">
      <div className="max-w-xl">
        <h2 className="text-3xl font-bold mb-6">About</h2>
        <p className="text-zinc-400 leading-relaxed mb-4">
          Johnny Avila has been painting commercially in the Reno area for over 15 years. CPP Painting & Building
          works primarily with general contractors, property managers, and developers who need a reliable production
          partner — not a one-man show.
        </p>
        <p className="text-zinc-400 leading-relaxed mb-8">
          No fuss. Show up on time, do the work right, hit the schedule.
        </p>
        <div className="flex gap-6 text-sm text-zinc-500">
          <span>Licensed — NV</span>
          <span>·</span>
          <span>Insured</span>
          <span>·</span>
          <span>Commercial & residential</span>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create `components/public/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 py-10 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-4 text-zinc-500 text-sm">
      <div>
        <div className="text-white font-bold mb-1">CPP Painting & Building</div>
        <div>Reno, NV</div>
        <div className="text-zinc-600 text-xs mt-1">NV License #[LICENSE_NUMBER]</div>
      </div>
      <div className="flex flex-col gap-1 text-right">
        <a href="tel:7753863962" className="hover:text-white">(775) 386-3962</a>
        <a href="mailto:johnny@cpppainting.com" className="hover:text-white">johnny@cpppainting.com</a>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/public/Work.tsx components/public/About.tsx components/public/Footer.tsx
git commit -m "feat: add work grid, about section, and footer"
```

---

### Task 9: Contact form + API

- [ ] **Step 1: Write failing test** — create `__tests__/api/contact.test.ts`

```typescript
import { POST } from '@/app/api/contact/route'
import { NextRequest } from 'next/server'

// Mock DB and email
jest.mock('@/lib/db', () => ({
  db: {
    person: { create: jest.fn().mockResolvedValue({ id: 'person-1' }) },
    project: { create: jest.fn().mockResolvedValue({ id: 'project-1' }) },
  },
}))

jest.mock('@/lib/resend', () => ({
  sendContactEmail: jest.fn().mockResolvedValue(undefined),
}))

describe('POST /api/contact', () => {
  it('returns 201 on valid payload', async () => {
    const req = new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob Smith',
        company: 'Smith Construction',
        email: 'bob@smith.com',
        phone: '7751234567',
        serviceType: 'INTERIOR',
        description: 'Need 3 units painted',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/contact.test.ts -v
```

Expected: FAIL

- [ ] **Step 3: Create `lib/resend.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendContactEmail(data: {
  name: string
  company?: string
  email: string
  phone: string
  serviceType: string
  description: string
  projectId: string
}) {
  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: process.env.RESEND_TO!,
    subject: `New quote request — ${data.serviceType} — ${data.name}`,
    text: `
New quote request from the CPP website.

Name: ${data.name}
Company: ${data.company ?? '—'}
Email: ${data.email}
Phone: ${data.phone}
Service: ${data.serviceType}

Description:
${data.description}

Project ID: ${data.projectId}
    `.trim(),
  })
}
```

- [ ] **Step 4: Create `app/api/contact/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendContactEmail } from '@/lib/resend'
import { ServiceType } from '@prisma/client'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, serviceType, description, company } = body

  if (!name || !email || !phone || !serviceType || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!Object.values(ServiceType).includes(serviceType)) {
    return NextResponse.json({ error: 'Invalid service type' }, { status: 400 })
  }

  const person = await db.person.create({
    data: { name, email, phone, company },
  })

  const project = await db.project.create({
    data: {
      name: `${name} — ${serviceType}`,
      serviceType,
      description,
      people: { create: { personId: person.id, role: 'OTHER' } },
    },
  })

  await sendContactEmail({ name, company, email, phone, serviceType, description, projectId: project.id })

  return NextResponse.json({ projectId: project.id }, { status: 201 })
}
```

- [ ] **Step 5: Create `components/public/Contact.tsx`**

```tsx
'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function Contact() {
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    setStatus(res.ok ? 'success' : 'error')
    if (res.ok) form.reset()
  }

  return (
    <section id="contact" className="py-24 px-6 md:px-12 max-w-6xl mx-auto border-t border-zinc-800">
      <div className="max-w-lg">
        <h2 className="text-3xl font-bold mb-2">Get a Quote</h2>
        <p className="text-zinc-500 text-sm mb-10">We'll follow up within one business day.</p>

        {status === 'success' ? (
          <p className="text-green-400">Got it — we'll be in touch soon.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <input name="name" required placeholder="Name"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm col-span-2 md:col-span-1" />
              <input name="company" placeholder="Company (optional)"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm col-span-2 md:col-span-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input name="email" type="email" required placeholder="Email"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" />
              <input name="phone" required placeholder="Phone"
                className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" />
            </div>
            <select name="serviceType" required
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-400">
              <option value="">Service type</option>
              <option value="INTERIOR">Interior Painting</option>
              <option value="EXTERIOR">Exterior Painting</option>
              <option value="EPOXY">Epoxy Floors</option>
            </select>
            <textarea name="description" required rows={4} placeholder="Describe the project"
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm resize-none" />
            {status === 'error' && <p className="text-red-400 text-sm">Something went wrong — please try again.</p>}
            <button type="submit" disabled={status === 'loading'}
              className="bg-white text-black font-semibold px-6 py-3 rounded hover:bg-zinc-200 disabled:opacity-50 transition-colors">
              {status === 'loading' ? 'Sending…' : 'Send Request'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest __tests__/api/contact.test.ts -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/contact/ lib/resend.ts components/public/Contact.tsx __tests__/api/contact.test.ts
git commit -m "feat: add contact form, API handler, and Resend email notification"
```

---

### Task 10: Assemble public home page

- [ ] **Step 1: Update `app/page.tsx`**

```tsx
import Nav from '@/components/public/Nav'
import Hero from '@/components/public/Hero'
import Services from '@/components/public/Services'
import Work from '@/components/public/Work'
import Contact from '@/components/public/Contact'
import About from '@/components/public/About'
import Footer from '@/components/public/Footer'

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Services />
        <Work />
        <Contact />
        <About />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Start dev server and verify public site renders**

```bash
npm run dev
```

Open http://localhost:3000 and verify: Nav, Hero, Services, Work, Contact, About, Footer all present and styled.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: assemble public home page"
```

---

## Chunk 3: Internal Admin + Integrations

### File Map

| File | Responsibility |
|---|---|
| `app/internal/projects/page.tsx` | Kanban board page (server component, fetches projects) |
| `components/internal/KanbanBoard.tsx` | Kanban column layout (client) |
| `components/internal/KanbanCard.tsx` | Individual project card |
| `app/internal/projects/[id]/page.tsx` | Project detail page (server component) |
| `components/internal/ProjectDetail.tsx` | Project detail form (client) |
| `app/internal/projects/[id]/quote/new/page.tsx` | Quote generator page |
| `components/internal/QuoteGenerator.tsx` | Measurement form + Claude call (client) |
| `app/internal/quotes/[id]/page.tsx` | Printable quote view |
| `components/internal/QuoteView.tsx` | Quote line-item display |
| `app/internal/settings/pricing/page.tsx` | Pricing baseline editor page |
| `components/internal/PricingEditor.tsx` | Pricing CRUD table (client) |
| `app/api/projects/route.ts` | GET all projects, POST new project |
| `app/api/projects/[id]/route.ts` | GET, PATCH project by id |
| `app/api/quotes/route.ts` | POST generate quote (calls Claude) |
| `app/api/quotes/[id]/route.ts` | GET quote by id |
| `app/api/pricing/route.ts` | GET all baselines, PATCH a baseline |
| `lib/claude.ts` | Claude quote generation logic |
| `__tests__/lib/claude.test.ts` | Quote generation unit test |

---

### Task 11: Projects API

- [ ] **Step 1: Write failing test** — create `__tests__/api/projects.test.ts`

```typescript
import { GET, POST } from '@/app/api/projects/route'
import { NextRequest } from 'next/server'

const mockProjects = [
  { id: 'p1', name: 'Test Project', serviceType: 'INTERIOR', status: 'LEAD', people: [], quotes: [] },
]

jest.mock('@/lib/db', () => ({
  db: {
    project: {
      findMany: jest.fn().mockResolvedValue(mockProjects),
      create: jest.fn().mockResolvedValue({ id: 'p2', ...mockProjects[0] }),
    },
  },
}))

describe('GET /api/projects', () => {
  it('returns project list', async () => {
    const res = await GET()
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('p1')
  })
})

describe('POST /api/projects', () => {
  it('creates a project', async () => {
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Job', serviceType: 'EPOXY', description: 'Garage floor' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/projects.test.ts -v
```

Expected: FAIL

- [ ] **Step 3: Create `app/api/projects/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ServiceType } from '@prisma/client'

export async function GET() {
  const projects = await db.project.findMany({
    include: { people: { include: { person: true } }, quotes: true },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, serviceType, description } = body

  if (!name || !serviceType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!Object.values(ServiceType).includes(serviceType)) {
    return NextResponse.json({ error: 'Invalid service type' }, { status: 400 })
  }

  const project = await db.project.create({
    data: { name, serviceType, description },
  })

  return NextResponse.json(project, { status: 201 })
}
```

- [ ] **Step 4: Create `app/api/projects/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { people: { include: { person: true } }, quotes: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { status, revenue, cost, notes, startDate, targetDate, completedAt } = body

  const project = await db.project.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(revenue !== undefined && { revenue }),
      ...(cost !== undefined && { cost }),
      ...(notes !== undefined && { notes }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(targetDate && { targetDate: new Date(targetDate) }),
      ...(completedAt && { completedAt: new Date(completedAt) }),
    },
  })
  return NextResponse.json(project)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/api/projects.test.ts -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/projects/ __tests__/api/projects.test.ts
git commit -m "feat: add projects API (GET, POST, PATCH)"
```

---

### Task 12: Kanban board

- [ ] **Step 1: Create `components/internal/KanbanCard.tsx`**

```tsx
import { ProjectStatus, ServiceType } from '@prisma/client'

type Project = {
  id: string
  name: string
  serviceType: ServiceType
  status: ProjectStatus
  revenue?: number | null
  people: { person: { name: string }; role: string }[]
}

const serviceLabel: Record<ServiceType, string> = {
  INTERIOR: 'Interior',
  EXTERIOR: 'Exterior',
  EPOXY: 'Epoxy',
}

export default function KanbanCard({ project }: { project: Project }) {
  const primaryPerson = project.people[0]?.person.name

  return (
    <a href={`/internal/projects/${project.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded p-3 hover:border-zinc-600 transition-colors">
      <div className="text-sm font-medium mb-1 truncate">{project.name}</div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-zinc-500">{serviceLabel[project.serviceType]}</span>
        {project.revenue && (
          <span className="text-xs text-zinc-400">${project.revenue.toLocaleString()}</span>
        )}
      </div>
      {primaryPerson && (
        <div className="text-xs text-zinc-600 mt-1 truncate">{primaryPerson}</div>
      )}
    </a>
  )
}
```

- [ ] **Step 2: Create `components/internal/KanbanBoard.tsx`**

```tsx
'use client'

import { ProjectStatus } from '@prisma/client'
import KanbanCard from './KanbanCard'

const COLUMNS: ProjectStatus[] = ['LEAD', 'QUOTED', 'CONTRACTED', 'IN_PROGRESS', 'COMPLETE', 'LOST']
const COLUMN_LABEL: Record<ProjectStatus, string> = {
  LEAD: 'Lead', QUOTED: 'Quoted', CONTRACTED: 'Contracted',
  IN_PROGRESS: 'In Progress', COMPLETE: 'Complete', LOST: 'Lost',
}

type Project = Parameters<typeof KanbanCard>[0]['project']

export default function KanbanBoard({ projects }: { projects: Project[] }) {
  const byStatus = (status: ProjectStatus) => projects.filter(p => p.status === status)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => (
        <div key={col} className="flex-shrink-0 w-56">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex justify-between">
            <span>{COLUMN_LABEL[col]}</span>
            <span>{byStatus(col).length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {byStatus(col).map(p => <KanbanCard key={p.id} project={p} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/internal/projects/page.tsx`**

```tsx
import { db } from '@/lib/db'
import KanbanBoard from '@/components/internal/KanbanBoard'

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    include: { people: { include: { person: true } }, quotes: true },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Projects</h1>
      </div>
      <KanbanBoard projects={projects} />
    </div>
  )
}
```

- [ ] **Step 4: Create `app/internal/page.tsx`** (redirect)

```tsx
import { redirect } from 'next/navigation'

export default function InternalPage() {
  redirect('/internal/projects')
}
```

- [ ] **Step 5: Commit**

```bash
git add components/internal/KanbanCard.tsx components/internal/KanbanBoard.tsx app/internal/projects/page.tsx app/internal/page.tsx
git commit -m "feat: add kanban board for project pipeline"
```

---

### Task 13: Project detail page

- [ ] **Step 1: Create `components/internal/ProjectDetail.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ProjectStatus, ServiceType } from '@prisma/client'

type Person = { id: string; name: string; email?: string | null; phone?: string | null; company?: string | null }
type PersonOnProject = { person: Person; role: string }
type Quote = { id: string; total: number; createdAt: string }
type Project = {
  id: string; name: string; serviceType: ServiceType; status: ProjectStatus
  description?: string | null; revenue?: number | null; cost?: number | null
  notes?: string | null; startDate?: string | null; targetDate?: string | null
  completedAt?: string | null; people: PersonOnProject[]; quotes: Quote[]
}

const STATUS_OPTIONS: ProjectStatus[] = ['LEAD','QUOTED','CONTRACTED','IN_PROGRESS','COMPLETE','LOST']

export default function ProjectDetail({ project }: { project: Project }) {
  const [form, setForm] = useState({
    status: project.status,
    revenue: project.revenue ?? '',
    cost: project.cost ?? '',
    notes: project.notes ?? '',
  })
  const [saved, setSaved] = useState(false)

  async function save() {
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-zinc-500 text-sm mt-1">{project.serviceType}</p>
        </div>
        <a href={`/internal/projects/${project.id}/quote/new`}
          className="bg-white text-black text-sm font-semibold px-4 py-2 rounded hover:bg-zinc-200">
          New Quote
        </a>
      </div>

      {/* Status */}
      <div className="mb-6">
        <label className="block text-xs text-zinc-500 mb-1">Status</label>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Revenue ($)</label>
          <input type="number" value={form.revenue} onChange={e => setForm({ ...form, revenue: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Cost ($)</label>
          <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-full" />
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-xs text-zinc-500 mb-1">Notes</label>
        <textarea rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-full resize-none" />
      </div>

      <button onClick={save}
        className="bg-white text-black font-semibold px-4 py-2 rounded text-sm hover:bg-zinc-200">
        {saved ? 'Saved!' : 'Save Changes'}
      </button>

      {/* People */}
      {project.people.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">People</h2>
          <div className="flex flex-col gap-2">
            {project.people.map(pp => (
              <div key={pp.person.id} className="bg-zinc-900 border border-zinc-800 rounded p-3 text-sm">
                <div className="font-medium">{pp.person.name}</div>
                <div className="text-zinc-500 text-xs">{pp.role} · {pp.person.email} · {pp.person.phone}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quotes */}
      {project.quotes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Quotes</h2>
          <div className="flex flex-col gap-2">
            {project.quotes.map(q => (
              <a key={q.id} href={`/internal/quotes/${q.id}`}
                className="bg-zinc-900 border border-zinc-800 rounded p-3 text-sm flex justify-between hover:border-zinc-600">
                <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                <span className="font-medium">${q.total.toLocaleString()}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/internal/projects/[id]/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import ProjectDetail from '@/components/internal/ProjectDetail'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { people: { include: { person: true } }, quotes: true },
  })
  if (!project) notFound()

  return (
    <div className="p-6">
      <a href="/internal/projects" className="text-zinc-500 text-sm hover:text-white mb-6 block">← Projects</a>
      <ProjectDetail project={project as any} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/internal/ProjectDetail.tsx app/internal/projects/[id]/page.tsx
git commit -m "feat: add project detail page with status, financials, notes, people, and quotes"
```

---

### Task 14: Claude quote generation

- [ ] **Step 1: Write failing test** — create `__tests__/lib/claude.test.ts`

```typescript
import { buildQuotePrompt, parseQuoteResponse } from '@/lib/claude'

describe('buildQuotePrompt', () => {
  it('includes service type and measurements in prompt', () => {
    const prompt = buildQuotePrompt({
      serviceType: 'INTERIOR',
      measurements: { wall_sqft: 1000, ceiling_sqft: 300, trim_lf: 200 },
      baselines: [
        { key: 'interior_wall_sqft', label: 'Interior Wall', rate: 1.5, unit: 'sqft' },
        { key: 'interior_ceiling_sqft', label: 'Interior Ceiling', rate: 1.75, unit: 'sqft' },
        { key: 'interior_trim_lf', label: 'Interior Trim', rate: 2.0, unit: 'lf' },
      ],
    })
    expect(prompt).toContain('INTERIOR')
    expect(prompt).toContain('1000')
    expect(prompt).toContain('1.5')
  })
})

describe('parseQuoteResponse', () => {
  it('parses valid JSON line items', () => {
    const raw = JSON.stringify([
      { label: 'Interior Wall', qty: 1000, unit: 'sqft', rate: 1.5, total: 1500 },
    ])
    const result = parseQuoteResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].total).toBe(1500)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseQuoteResponse('not json')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/claude.test.ts -v
```

Expected: FAIL

- [ ] **Step 3: Create `lib/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Baseline = { key: string; label: string; rate: number; unit: string }
type LineItem = { label: string; qty: number; unit: string; rate: number; total: number }

export function buildQuotePrompt({
  serviceType,
  measurements,
  baselines,
}: {
  serviceType: string
  measurements: Record<string, number>
  baselines: Baseline[]
}) {
  const measurementStr = Object.entries(measurements)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')

  const rateStr = baselines
    .map(b => `  ${b.label}: $${b.rate} per ${b.unit}`)
    .join('\n')

  return `You are a painting contractor quoting a job.

Service type: ${serviceType}

Measurements provided:
${measurementStr}

Current pricing rates:
${rateStr}

Generate a line-item quote as a JSON array. Each item must have:
- label (string): description of the line item
- qty (number): quantity
- unit (string): unit of measure
- rate (number): price per unit
- total (number): qty * rate

Return ONLY the JSON array, no other text.`
}

export function parseQuoteResponse(raw: string): LineItem[] {
  const cleaned = raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
  const items = JSON.parse(cleaned)
  if (!Array.isArray(items)) throw new Error('Expected array')
  return items
}

export async function generateQuote({
  serviceType,
  measurements,
  baselines,
}: {
  serviceType: string
  measurements: Record<string, number>
  baselines: Baseline[]
}): Promise<{ lineItems: LineItem[]; subtotal: number; total: number }> {
  const prompt = buildQuotePrompt({ serviceType, measurements, baselines })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text
  const lineItems = parseQuoteResponse(raw)
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)

  return { lineItems, subtotal, total: subtotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/claude.test.ts -v
```

Expected: PASS

- [ ] **Step 5: Create `app/api/quotes/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateQuote } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { projectId, measurements } = body

  if (!projectId || !measurements) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const baselines = await db.pricingBaseline.findMany()

  const { lineItems, subtotal, total } = await generateQuote({
    serviceType: project.serviceType,
    measurements,
    baselines,
  })

  const quote = await db.quote.create({
    data: { projectId, lineItems, subtotal, total },
  })

  // Advance project to QUOTED if still a LEAD
  if (project.status === 'LEAD') {
    await db.project.update({ where: { id: projectId }, data: { status: 'QUOTED' } })
  }

  return NextResponse.json(quote, { status: 201 })
}
```

- [ ] **Step 6: Create `app/api/quotes/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const quote = await db.quote.findUnique({
    where: { id: params.id },
    include: { project: true },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(quote)
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/claude.ts app/api/quotes/ __tests__/lib/claude.test.ts
git commit -m "feat: add Claude quote generation with prompt builder and API route"
```

---

### Task 15: Quote generator UI

- [ ] **Step 1: Create `components/internal/QuoteGenerator.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ServiceType } from '@prisma/client'

type Field = { key: string; label: string; unit: string }

const FIELDS: Record<ServiceType, Field[]> = {
  INTERIOR: [
    { key: 'wall_sqft', label: 'Wall area', unit: 'sqft' },
    { key: 'ceiling_sqft', label: 'Ceiling area', unit: 'sqft' },
    { key: 'trim_lf', label: 'Trim', unit: 'linear ft' },
  ],
  EXTERIOR: [
    { key: 'exterior_sqft', label: 'Exterior surface area', unit: 'sqft' },
  ],
  EPOXY: [
    { key: 'floor_sqft', label: 'Floor area', unit: 'sqft' },
  ],
}

export default function QuoteGenerator({
  projectId,
  serviceType,
}: {
  projectId: string
  serviceType: ServiceType
}) {
  const fields = FIELDS[serviceType]
  const [measurements, setMeasurements] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const parsed = Object.fromEntries(
      Object.entries(measurements).map(([k, v]) => [k, parseFloat(v)])
    )

    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, measurements: parsed }),
    })

    if (!res.ok) {
      setError('Failed to generate quote. Check the console.')
      setLoading(false)
      return
    }

    const quote = await res.json()
    router.push(`/internal/quotes/${quote.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-4">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-xs text-zinc-500 mb-1">{f.label} ({f.unit})</label>
          <input
            type="number" required min="0" step="0.1"
            value={measurements[f.key] ?? ''}
            onChange={e => setMeasurements({ ...measurements, [f.key]: e.target.value })}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm w-full"
          />
        </div>
      ))}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="bg-white text-black font-semibold px-4 py-2 rounded hover:bg-zinc-200 disabled:opacity-50">
        {loading ? 'Generating…' : 'Generate Quote'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `app/internal/projects/[id]/quote/new/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import QuoteGenerator from '@/components/internal/QuoteGenerator'

export default async function NewQuotePage({ params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id } })
  if (!project) notFound()

  return (
    <div className="p-6">
      <a href={`/internal/projects/${project.id}`} className="text-zinc-500 text-sm hover:text-white mb-6 block">
        ← {project.name}
      </a>
      <h1 className="text-2xl font-bold mb-2">New Quote</h1>
      <p className="text-zinc-500 text-sm mb-8">Enter measurements to generate a line-item quote.</p>
      <QuoteGenerator projectId={project.id} serviceType={project.serviceType} />
    </div>
  )
}
```

- [ ] **Step 3: Create `components/internal/QuoteView.tsx`**

```tsx
type LineItem = { label: string; qty: number; unit: string; rate: number; total: number }

type Quote = {
  id: string
  createdAt: string
  subtotal: number
  tax?: number | null
  total: number
  notes?: string | null
  lineItems: LineItem[]
  project: { id: string; name: string; serviceType: string }
}

export default function QuoteView({ quote }: { quote: Quote }) {
  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-start mb-8 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold">Quote</h1>
          <p className="text-zinc-500 text-sm mt-1">{quote.project.name}</p>
          <p className="text-zinc-600 text-xs">{new Date(quote.createdAt).toLocaleDateString()}</p>
        </div>
        <button onClick={() => window.print()}
          className="bg-white text-black text-sm font-semibold px-4 py-2 rounded hover:bg-zinc-200 print:hidden">
          Print
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
            <th className="text-left pb-2">Description</th>
            <th className="text-right pb-2">Qty</th>
            <th className="text-right pb-2">Unit</th>
            <th className="text-right pb-2">Rate</th>
            <th className="text-right pb-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lineItems.map((item, i) => (
            <tr key={i} className="border-b border-zinc-900">
              <td className="py-2">{item.label}</td>
              <td className="py-2 text-right text-zinc-400">{item.qty}</td>
              <td className="py-2 text-right text-zinc-400">{item.unit}</td>
              <td className="py-2 text-right text-zinc-400">${item.rate.toFixed(2)}</td>
              <td className="py-2 text-right font-medium">${item.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex flex-col items-end gap-1 text-sm">
        <div className="flex gap-8 text-zinc-400">
          <span>Subtotal</span>
          <span>${quote.subtotal.toLocaleString()}</span>
        </div>
        {quote.tax != null && (
          <div className="flex gap-8 text-zinc-400">
            <span>Tax</span>
            <span>${quote.tax.toLocaleString()}</span>
          </div>
        )}
        <div className="flex gap-8 font-bold text-base mt-2">
          <span>Total</span>
          <span>${quote.total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/internal/quotes/[id]/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import QuoteView from '@/components/internal/QuoteView'

export default async function QuotePage({ params }: { params: { id: string } }) {
  const quote = await db.quote.findUnique({
    where: { id: params.id },
    include: { project: true },
  })
  if (!quote) notFound()

  return (
    <div className="p-6">
      <a href={`/internal/projects/${quote.projectId}`}
        className="text-zinc-500 text-sm hover:text-white mb-6 block print:hidden">
        ← {quote.project.name}
      </a>
      <QuoteView quote={{ ...quote, lineItems: quote.lineItems as any, createdAt: quote.createdAt.toISOString() }} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/internal/QuoteGenerator.tsx components/internal/QuoteView.tsx app/internal/projects/[id]/quote/ app/internal/quotes/
git commit -m "feat: add quote generator UI and printable quote view"
```

---

### Task 16: Pricing baseline editor

- [ ] **Step 1: Create `app/api/pricing/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const baselines = await db.pricingBaseline.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json(baselines)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, rate } = body

  if (!id || rate === undefined) {
    return NextResponse.json({ error: 'Missing id or rate' }, { status: 400 })
  }

  const baseline = await db.pricingBaseline.update({
    where: { id },
    data: { rate: parseFloat(rate) },
  })
  return NextResponse.json(baseline)
}
```

- [ ] **Step 2: Create `components/internal/PricingEditor.tsx`**

```tsx
'use client'

import { useState } from 'react'

type Baseline = { id: string; key: string; label: string; rate: number; unit: string }

export default function PricingEditor({ initialBaselines }: { initialBaselines: Baseline[] }) {
  const [baselines, setBaselines] = useState(initialBaselines)
  const [saving, setSaving] = useState<string | null>(null)

  async function updateRate(id: string, rate: string) {
    setSaving(id)
    const res = await fetch('/api/pricing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rate }),
    })
    if (res.ok) {
      const updated = await res.json()
      setBaselines(prev => prev.map(b => b.id === id ? updated : b))
    }
    setSaving(null)
  }

  return (
    <div className="max-w-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
            <th className="text-left pb-2">Line item</th>
            <th className="text-right pb-2">Unit</th>
            <th className="text-right pb-2">Rate ($)</th>
          </tr>
        </thead>
        <tbody>
          {baselines.map(b => (
            <tr key={b.id} className="border-b border-zinc-900">
              <td className="py-3">{b.label}</td>
              <td className="py-3 text-right text-zinc-500">/{b.unit}</td>
              <td className="py-3 text-right">
                <input
                  type="number" step="0.01" min="0"
                  defaultValue={b.rate}
                  onBlur={e => updateRate(b.id, e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-24 text-right"
                />
                {saving === b.id && <span className="text-xs text-zinc-500 ml-2">saving…</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/internal/settings/pricing/page.tsx`**

```tsx
import { db } from '@/lib/db'
import PricingEditor from '@/components/internal/PricingEditor'

export default async function PricingPage() {
  const baselines = await db.pricingBaseline.findMany({ orderBy: { key: 'asc' } })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Pricing</h1>
      <p className="text-zinc-500 text-sm mb-8">Edit rates used by the quote generator. Click away from a field to save.</p>
      <PricingEditor initialBaselines={baselines} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/pricing/ components/internal/PricingEditor.tsx app/internal/settings/pricing/
git commit -m "feat: add pricing baseline editor"
```

---

### Task 17: Internal nav and final wiring

- [ ] **Step 1: Add internal nav to `app/internal/layout.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

const navLinks = [
  { label: 'Projects', href: '/internal/projects' },
  { label: 'Pricing', href: '/internal/settings/pricing' },
]

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/internal/login')

  return (
    <div className="min-h-screen bg-[#111110] text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <a href="/internal/projects" className="text-white font-bold">CPP Admin</a>
        <div className="flex gap-6">
          {navLinks.map(l => (
            <a key={l.label} href={l.href} className="text-zinc-400 hover:text-white text-sm">
              {l.label}
            </a>
          ))}
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests
```

Expected: All tests PASS.

- [ ] **Step 3: Start dev server and smoke test**

```bash
npm run dev
```

Verify manually:
- [ ] Public site loads at http://localhost:3000
- [ ] Contact form submits and creates DB record
- [ ] Login at http://localhost:3000/internal/login works
- [ ] Kanban board loads at http://localhost:3000/internal/projects
- [ ] Can open a project detail page
- [ ] Can navigate to new quote, enter measurements, generate quote
- [ ] Quote view displays line items and total
- [ ] Pricing editor loads and saves changes

- [ ] **Step 4: Final commit**

```bash
git add app/internal/layout.tsx
git commit -m "feat: add internal nav and complete internal admin shell"
```
