// lib/docs/change-order-template.ts
import 'server-only'

interface LineItem {
  label: string
  qty: number
  unit: string
  rate: number
  total: number
}

export interface ChangeOrderData {
  changeOrderId: string
  createdAt: Date
  description: string
  lineItems: LineItem[]
  delta: number
  newTotal: number
  notes: string | null
  quoteId: string
  quoteDate: Date
  quoteTotal: number
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
