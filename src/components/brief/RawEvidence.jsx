import { useState } from 'react'
import { X } from 'lucide-react'
import Section from './Section'

export default function RawEvidence({ media }) {
  const [lightbox, setLightbox] = useState(null)
  const visible = (media ?? []).filter((m) => m.kind !== 'text')
  if (visible.length === 0) return null

  const photos = visible.filter((m) => m.kind === 'photo')
  const audio = visible.filter((m) => m.kind === 'audio')
  const video = visible.filter((m) => m.kind === 'video')

  return (
    <Section title="Raw evidence">
      <div className="space-y-4">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((m, i) =>
              m.signed_url ? (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLightbox(m.signed_url)}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-line"
                >
                  <img src={m.signed_url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-ink/70 px-1.5 py-0.5 text-[10px] text-text/80">
                    Photo {i + 1}
                  </span>
                </button>
              ) : null
            )}
          </div>
        )}

        {audio.map((m) =>
          m.signed_url ? (
            <div key={m.id}>
              <audio controls src={m.signed_url} className="w-full" />
              {m.duration_seconds != null && (
                <p className="mt-1 text-[11px] text-text-mute">{Math.round(m.duration_seconds)}s recording</p>
              )}
            </div>
          ) : null
        )}

        {video.map((m) =>
          m.signed_url ? (
            <video key={m.id} controls playsInline src={m.signed_url} className="w-full rounded-lg" />
          ) : null
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 text-text/80 hover:text-text"
            onClick={() => setLightbox(null)}
          >
            <X size={22} />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </Section>
  )
}
