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

    doc.setFontSize(20)
    doc.setTextColor(76, 175, 107)
    doc.text('GREENLIT', pageWidth / 2, 30, { align: 'center' })

    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text(shop?.name || slug, pageWidth / 2, 42, { align: 'center' })
    doc.text('Skip the line — scan to describe your car’s problem', pageWidth / 2, 50, {
      align: 'center',
    })

    const qrSize = 90
    doc.addImage(dataUrl, 'PNG', (pageWidth - qrSize) / 2, 65, qrSize, qrSize)

    doc.setFontSize(10)
    doc.setTextColor(120, 120, 120)
    doc.text(qrUrl, pageWidth / 2, 170, { align: 'center' })

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
        <div ref={qrWrapRef} className="mt-5 flex justify-center rounded-xl bg-white p-6">
          <QRCodeCanvas value={qrUrl} size={512} className="h-64 w-64" />
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

      <div className="rounded-2xl border border-dashed border-line p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-mute">Coming soon</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <StubButton label="Table tent" />
          <StubButton label="Tri-fold brochure" />
          <StubButton label="Window sticker" />
        </div>
      </div>
    </div>
  )
}

function StubButton({ label }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text-mute opacity-60"
    >
      {label}
    </button>
  )
}
