import { jsPDF } from 'jspdf'

const MAX_PDF_PHOTOS = 4
const MAX_PHOTO_WIDTH_PX = 800

async function loadDownscaledJpeg(url, maxWidth = MAX_PHOTO_WIDTH_PX) {
  const res = await fetch(url)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    width: canvas.width,
    height: canvas.height,
  }
}

/**
 * Builds and saves the mechanic-brief PDF. Section order mirrors the
 * on-screen brief: urgency -> vehicle -> customer verbatim -> probable
 * causes -> components to inspect -> raw evidence (photos embedded,
 * audio/video linked) -> disclaimer.
 */
export async function buildBriefPdf({ brief, intake, media = [], filename }) {
  const doc = new jsPDF()
  let y = 20
  const line = (text, size = 11, gap = 7, color = [20, 20, 20]) => {
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const wrapped = doc.splitTextToSize(text, 170)
    doc.text(wrapped, 20, y)
    y += gap * wrapped.length
  }
  const ensureSpace = (needed) => {
    if (y + needed > 280) {
      doc.addPage()
      y = 20
    }
  }

  line('GREENLIT — Mechanic Brief', 18, 10, [76, 175, 107])
  if (intake?.created_at) line(new Date(intake.created_at).toLocaleString(), 9, 8, [120, 120, 120])
  y += 2

  if (brief.urgencyLabel) line(`Urgency: ${brief.urgencyLabel}`, 12, 8, [76, 175, 107])
  if (brief.estimateRange) line(`Estimated repair range: $${brief.estimateRange[0]} - $${brief.estimateRange[1]}`, 10, 6)
  if (intake?.vehicle) {
    const v = intake.vehicle
    line(`${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}${v.mileage != null ? ` · ${v.mileage} mi` : ''}`.trim(), 10, 7)
  }
  y += 2

  if (brief.symptomLanguage?.length) {
    line("Customer's words", 13, 8, [76, 175, 107])
    brief.symptomLanguage.forEach((s) => line(`"${s}"`, 10, 7, [90, 90, 90]))
    y += 2
  }

  if (brief.category) line(`Category: ${brief.category}`, 12, 8)
  y += 2

  if (brief.probableCauses?.length) {
    line('Ranked probable causes — AI triage suggestions, verify before repair', 12, 8, [76, 175, 107])
    brief.probableCauses.forEach((c) => line(`- ${c.cause}  (${c.confidence}% confidence)`, 11, 7))
    y += 2
  }

  if (brief.componentsToInspect?.length) {
    line('Components to inspect first', 13, 8, [76, 175, 107])
    brief.componentsToInspect.forEach((c) => line(`- ${c}`, 11, 7))
    y += 2
  }

  const photos = media.filter((m) => m.kind === 'photo' && m.signed_url)
  const audioVideo = media.filter((m) => (m.kind === 'audio' || m.kind === 'video') && m.signed_url)

  if (photos.length > 0 || audioVideo.length > 0) {
    ensureSpace(20)
    line('Raw evidence', 13, 8, [76, 175, 107])

    const embed = photos.slice(0, MAX_PDF_PHOTOS)
    for (const photo of embed) {
      try {
        const { dataUrl, width, height } = await loadDownscaledJpeg(photo.signed_url)
        const pdfWidth = 80
        const pdfHeight = (height / width) * pdfWidth
        ensureSpace(pdfHeight + 5)
        doc.addImage(dataUrl, 'JPEG', 20, y, pdfWidth, pdfHeight)
        y += pdfHeight + 5
      } catch {
        // signed URL may have expired or fetch failed cross-origin — skip silently, web brief still has it
      }
    }
    if (photos.length > MAX_PDF_PHOTOS) {
      line(`+ ${photos.length - MAX_PDF_PHOTOS} more photos available in the web brief.`, 9, 6, [120, 120, 120])
    }

    audioVideo.forEach((m) => {
      const label = m.kind === 'audio' ? 'Audio recording' : 'Video'
      line(`${label}: ${m.signed_url.slice(0, 60)}… (open web brief for playback)`, 9, 6, [120, 120, 120])
    })
    y += 2
  }

  if (intake?.customer_name) {
    y += 2
    line(`Submitted by: ${intake.customer_name}`, 10, 7, [120, 120, 120])
  }

  if (brief.disclaimer) {
    y += 4
    line(brief.disclaimer, 9, 6, [120, 120, 120])
  }

  doc.save(filename)
}
