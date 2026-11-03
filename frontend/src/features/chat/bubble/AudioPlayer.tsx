import { useMemo, useRef, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { formatDuration } from '../../../lib/dates'
import styles from './Bubble.module.css'

function bars(seed: string, count = 34) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Array.from({ length: count }, (_, i) => {
    hash = (hash * 1103515245 + 12345) | 0
    const wave = Math.sin(i / 3) * 0.25 + 0.55
    return Math.max(0.18, Math.min(1, wave + ((hash >>> 16) % 100) / 220 - 0.2))
  })
}

export function AudioPlayer({ src, seed }: { src: string; seed: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const heights = useMemo(() => bars(seed), [seed])
  const progress = duration ? current / duration : 0

  const toggle = () => {
    const audio = ref.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const seek = (ratio: number) => {
    const audio = ref.current
    if (audio && duration) audio.currentTime = ratio * duration
  }

  return (
    <div className={styles.audio}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setCurrent(0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        className={styles.audioPlay}
        onClick={toggle}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <div className={styles.audioTrack}>
        <div
          className={styles.wave}
          role="slider"
          tabIndex={0}
          aria-label="Posición del audio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.05))
            if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 0.05))
          }}
        >
          {heights.map((h, i) => (
            <span key={i} style={{ height: `${h * 100}%` }} data-played={i / heights.length < progress} />
          ))}
        </div>
        <span className={styles.audioTime}>{formatDuration(playing || current ? current : duration)}</span>
      </div>
    </div>
  )
}
