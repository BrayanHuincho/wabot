import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { extension, formatBytes, mediaType } from '../../lib/format'
import { limits } from '../../lib/limits'
import styles from './Composer.module.css'

interface UploadPreviewProps {
  file: File
  busy: boolean
  onCancel: () => void
  onSend: (caption: string) => void
}

export function UploadPreview({ file, busy, onCancel, onSend }: UploadPreviewProps) {
  const [caption, setCaption] = useState('')
  const url = useMemo(() => URL.createObjectURL(file), [file])
  const type = mediaType(file.type)
  const canCaption = type !== 'audio' && type !== 'sticker'

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <Modal
      title="Enviar archivo"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="send"
            disabled={busy || caption.length > limits.caption}
            onClick={() => onSend(caption.trim())}
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </Button>
        </>
      }
    >
      <div className={styles.uploadStage}>
        {type === 'image' || type === 'sticker' ? (
          <img src={url} alt={file.name} />
        ) : type === 'video' ? (
          <video src={url} controls />
        ) : type === 'audio' ? (
          <audio src={url} controls />
        ) : (
          <div className={styles.uploadDoc}>
            <strong>{extension(file.name).toUpperCase() || 'ARCHIVO'}</strong>
            <span>{file.name}</span>
          </div>
        )}
      </div>
      <p className={styles.uploadMeta}>
        {file.name} · {formatBytes(file.size)}
      </p>
      {canCaption && (
        <label className={styles.field}>
          <span>Pie de foto (opcional)</span>
          <input
            autoFocus
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && onSend(caption.trim())}
            placeholder="Añade un comentario"
            aria-invalid={caption.length > limits.caption}
          />
          <small data-error={caption.length > limits.caption}>
            {caption.length}/{limits.caption}
          </small>
        </label>
      )}
    </Modal>
  )
}
