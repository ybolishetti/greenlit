import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Upload, Trash2, Play, Pause } from 'lucide-react'

export default function AudioRecorder({ onCapture, onChange }) {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioElRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    onCapture?.(blob)
    onChange?.(!!blob)
  }, [blob, onCapture, onChange])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
        setBlob(b)
        setAudioUrl(URL.createObjectURL(b))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError('Microphone access was blocked. You can upload a clip instead.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    clearInterval(timerRef.current)
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBlob(file)
    setAudioUrl(URL.createObjectURL(file))
  }

  const clear = () => {
    setAudioUrl(null)
    setBlob(null)
    setSeconds(0)
    setPlaying(false)
  }

  const togglePlay = () => {
    if (!audioElRef.current) return
    if (playing) audioElRef.current.pause()
    else audioElRef.current.play()
    setPlaying(!playing)
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      {!audioUrl && !recording && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <button
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-ink hover:bg-brand-dim transition-colors"
          >
            <Mic size={26} />
          </button>
          <div>
            <p className="font-medium text-text">Tap to record the sound</p>
            <p className="mt-1 text-sm text-text-dim">
              Hold your phone near the noise, or upload a clip you already have.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-text"
          >
            <Upload size={14} />
            Upload audio file instead
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.webm"
            className="hidden"
            onChange={handleUpload}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}

      {recording && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <button
            onClick={stopRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white animate-pulse"
          >
            <Square size={22} />
          </button>
          <p className="font-medium text-text">Recording… {fmt(seconds)}</p>
        </div>
      )}

      {audioUrl && !recording && (
        <div className="flex items-center gap-4 py-2">
          <button
            onClick={togglePlay}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <audio ref={audioElRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <div className="flex-1">
            <p className="font-medium text-text">Clip captured</p>
            <p className="text-sm text-text-dim">Ready to attach to your brief</p>
          </div>
          <button
            onClick={clear}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-text-dim hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
