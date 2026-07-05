import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

export default function PhotoUpload({ onChange, onCapture, single = false }) {
  const [previews, setPreviews] = useState([])
  const [files, setFiles] = useState([])
  const inputRef = useRef(null)

  const emit = (nextFiles, nextPreviews) => {
    setFiles(nextFiles)
    setPreviews(nextPreviews)
    onChange?.(nextFiles.length > 0)
    onCapture?.(single ? nextFiles[0] ?? null : nextFiles)
  }

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    const urls = picked.map((f) => URL.createObjectURL(f))
    if (single) {
      emit([picked[0]], [urls[0]])
    } else {
      emit([...files, ...picked], [...previews, ...urls])
    }
  }

  const remove = (idx) => {
    const nextFiles = files.filter((_, i) => i !== idx)
    const nextPreviews = previews.filter((_, i) => i !== idx)
    emit(nextFiles, nextPreviews)
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <div className="flex flex-wrap gap-3">
        {previews.map((src, i) => (
          <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => remove(i)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-text"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {(!single || previews.length === 0) && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-text-mute hover:border-brand/50 hover:text-brand"
          >
            <Camera size={18} />
            <span className="text-[10px]">Add photo</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple={!single}
        className="hidden"
        onChange={handleFiles}
      />
      <p className="mt-3 text-xs text-text-mute">
        Fluid leaks, dashboard lights, tire wear, visible damage — whatever's relevant.
      </p>
    </div>
  )
}
