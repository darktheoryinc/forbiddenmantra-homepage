import { useCallback, useEffect, useRef, useState } from 'react'

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export interface RecordingResult { blob: Blob; durationSec: number; mimeType: string }

export function micErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (!window.isSecureContext) return 'Recording needs a secure (https or localhost) connection.'
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission was denied. Allow it in your browser settings and try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found on this device.'
  if (name === 'NotReadableError') return 'The microphone is busy in another app.'
  return 'Could not start recording.'
}

export function useRecorder(onDone: (r: RecordingResult) => void | Promise<void>) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<number>(0)
  const stream = useRef<MediaStream | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  const cleanup = useCallback(() => {
    window.clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext ? 'This browser does not support audio recording.' : micErrorMessage(null))
      return
    }
    setState('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      rec.onstop = async () => {
        const type = rec.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks.current, { type })
        const durationSec = Math.round((Date.now() - startedAt.current) / 1000)
        cleanup()
        setState('idle')
        setElapsed(0)
        if (blob.size) await done.current({ blob, durationSec, mimeType: type })
      }
      rec.onerror = () => { setError('Recording failed.'); cleanup(); setState('idle') }
      mr.current = rec
      startedAt.current = Date.now()
      rec.start(1000) // timeslice: data is flushed every second, so a crash loses at most 1s
      timer.current = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 250)
      setState('recording')
    } catch (e) {
      cleanup()
      setState('idle')
      setError(micErrorMessage(e))
    }
  }, [cleanup])

  const stop = useCallback(() => { if (mr.current && mr.current.state !== 'inactive') mr.current.stop() }, [])

  return { state, elapsed, error, start, stop }
}
