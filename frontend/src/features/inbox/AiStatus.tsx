import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useInfo } from '../../lib/queries'
import type { ConnectionState } from '../../lib/realtime'
import type { AiStatus as Status, Info } from '../../lib/types'
import styles from './ConversationList.module.css'

function statusOf(info: Info): Status {
  return info.ai_status ?? (info.ai_enabled ? 'ok' : 'disabled')
}

const connectionCopy: Record<Exclude<ConnectionState, 'online'>, string> = {
  connecting: 'Conectando…',
  offline: 'Sin conexión con el servidor',
}

export function AiStatus({ connection }: { connection: ConnectionState }) {
  const { data: info } = useInfo()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const status = info ? statusOf(info) : null
  const label =
    connection !== 'online'
      ? connectionCopy[connection]
      : status === 'ok'
        ? `IA activa${info?.ai_model ? ` · ${info.ai_model}` : ''}`
        : status === 'error'
          ? 'IA con errores · responde el flujo'
          : status === 'disabled'
            ? 'IA sin configurar · responde el flujo'
            : 'Cargando…'
  const tone = connection !== 'online' ? connection : (status ?? 'connecting')

  return (
    <div className={styles.identity} ref={ref}>
      <strong>{info?.business_name ?? 'Wabot'}</strong>
      <button
        type="button"
        className={styles.aiStatus}
        data-tone={tone}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.dot} />
        <span className={styles.aiLabel}>{label}</span>
        <Icon name="info" size={12} />
      </button>
      {open && info && (
        <div className={styles.aiPopover} role="dialog" aria-label="Estado de la IA">
          {status === 'ok' ? (
            <>
              <strong>La IA responde lo que el flujo no cubre</strong>
              <dl>
                {info.ai_provider && (
                  <>
                    <dt>Proveedor</dt>
                    <dd>{info.ai_provider}</dd>
                  </>
                )}
                <dt>Modelo</dt>
                <dd>{info.ai_model ?? '—'}</dd>
              </dl>
            </>
          ) : (
            <>
              <strong>{status === 'error' ? 'La IA no responde' : 'La IA está desactivada'}</strong>
              <p>
                El bot sigue atendiendo con el flujo de botones y listas. Para activarla, define{' '}
                <code>AI_PROVIDER</code> y <code>AI_API_KEY</code> en <code>backend/.env</code> y reinicia el backend.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
