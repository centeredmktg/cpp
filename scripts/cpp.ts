#!/usr/bin/env -S npx tsx
/**
 * CPP Painting & Building — CLI
 *
 * Usage:
 *   npx tsx scripts/cpp.ts <resource> <command> [args] [--flags]
 *
 * Resources:
 *   projects  — manage projects
 *   people    — manage people/contacts
 *   quotes    — view quotes
 *   pricing   — manage pricing baselines
 *
 * Run `npx tsx scripts/cpp.ts help` for full usage.
 */

import 'dotenv/config'
import { db } from '../lib/db'

// ─── arg helpers ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const resource = args[0]
const command = args[1]

function flag(name: string): string | undefined {
  const match = args.find(a => a.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : undefined
}

function positional(n: number): string {
  // n=0 is the first positional after the command (args[2])
  const positionals = args.slice(2).filter(a => !a.startsWith('--'))
  return positionals[n] ?? ''
}

// ─── formatting ──────────────────────────────────────────────────────────────

const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'

const STATUS_COLOR: Record<string, string> = {
  LEAD: '\x1b[37m',
  QUOTED: '\x1b[36m',
  CONTRACTED: '\x1b[33m',
  IN_PROGRESS: '\x1b[34m',
  COMPLETE: '\x1b[32m',
  LOST: '\x1b[31m',
}

const SERVICE_SHORT: Record<string, string> = {
  INTERIOR: 'INT',
  EXTERIOR: 'EXT',
  EPOXY: 'EPX',
}

function col(text: string, width: number): string {
  const str = String(text)
  return str.length >= width ? str.slice(0, width - 1) + '…' : str.padEnd(width)
}

// ─── commands ─────────────────────────────────────────────────────────────────

async function projectsList() {
  const status = flag('status')?.toUpperCase()
  const projects = await db.project.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { people: { include: { person: true }, take: 1 } },
  })

  if (!projects.length) {
    console.log(`${DIM}No projects found.${RESET}`)
    return
  }

  console.log(
    `\n${DIM}${col('ID', 10)} ${col('STATUS', 13)} ${col('SVC', 5)} ${col('NAME', 40)} ${col('CONTACT', 22)} ${col('CREATED', 12)}${RESET}`
  )
  console.log(`${DIM}${'─'.repeat(106)}${RESET}`)

  for (const p of projects) {
    const color = STATUS_COLOR[p.status] ?? ''
    const contact = p.people[0]?.person.name ?? '—'
    const created = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    console.log(
      `${DIM}${p.id.slice(-8)}${RESET}  ${color}${col(p.status, 13)}${RESET} ${DIM}${col(SERVICE_SHORT[p.serviceType] ?? p.serviceType, 5)}${RESET} ${col(p.name, 40)} ${DIM}${col(contact, 22)}${RESET} ${DIM}${created}${RESET}`
    )
  }

  console.log(`\n${DIM}${projects.length} project(s)${status ? ` · filtered by ${status}` : ''}${RESET}\n`)
}

async function projectsShow() {
  const partialId = positional(0)
  if (!partialId) return die('Usage: projects show <id>')

  const projects = await db.project.findMany({
    where: { id: { endsWith: partialId } },
    include: {
      people: { include: { person: true } },
      quotes: { orderBy: { createdAt: 'desc' } },
    },
  })

  const project = projects[0]
  if (!project) return die(`No project found matching "${partialId}"`)

  console.log(`\n${BOLD}${project.name}${RESET}`)
  console.log(`${DIM}${project.id}${RESET}\n`)

  const field = (label: string, value: string | null | undefined) => {
    if (!value) return
    console.log(`  ${DIM}${label.padEnd(16)}${RESET}${value}`)
  }

  field('Status', `${STATUS_COLOR[project.status] ?? ''}${project.status}\x1b[0m`)
  field('Service', project.serviceType)
  field('Received', new Date(project.receivedAt).toLocaleDateString())
  field('Start', project.startDate ? new Date(project.startDate).toLocaleDateString() : null)
  field('Target', project.targetDate ? new Date(project.targetDate).toLocaleDateString() : null)
  field('Completed', project.completedAt ? new Date(project.completedAt).toLocaleDateString() : null)
  field('Revenue', project.revenue ? `$${project.revenue.toLocaleString()}` : null)
  field('Cost', project.cost ? `$${project.cost.toLocaleString()}` : null)
  field('Description', project.description)
  field('Notes', project.notes)

  if (project.people.length) {
    console.log(`\n  ${DIM}Contacts:${RESET}`)
    for (const pop of project.people) {
      const p = pop.person
      console.log(`    ${BOLD}${p.name}${RESET} ${DIM}(${pop.role})${RESET}`)
      if (p.company) console.log(`    ${DIM}${p.company}${RESET}`)
      if (p.email) console.log(`    ${DIM}${p.email}${RESET}`)
      if (p.phone) console.log(`    ${DIM}${p.phone}${RESET}`)
    }
  }

  if (project.quotes.length) {
    console.log(`\n  ${DIM}Quotes:${RESET}`)
    for (const q of project.quotes) {
      console.log(`    ${DIM}${q.id.slice(-8)}${RESET}  $${q.total.toFixed(2)}  ${DIM}${new Date(q.createdAt).toLocaleDateString()}${RESET}`)
    }
  }

  console.log()
}

