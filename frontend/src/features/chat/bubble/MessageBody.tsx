import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { extension, formatBytes } from '../../../lib/format'
import type { Location, Media, Message } from '../../../lib/types'
import { formatWhatsApp } from '../../../lib/whatsapp'
import { AudioPlayer } from './AudioPlayer'
import { Lightbox } from './Lightbox'
import styles from './Bubble.module.css'

const docTones: Record<string, string> = {
  pdf: '#e5484d',
  doc: '#2b6cdf',
  docx: '#2b6cdf',
  xls: '#1d9a5b',
  xlsx: '#1d9a5b',
  csv: '#1d9a5b',
  ppt: '#e2711d',
  pptx: '#e2711d',
  zip: '#7c5cd6',
}

export function Text({ text, term }: { text: string | null | undefined; term: string }) {
  if (!text) return null
  return <div className={styles.text}>{formatWhatsApp(text, term)}</div>
}

function ImageMedia({ media, caption }: { media: Media; caption: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={styles.mediaFrame} onClick={() => setOpen(true)} aria-label="Ver imagen">
        <img src={media.url} alt={caption || media.filename} loading="lazy" />
      </button>
      {open && <Lightbox src={media.url} alt={caption || media.filename} onClose={() => setOpen(false)} />}
    </>
  )
}

export function DocumentCard({ media }: { media: Media }) {
  const ext = extension(media.filename)
  return (
    <a className={styles.document} href={media.url} download={media.filename} target="_blank" rel="noreferrer">
      <span className={styles.docIcon} style={{ background: docTones[ext] ?? '#8696a0' }}>
        {ext ? ext.slice(0, 4).toUpperCase() : <Icon name="file" size={16} />}
      </span>
      <span className={styles.docInfo}>
        <span className={styles.docName}>{media.filename}</span>
        <span className={styles.docMeta}>
          {ext.toUpperCase() || 'Archivo'} · {formatBytes(media.size_bytes)}
        </span>
      </span>
      <span className={styles.docDownload}>
        <Icon name="download" size={18} />
      </span>
    </a>
  )
}

export function LocationCard({ location }: { location: Location }) {
  const href = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
  return (
    <a
      className={styles.location}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir ${location.name || 'ubicación'} en Google Maps`}
    >
      <span className={styles.map}>
        <span className={styles.mapPin}>
          <Icon name="pin" size={26} strokeWidth={2} />
        </span>
      </span>
      <span className={styles.locationText}>
        <strong>{location.name || 'Ubicación'}</strong>
        <span>{location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}</span>
      </span>
    </a>
  )
}

export function MessageMedia({ message, term }: { message: Message; term: string }) {
  const { media, type, body } = message
  if (!media) return <Text text={body || 'Archivo no disponible'} term={term} />
  switch (type) {
    case 'image':
      return (
        <>
          <ImageMedia media={media} caption={body ?? ''} />
          <Text text={body} term={term} />
        </>
      )
    case 'sticker':
      return <img className={styles.sticker} src={media.url} alt="Sticker" loading="lazy" />
    case 'video':
      return (
        <>
          <div className={styles.mediaFrame}>
            <video src={media.url} controls preload="metadata" />
          </div>
          <Text text={body} term={term} />
        </>
      )
    case 'audio':
      return <AudioPlayer src={media.url} seed={media.id} />
    default:
      return (
        <>
          <DocumentCard media={media} />
          <Text text={body} term={term} />
        </>
      )
  }
}
