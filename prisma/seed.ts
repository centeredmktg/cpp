import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Painting baselines (used by Claude for interior/exterior quotes)
  const baselines = [
    { key: 'interior_wall_sqft',    label: 'Interior Wall (per sqft)',    rate: 1.50, unit: 'sqft' },
    { key: 'interior_ceiling_sqft', label: 'Interior Ceiling (per sqft)', rate: 1.75, unit: 'sqft' },
    { key: 'interior_trim_lf',      label: 'Interior Trim (per LF)',      rate: 2.00, unit: 'lf'   },
    { key: 'exterior_sqft',         label: 'Exterior (per sqft)',         rate: 2.25, unit: 'sqft' },
    // Epoxy add-on rates
    { key: 'epoxy_glue_per_level',    label: 'Glue Removal (per level)',      rate: 0.60, unit: 'SF/level' },
    { key: 'epoxy_crack_repair',      label: 'Crack & Joint Repair',          rate: 1.50, unit: 'SF' },
    { key: 'epoxy_moisture',          label: 'Moisture Mitigation',           rate: 2.25, unit: 'SF' },
    { key: 'epoxy_broadcast',         label: 'Broadcast Texture Media',       rate: 0.85, unit: 'SF' },
    { key: 'epoxy_topcoat',           label: 'Premium Topcoat (Polyaspartic)',rate: 0.95, unit: 'SF' },
    { key: 'epoxy_surface_patching',  label: 'Surface Patching Allowance',    rate: 0.35, unit: 'SF' },
  ]

  for (const b of baselines) {
    await prisma.pricingBaseline.upsert({
      where: { key: b.key },
      update: {},
      create: b,
    })
  }

  // Epoxy base rates — 3×3 grid from rates library
  const epoxyRates = [
    { jobType: 'Warehouse',   systemLevel: 'Standard', rate: 7.50 },
    { jobType: 'Warehouse',   systemLevel: 'Premium',  rate: 8.50 },
    { jobType: 'Warehouse',   systemLevel: 'Elite',    rate: 9.50 },
    { jobType: 'Retail',      systemLevel: 'Standard', rate: 8.00 },
    { jobType: 'Retail',      systemLevel: 'Premium',  rate: 9.00 },
    { jobType: 'Retail',      systemLevel: 'Elite',    rate: 10.00 },
    { jobType: 'Residential', systemLevel: 'Standard', rate: 9.00 },
    { jobType: 'Residential', systemLevel: 'Premium',  rate: 10.50 },
    { jobType: 'Residential', systemLevel: 'Elite',    rate: 12.00 },
  ]

  for (const r of epoxyRates) {
    await prisma.epoxyRate.upsert({
      where: { jobType_systemLevel: { jobType: r.jobType, systemLevel: r.systemLevel } },
      update: {},
      create: r,
    })
  }

  console.log('Seeded pricing baselines and epoxy rates.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