async function projectsSetStatus() {
  const partialId = positional(0)
  const newStatus = positional(1)?.toUpperCase()

  const valid = ['LEAD', 'QUOTED', 'CONTRACTED', 'IN_PROGRESS', 'COMPLETE', 'LOST']

  if (!partialId || !newStatus) return die('Usage: projects set-status <id> <status>')
  if (!valid.includes(newStatus)) return die(`Invalid status. Must be one of: ${valid.join(', ')}`)

  const projects = await db.project.findMany({ where: { id: { endsWith: partialId } } })
  if (!projects.length) return die(`No project found matching "${partialId}"`)
  if (projects.length > 1) return die(`Ambiguous ID — ${projects.length} matches. Use more characters.`)

  const project = projects[0]
  await db.project.update({ where: { id: project.id }, data: { status: newStatus as any } })
  console.log(`${GREEN}✓${RESET} ${DIM}${project.id.slice(-8)}${RESET} ${DIM}→${RESET} ${STATUS_COLOR[newStatus] ?? ''}${newStatus}${RESET}`)
}

async function projectsCreate() {
  const name = flag('name')
  const serviceType = flag('service')?.toUpperCase()
  const description = flag('description') ?? flag('desc')

  if (!name || !serviceType) return die('Usage: projects create --name="..." --service=INTERIOR|EXTERIOR|EPOXY [--description="..."]')

  const valid = ['INTERIOR', 'EXTERIOR', 'EPOXY']
  if (!valid.includes(serviceType)) return die(`Invalid service. Must be: ${valid.join(', ')}`)

  const project = await db.project.create({
    data: {
      name,
      serviceType: serviceType as any,
      description: description ?? null,
    },
  })

  console.log(`${GREEN}✓${RESET} Created ${BOLD}${project.name}${RESET}`)
  console.log(`  ${DIM}id: ${project.id}${RESET}`)
}

async function pricingList() {
  const baselines = await db.pricingBaseline.findMany({ orderBy: { key: 'asc' } })

  console.log(`\n${DIM}${col('KEY', 28)} ${col('LABEL', 32)} ${col('RATE', 10)} ${col('UNIT', 8)}${RESET}`)
  console.log(`${DIM}${'─'.repeat(82)}${RESET}`)

  for (const b of baselines) {
    console.log(`${CYAN}${col(b.key, 28)}${RESET} ${col(b.label, 32)} ${BOLD}$${b.rate.toFixed(2)}${RESET}${DIM}/${b.unit}${RESET}`)
  }

  console.log()
}

async function pricingSet() {
  const key = positional(0)
  const rateStr = positional(1)

  if (!key || !rateStr) return die('Usage: pricing set <key> <rate>')

  const rate = parseFloat(rateStr)
  if (isNaN(rate) || rate < 0) return die('Rate must be a positive number')

  const baseline = await db.pricingBaseline.findUnique({ where: { key } })
  if (!baseline) return die(`No pricing baseline found with key "${key}"`)

  await db.pricingBaseline.update({ where: { key }, data: { rate } })
  console.log(`${GREEN}✓${RESET} ${CYAN}${key}${RESET} → ${BOLD}$${rate.toFixed(2)}${RESET}/${baseline.unit}`)
}

