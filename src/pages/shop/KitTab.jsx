import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { Copy, Download, ExternalLink } from 'lucide-react'

const BRAND = [76, 175, 107]
const DARK = [20, 20, 20]
const MED_GREY = [60, 60, 60]
const LIGHT_GREY = [140, 140, 140]
const FOOTER_LINE = 'Powered by Greenlit  •  greenlit-six.vercel.app'
const HEADLINE = 'Skip the line — scan to describe your car’s problem'
const STEPS = [
  '1. Scan the QR code',
  '2. Describe the issue in your own words',
  '3. We text you back a shop-ready brief',
]

// Draws the shared brand content block (wordmark, shop name, headline, QR, steps, footer)
// inside a panel rect. jsPDF's doc.text() rotates around the exact (x, y) you pass, but
// addImage's rotation pivots around a different corner implied by its internal transform
// order — to keep a 180°-rotated image inside the same visual box, the coordinates passed
// to addImage must be offset by (+width, -height) from that box's top-left corner.
function renderPanel(
  doc,
  { x, y, width, height, scale = 1, rotate180 = false, layout = 'stack', shopName, headline, qrDataUrl }
) {
  const angle = rotate180 ? 180 : 0

  const point = (px, py) =>
    rotate180 ? { X: x + width - px, Y: y + height - py } : { X: x + px, Y: y + py }

  // jsPDF's built-in `align: 'center'` doesn't recompose correctly with `angle` rotation
  // (verified against source — the alignment offset gets applied in the wrong direction
  // once a rotation matrix is involved), so center alignment is computed by hand here
  // instead of passed through to doc.text.
  const text = (px, py, str, opts = {}) => {
    const { align, ...rest } = opts
    const localX = align === 'center' ? px - doc.getTextWidth(str) / 2 : px
    const p = point(localX, py)
    doc.text(p.X, p.Y, str, { ...rest, angle })
  }

  const rectAt = (rx, ry, rw, rh, mode) => {
    const p = rotate180
      ? { X: x + width - rx - rw, Y: y + height - ry - rh }
      : { X: x + rx, Y: y + ry }
    doc.rect(p.X, p.Y, rw, rh, mode)
  }

  const image = (qx, qy, qw, qh) => {
    if (!rotate180) {
      doc.addImage(qrDataUrl, 'PNG', x + qx, y + qy, qw, qh)
    } else {
      doc.addImage(
        qrDataUrl,
        'PNG',
        x + width - qx,
        y + height - qy - 2 * qh,
        qw,
        qh,
        undefined,
        'FAST',
        180
      )
    }
  }

  if (layout === 'split') {
    const margin = width * 0.04
    const qrSize = Math.max(40, Math.min(height * 0.5, width * 0.35))
    const qrX = margin
    const qrY = (height - qrSize) / 2

    doc.setDrawColor(...BRAND)
    doc.setLineWidth(0.6)
    rectAt(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6)
    image(qrX, qrY, qrSize, qrSize)

    const textX = qrX + qrSize + margin * 1.5
    const textWidth = width - textX - margin
    let cursorY = height * 0.2

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11 * scale)
    doc.setTextColor(...BRAND)
    text(textX, cursorY, 'GREENLIT')
    cursorY += height * 0.09

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24 * scale)
    doc.setTextColor(...DARK)
    text(textX, cursorY, shopName)
    cursorY += height * 0.13

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5 * scale)
    doc.setTextColor(...MED_GREY)
    const headlineLines = doc.splitTextToSize(headline, textWidth)
    headlineLines.forEach((line, i) => text(textX, cursorY + i * height * 0.075, line))
    cursorY += headlineLines.length * height * 0.075 + height * 0.04

    doc.setFontSize(9 * scale)
    doc.setTextColor(...DARK)
    STEPS.forEach((step, i) => text(textX, cursorY + i * height * 0.095, step))

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...LIGHT_GREY)
    text(width / 2, height - height * 0.05, FOOTER_LINE, { align: 'center' })
    return
  }

  // 'stack' layout: centered vertical flow, used by the letter and both table-tent panels
  const cx = width / 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11 * scale)
  doc.setTextColor(...BRAND)
  text(cx, height * 0.1, 'GREENLIT', { align: 'center' })

  const lineW = 16 * scale
  doc.setFillColor(...BRAND)
  rectAt(cx - lineW / 2, height * 0.12, lineW, 0.8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24 * scale)
  doc.setTextColor(...DARK)
  text(cx, height * 0.22, shopName, { align: 'center' })

  const headlineY = height * 0.3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11 * scale)
  doc.setTextColor(...MED_GREY)
  text(cx, headlineY, headline, { align: 'center' })

  // The QR (plus its 3mm border) is the one non-negotiable block — it must stay >=40mm
  // even on the tent's ~108mm-tall panel. Everything below it uses fixed mm gaps (not
  // fractions of height) so it stays legible on the smallest panel; the footer then
  // snaps to whichever is further down, the tight computed position or a comfortable
  // fixed margin from the bottom, so the letter's much taller panel doesn't look cramped.
  const qrSize = Math.max(40, Math.min(height * 0.34, width * 0.5))
  const qrX = cx - qrSize / 2
  const qrY = headlineY + 8
  const qrBorder = 3

  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.6)
  rectAt(qrX - qrBorder, qrY - qrBorder, qrSize + qrBorder * 2, qrSize + qrBorder * 2)
  image(qrX, qrY, qrSize, qrSize)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5 * scale)
  doc.setTextColor(...DARK)
  const stepGap = 5.5
  const stepsStartY = qrY + qrSize + qrBorder + 5
  STEPS.forEach((step, i) => text(cx, stepsStartY + i * stepGap, step, { align: 'center' }))

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...LIGHT_GREY)
  const lastStepY = stepsStartY + (STEPS.length - 1) * stepGap
  const footerY = Math.max(lastStepY + 5, height - 12)
  text(cx, footerY, FOOTER_LINE, { align: 'center' })
}

