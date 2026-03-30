import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, company, email, phone, serviceType, description } = body

    if (!name || !email || !serviceType || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validServiceTypes = ['INTERIOR', 'EXTERIOR', 'EPOXY']
    if (!validServiceTypes.includes(serviceType)) {
      return NextResponse.json({ error: 'Invalid service type' }, { status: 400 })
    }

    // Create Person and Project in a transaction
    const [person, project] = await db.$transaction(async (tx) => {
      const p = await tx.person.create({
        data: {
          name,
          email: email || null,
          phone: phone || null,
          company: company || null,
        },
      })

      const proj = await tx.project.create({
        data: {
          name: `${name}${company ? ` — ${company}` : ''} · ${serviceType}`,
          serviceType: serviceType as 'INTERIOR' | 'EXTERIOR' | 'EPOXY',
          description,
          status: 'LEAD',
          people: {
            create: {
              personId: p.id,
              role: 'OTHER',
            },
          },
        },
      })

      return [p, proj]
    })

    // Send email notification
    const serviceLabel: Record<string, string> = {
      INTERIOR: 'Interior Painting',
      EXTERIOR: 'Exterior Painting',
      EPOXY: 'Epoxy Floors',
    }

    const to = process.env.RESEND_TO
    const from = process.env.RESEND_FROM

    if (to && from && process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_...')) {
      await getResend().emails.send({
        from,
        to,
        subject: `New Lead: ${name} — ${serviceLabel[serviceType]}`,
        html: `
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Company:</strong> ${company || '—'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || '—'}</p>
          <p><strong>Service:</strong> ${serviceLabel[serviceType]}</p>
          <p><strong>Description:</strong></p>
          <p>${description}</p>
          <hr />
          <p><small>Project ID: ${project.id} · Person ID: ${person.id}</small></p>
        `,
      })
    }

    return NextResponse.json({ success: true, projectId: project.id })
  } catch (err) {
    console.error('[contact] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
