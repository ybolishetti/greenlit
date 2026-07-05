import { Mic, Video, Camera, MessageSquareText } from 'lucide-react'

const OPTIONS = [
  { id: 'audio', icon: Mic, label: 'Record audio', desc: 'Capture the sound in your browser' },
  { id: 'video', icon: Video, label: 'Record video', desc: 'Show the problem in motion' },
  { id: 'photo', icon: Camera, label: 'Take a photo', desc: 'Dashboard lights, leaks, damage' },
  { id: 'text', icon: MessageSquareText, label: 'Describe it', desc: 'Type what you notice in your own words' },
]

export default function InputPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {OPTIONS.map(({ id, icon: Icon, label, desc }) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              selected
                ? 'border-brand bg-brand-soft text-text'
                : 'border-line bg-panel text-text hover:border-brand/40'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft">
              <Icon size={18} className="text-brand" />
            </div>
            <p className="mt-4 font-medium">{label}</p>
            <p className="mt-1 text-sm text-text-dim">{desc}</p>
          </button>
        )
      })}
    </div>
  )
}
