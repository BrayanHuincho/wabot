import { useEffect, useRef, useState } from 'react'

const preferredTypes = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

export function useRecorder(onDone: (file: File) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(timer)
  }, [recording])

  useEffect(() => () => recorder.current?.stop(), [])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Tu navegador no permite grabar audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      cancelled.current = false
      media.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        setSeconds(0)
        if (cancelled.current || !chunks.length) return
        const type = media.mimeType.split(';')[0] || 'audio/webm'
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
        done.current(new File(chunks, `nota-de-voz-${Date.now()}.${ext}`, { type }))
      }
      media.start()
      recorder.current = media
      setRecording(true)
    } catch {
      onError('No se pudo acceder al micrófono.')
    }
  }

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop()

  const cancel = () => {
    cancelled.current = true
    stop()
  }

  return { recording, seconds, start, stop, cancel }
}
