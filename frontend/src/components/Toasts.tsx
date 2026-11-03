import { useEffect } from 'react'
import { usePanel, type Toast } from '../app/store'
import { Icon } from './Icon'
import styles from './Toasts.module.css'

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = usePanel((s) => s.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 5000)
    return () => clearTimeout(timer)
  }, [dismiss, toast.id])

  return (
    <div className={styles.toast} data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon name={toast.tone === 'error' ? 'alert' : 'checkCircle'} size={18} />
      <p>{toast.message}</p>
      <button type="button" onClick={() => dismiss(toast.id)} aria-label="Descartar">
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = usePanel((s) => s.toasts)
  return (
    <div className={styles.viewport}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
