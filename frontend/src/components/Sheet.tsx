import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Sheet.module.css'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Sheet({ title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.backdrop} aria-label="Cerrar" onClick={onClose} tabIndex={-1} />
      <div ref={ref} className={styles.sheet} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <span className={styles.grip} />
        <header className={styles.header}>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
          <h3>{title}</h3>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
