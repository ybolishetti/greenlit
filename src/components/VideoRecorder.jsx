import { useEffect, useRef, useState } from 'react'
import { Video, Square, Trash2, Upload } from 'lucide-react'

const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export default function VideoRecorder({ onCapture }) {
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const videoRef = useRef(null)
  const uploadInputRef = useRef(null)

  useEffect(() => {
    onCapture?.(blob)
  }, [blob, onCapture])

  useEffect(() => () => {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      const mime = MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime || 'video/webm' })
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
        stream.getTracks().forEach((t) => t.stop())
        if (videoRef.current) videoRef.current.srcObject = null
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError('Camera access was blocked. Try describing the problem in text instead.')
    }
  }

  const stop = () => {
    recorderRef.current?.stop()
    setRecording(false)
    clearInterval(timerRef.current)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const clear = () => {
    setBlob(null)
    setPreviewUrl(null)
    setSeconds(0)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (file.size > MAX_VIDEO_BYTES) {
      setError('Video is over 50 MB. Try recording a shorter clip or trim it in your phone first.')
      e.target.value = ''
      return
    }
    setBlob(file)
    setPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      {!previewUrl && !recording && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={start}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel px-6 py-5 text-sm hover:border-brand/50"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-ink">
                <Video size={22} />
              </div>
              <span className="font-medium">Record video</span>
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel px-6 py-5 text-sm hover:border-brand/50"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line text-text-mute">
                <Upload size={22} />
              </div>
              <span className="font-medium">Upload video</span>
            </button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleUpload}
          />
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
      {recording && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="w-full rounded-lg border border-line"
          />
          <button
            onClick={stop}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white animate-pulse"
          >
            <Square size={22} />
          </button>
          <p className="font-medium">Recording… {fmt(seconds)}</p>
        </div>
      )}
      {previewUrl && !recording && (
        <div className="space-y-3">
          <video src={previewUrl} controls className="w-full rounded-lg border border-line" />
          <div className="flex justify-end">
            <button onClick={clear} className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-danger">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