async function peopleList() {
  const search = flag('search') ?? positional(0)

  const people = await db.person.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { company: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: { projects: true },
    take: 50,
  })

  if (!people.length) {
    console.log(`${DIM}No people found.${RESET}`)
    return
  }

  console.log(`\n${DIM}${col('ID', 10)} ${col('NAME', 28)} ${col('COMPANY', 24)} ${col('EMAIL', 30)} ${col('PROJS', 6)}${RESET}`)
  console.log(`${DIM}${'─'.repeat(102)}${RESET}`)

  for (const p of people) {
    console.log(
      `${DIM}${p.id.slice(-8)}${RESET}  ${col(p.name, 28)} ${DIM}${col(p.company ?? '—', 24)}${RESET} ${DIM}${col(p.email ?? '—', 30)}${RESET} ${DIM}${p.projects.length}${RESET}`
    )
  }

  console.log(`\n${DIM}${people.length} contact(s)${search ? ` · "${search}"` : ''}${RESET}\n`)
}

async function quotesList() {
  const projectPartialId = positional(0)

  const quotes = await db.quote.findMany({
    where: projectPartialId ? { projectId: { endsWith: projectPartialId } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { project: true },
    take: 50,
  })

  if (!quotes.length) {
    console.log(`${DIM}No quotes found.${RESET}`)
    return
  }

  console.log(`\n${DIM}${col('ID', 10)} ${col('TOTAL', 12)} ${col('PROJECT', 44)} ${col('CREATED', 12)}${RESET}`)
  console.log(`${DIM}${'─'.repeat(82)}${RESET}`)

  for (const q of quotes) {
    console.log(
      `${DIM}${q.id.slice(-8)}${RESET}  ${BOLD}$${q.total.toFixed(2).padEnd(10)}${RESET} ${DIM}${col(q.project.name, 44)}${RESET} ${DIM}${new Date(q.createdAt).toLocaleDateString()}${RESET}`
    )
  }

  console.log()
}

// ─── help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${BOLD}cpp${RESET} — CPP Painting & Building CLI

${BOLD}USAGE${RESET}
  npx tsx scripts/cpp.ts <resource> <command> [args] [--flags]

${BOLD}PROJECTS${RESET}
  projects list                           List all projects
  projects list --status=LEAD             Filter by status
  projects show <id>                      Show project detail (partial ID ok)
  projects create --name="..." --service=INTERIOR|EXTERIOR|EPOXY
  projects set-status <id> <status>       Update project status

  Statuses: LEAD · QUOTED · CONTRACTED · IN_PROGRESS · COMPLETE · LOST

${BOLD}PRICING${RESET}
  pricing list                            Show all pricing baselines
  pricing set <key> <rate>               Update a rate

  Keys: interior_wall_sqft · interior_ceiling_sqft · interior_trim_lf
        exterior_sqft · epoxy_sqft

${BOLD}PEOPLE${RESET}
  people list                             List all contacts
  people list --search="name or company"  Search contacts

${BOLD}QUOTES${RESET}
  quotes list                             List all quotes
  quotes list <project-id>               Quotes for a project

${BOLD}EXAMPLES${RESET}
  npx tsx scripts/cpp.ts projects list --status=LEAD
  npx tsx scripts/cpp.ts projects set-status abc123 CONTRACTED
  npx tsx scripts/cpp.ts pricing set epoxy_sqft 4.00
  npx tsx scripts/cpp.ts people list --search="smith"
`)
}

// ─── error & dispatch ────────────────────────────────────────────────────────

function die(msg: string): never {
  console.error(`${'\x1b[31m'}✗${RESET} ${msg}`)
  process.exit(1)
}

async function main() {
  try {
    if (!resource || resource === 'help') return printHelp()

    if (resource === 'projects') {
      if (command === 'list') return await projectsList()
      if (command === 'show') return await projectsShow()
      if (command === 'set-status') return await projectsSetStatus()
      if (command === 'create') return await projectsCreate()
      return die(`Unknown command: projects ${command ?? ''}. Try: list, show, set-status, create`)
    }

    if (resource === 'pricing') {
      if (command === 'list') return await pricingList()
      if (command === 'set') return await pricingSet()
      return die(`Unknown command: pricing ${command ?? ''}. Try: list, set`)
    }

    if (resource === 'people') {
      if (command === 'list') return await peopleList()
      return die(`Unknown command: people ${command ?? ''}. Try: list`)
    }

    if (resource === 'quotes') {
      if (command === 'list') return await quotesList()
      return die(`Unknown command: quotes ${command ?? ''}. Try: list`)
    }

    die(`Unknown resource: ${resource}. Try: projects, pricing, people, quotes, help`)
  } finally {
    await db.$disconnect()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
