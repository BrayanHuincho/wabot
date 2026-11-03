import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../components/Icon'
import styles from './Bubble.module.css'

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={alt}>
      <button type="button" className={styles.lightboxBackdrop} onClick={onClose} aria-label="Cerrar" tabIndex={-1} />
      <div className={styles.lightboxBar}>
        <a href={src} download aria-label="Descargar">
          <Icon name="download" />
        </a>
        <button type="button" onClick={onClose} aria-label="Cerrar" autoFocus>
          <Icon name="x" />
        </button>
      </div>
      <img src={src} alt={alt} />
    </div>,
    document.body,
  )
}
