import { useState } from 'react'
import { Smartphone, Lock } from 'lucide-react'

// Placeholder for the native iOS app download. This button intentionally
// does nothing yet — the lock screen shortcut / background recording
// feature requires a native app (WidgetKit + App Intents), which is out of
// scope for the web build. Wire this up to the real App Store link later.
export default function DownloadAppButton({ variant = 'default' }) {
  const [clicked, setClicked] = useState(false)

  const handleClick = () => {
    setClicked(true)
    setTimeout(() => setClicked(false), 2200)
  }

  if (variant === 'inline') {
    return (
      <div className="relative inline-block">
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-text/90 hover:border-brand/50 transition-colors"
        >
          <Lock size={14} className="text-brand" />
          Get the lock screen shortcut
        </button>
        {clicked && <ComingSoonBubble />}
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
      >
        <Smartphone size={16} />
        Download the app for one-tap recording
      </button>
      {clicked && <ComingSoonBubble />}
    </div>
  )
}

function ComingSoonBubble() {
  return (
    <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-panel p-3 text-xs text-text-dim shadow-xl">
      <p className="font-medium text-text">Coming soon</p>
      <p className="mt-1">
        The lock screen shortcut needs the native iOS app. Everything else on
        this page already works in the browser.
      </p>
    </div>
  )
}