export default function KitTab() {
  const { shop, slug } = useOutletContext()
  const qrWrapRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const qrUrl = `${window.location.origin}/i/${slug}`

  const getCanvas = () => qrWrapRef.current?.querySelector('canvas')

  const downloadPng = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `greenlit-qr-${slug}.png`
    link.click()
  }

  const downloadLetterPdf = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const qrDataUrl = canvas.toDataURL('image/png')
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' })
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()

    doc.setFillColor(...BRAND)
    doc.rect(0, 0, width, 3, 'F')
    doc.rect(0, height - 3, width, 3, 'F')

    renderPanel(doc, { x: 0, y: 0, width, height, shopName: shop?.name || slug, headline: HEADLINE, qrDataUrl })

    doc.save(`greenlit-qr-letter-${slug}.pdf`)
  }

  const downloadCounterCardPdf = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const qrDataUrl = canvas.toDataURL('image/png')
    const doc = new jsPDF({ unit: 'mm', format: [215.9, 139.7], orientation: 'landscape' })
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const barWidth = 5

    doc.setFillColor(...BRAND)
    doc.rect(0, 0, barWidth, height, 'F')

    renderPanel(doc, {
      x: barWidth,
      y: 0,
      width: width - barWidth,
      height,
      scale: 0.75,
      layout: 'split',
      shopName: shop?.name || slug,
      headline: HEADLINE,
      qrDataUrl,
    })

    doc.save(`greenlit-qr-counter-${slug}.pdf`)
  }

  const downloadTableTentPdf = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const qrDataUrl = canvas.toDataURL('image/png')
    const doc = new jsPDF({ unit: 'mm', format: [139.7, 215.9], orientation: 'portrait' })
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    const panelHeight = height / 2

    renderPanel(doc, {
      x: 0,
      y: 0,
      width,
      height: panelHeight,
      rotate180: true,
      shopName: shop?.name || slug,
      headline: HEADLINE,
      qrDataUrl,
    })
    renderPanel(doc, {
      x: 0,
      y: panelHeight,
      width,
      height: panelHeight,
      shopName: shop?.name || slug,
      headline: HEADLINE,
      qrDataUrl,
    })

    doc.setFillColor(...BRAND)
    doc.rect(0, panelHeight - 1, width, 1, 'F')
    doc.rect(0, panelHeight, width, 1, 'F')

    doc.save(`greenlit-qr-tent-${slug}.pdf`)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-text">Kit</h2>

      <div className="rounded-2xl border border-line bg-panel p-6">
        <h3 className="font-medium text-text">Print this at your counter.</h3>
        <p className="mt-1 text-sm text-text-dim">
          Customers scan this to start their intake before you touch the car.
        </p>
        <div
          ref={qrWrapRef}
          className="mx-auto mt-5 flex max-w-sm flex-col items-center rounded-2xl border-2 border-brand/40 bg-white p-8"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-brand" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
              Greenlit
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-ink">{shop?.name || slug}</h3>
          <p className="mt-1 text-center text-sm font-medium text-ink">
            Scan to describe your car issue
          </p>
          <p className="text-center text-xs text-ink/60">
            Takes ~2 min. Do it before you're called up.
          </p>
          <div className="my-5">
            <QRCodeCanvas value={qrUrl} size={220} level="M" includeMargin={false} />
          </div>
          <p className="text-center text-[10px] uppercase tracking-widest text-ink/40">
            Powered by Greenlit
          </p>
        </div>
        <p className="mt-3 text-center text-xs text-text-mute">{qrUrl}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={downloadPng}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text hover:border-brand/50"
          >
            <Download size={15} /> Download PNG
          </button>
          <button
            onClick={downloadLetterPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-dim"
          >
            <Download size={15} /> Download PDF
          </button>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text hover:border-brand/50"
          >
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      <a
        href={qrUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
      >
        <ExternalLink size={13} /> Preview the customer intake flow
      </a>
    </div>
  )
}
