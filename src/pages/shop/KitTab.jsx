import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { Copy, Download, ExternalLink } from 'lucide-react'

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

  const downloadPdf = () => {
    const canvas = getCanvas()
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setFillColor(76, 175, 107)
    doc.rect(0, 0, pageWidth, 8, 'F')

    doc.setFontSize(22)
    doc.setTextColor(76, 175, 107)
    doc.text('GREENLIT', pageWidth / 2, 32, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(20, 20, 20)
    doc.text(shop?.name || slug, pageWidth / 2, 44, { align: 'center' })

    doc.setFontSize(12)
    doc.setTextColor(60, 60, 60)
    doc.text('Skip the line — scan to describe your car’s problem', pageWidth / 2, 54, {
      align: 'center',
    })

    const qrSize = 90
    const qrY = 68
    doc.setDrawColor(76, 175, 107)
    doc.setLineWidth(1)
    doc.rect((pageWidth - qrSize) / 2 - 4, qrY - 4, qrSize + 8, qrSize + 8)
    doc.addImage(dataUrl, 'PNG', (pageWidth - qrSize) / 2, qrY, qrSize, qrSize)

    doc.setFontSize(11)
    doc.setTextColor(20, 20, 20)
    const steps = [
      '1. Scan the QR code',
      '2. Describe the issue in your own words',
      '3. We text you back a shop-ready brief',
    ]
    steps.forEach((step, i) => {
      doc.text(step, pageWidth / 2, qrY + qrSize + 16 + i * 7, { align: 'center' })
    })

    doc.setFontSize(9)
    doc.setTextColor(140, 140, 140)
    doc.text(qrUrl, pageWidth / 2, pageHeight - 15, { align: 'center' })

    doc.setFillColor(76, 175, 107)
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F')

    doc.save(`greenlit-qr-kit-${slug}.pdf`)
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
            onClick={downloadPdf}
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
