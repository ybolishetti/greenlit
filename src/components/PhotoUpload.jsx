import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

export default function PhotoUpload({ onChange }) {
  const [previews, setPreviews] = useState([])
  const inputRef = useRef(null)

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map((f) => URL.createObjectURL(f))
    const next = [...previews, ...urls]
    setPreviews(next)
    onChange?.(next.length > 0)
  }

  const remove = (idx) => {
    const next = previews.filter((_, i) => i !== idx)
    setPreviews(next)
    onChange?.(next.length > 0)
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <div className="flex flex-wrap gap-3">
        {previews.map((src, i) => (
          <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => remove(i)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-white"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-white/40 hover:border-lime/50 hover:text-lime"
        >
          <Camera size={18} />
          <span className="text-[10px]">Add photo</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <p className="mt-3 text-xs text-white/40">
        Fluid leaks, dashboard lights, tire wear, visible damage — whatever's relevant.
      </p>
    </div>
  )
}
