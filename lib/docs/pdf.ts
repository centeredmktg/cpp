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
