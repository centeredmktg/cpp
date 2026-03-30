// lib/docs/email.ts
import 'server-only'
import { Resend } from 'resend'
import { readFileSync } from 'fs'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

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

  await getResend().emails.send({
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

  await getResend().emails.send({
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
