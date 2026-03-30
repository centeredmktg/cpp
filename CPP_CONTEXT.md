# CPP Painting & Building — Project Context

**Last updated:** 2026-03-13
**Status:** Task 1 in progress — need to redo from new project root

---

## Project Location

**New path:** `~/dcox/centered-os/projects/bld-inc/cpp`
(Note: parent dir is `bld-inc`, not `bldn-inc`)

**Old path (no longer exists):** `~/cpp`

## Client

- **Client:** Johnny Avila — CPP Painting & Building, Reno NV
- **Phone:** (775) 386-3962
- **Email:** johnny@cpppainting.com

## What We're Building

A Next.js monolith with:
1. **Public marketing site** — industrial black/white design, no accent color (`#111110` bg)
2. **Internal CRM + quote generator** — password-protected `/internal` routes

**Three service pillars:** Interior Paint · Exterior Paint · Epoxy Floors

## Stack

Next.js 16, Tailwind v4, Framer Motion, Prisma + SQLite, next-auth (credentials), Claude API (Anthropic SDK), Resend

## Spec & Plan Files

Spec and plan were written in the old `/Users/dcox/cpp` directory. They need to be recreated or moved to the new project root:

- **Spec:** `docs/superprompts/specs/2026-03-13-cpppainting-website.md`
- **Plan:** `docs/superprompts/plans/2026-03-13-cpppainting-website.md`

Full spec and plan content is in Claude's memory and can be regenerated. Key approved sections:

### Section 1: Public Site (approved)
- Nav, Hero, Services, Work, Contact, About, Footer
- Dark palette: `#111110` bg, white text, no accent
- Work section above About (portfolio sells, bio supports)

### Section 2: Internal Admin (approved)
- Kanban: Lead → Quoted → Contracted → In Progress → Complete → Lost
- Project detail with people (roles), quotes, financials
- Quote generator: measurement form → Claude → line-item quote
- Pricing baseline editor

### Section 3: Data Model (approved)
- Project, Person, PersonOnProject (join table with role), Quote, PricingBaseline
- `hubspotId` nullable on Project + Person (HubSpot-ready from day one)
- Quote.lineItems stored as Json

## 17-Task Implementation Plan

Tasks are sequential. Start from Task 1.

| Task | Description | Status |
|------|-------------|--------|
| 1 | Initialize project (Next.js scaffold, deps, Prisma init, Jest config) | **REDO** — old dir gone |
| 2 | Prisma schema + migration + seed |
| 3 | Auth (next-auth credentials, login page, internal layout guard) |
| 4 | Root layout + globals.css |
| 5 | Nav component |
| 6 | Hero component |
| 7 | Services component |
| 8 | Work, About, Footer |
| 9 | Contact form + API + Resend |
| 10 | Assemble public home page |
| 11 | Projects API (GET/POST/PATCH) |
| 12 | Kanban board |
| 13 | Project detail page |
| 14 | Claude quote generation (lib/claude.ts + /api/quotes) |
| 15 | Quote generator UI + quote view |
| 16 | Pricing baseline editor |
| 17 | Internal nav + final wiring + smoke test |

## Key Notes for Task 1

- `create-next-app` will prompt for linter interactively — use `--eslint` flag or answer ESLint
- Tailwind v4 does NOT generate `tailwind.config.ts` — it uses postcss
- Use `jest@^29.7.0` NOT v30 — `ts-jest@29` is incompatible with Jest 30
- Create `tsconfig.test.json` pointing ts-jest at `moduleResolution: node` to avoid bundler conflicts
- Add `"test": "jest"` to package.json scripts
- `.env.local` must be gitignored (`.env*` pattern covers it)
- `prisma init` generates `.env` — make sure it has `url = env("DATABASE_URL")` in the datasource block

## .env.local Template

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

## Design Decisions

- Color: `#111110` bg, white text, no accent — industrial/minimal
- Font: Geist (from next/font/google)
- Animations: Framer Motion on Hero section
- Photos: Static in `public/work/` — no DB-driven gallery (YAGNI)
- HubSpot: `hubspotId` nullable fields from day one, sync is future work
- Quote AI: Claude generates line-item JSON from measurements + pricing baseline

## License Placeholder

Footer has `NV License #[LICENSE_NUMBER]` — get the actual number from Johnny before launch.
