import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-wide={wide}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  )
}
