import { useEffect, useRef, type ReactNode } from 'react'
import { usePanel } from '../../app/store'
import { Avatar } from '../../components/Avatar'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { hoursLeft } from '../../lib/dates'
import { displayName, formatPhone } from '../../lib/format'
import type { Conversation, Message } from '../../lib/types'
import styles from './ChatPanel.module.css'

const longDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function ContactDrawer({
  conversation,
  messages,
  hasMore,
  onClose,
}: {
  conversation: Conversation
  messages: Message[]
  hasMore: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const toast = usePanel((s) => s.toast)
  const { contact } = conversation
  const first = messages[0]
  const inbound = messages.filter((m) => m.direction === 'inbound').length

  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyPhone = () =>
    void navigator.clipboard?.writeText(contact.phone).then(() => toast('Número copiado.', 'info'))

  return (
    <>
      <button type="button" className={styles.scrim} aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <aside ref={ref} className={styles.drawer} aria-label="Información del contacto" tabIndex={-1}>
        <header className={styles.drawerHeader}>
          <IconButton icon="x" label="Cerrar" onClick={onClose} />
          <h3>Información del contacto</h3>
        </header>
        <div className={styles.drawerBody}>
          <section className={styles.profile}>
            <Avatar name={contact.name} phone={contact.phone} size={88} />
            <strong>{displayName(contact)}</strong>
            <button type="button" onClick={copyPhone} title="Copiar número">
              {formatPhone(contact.phone)} <Icon name="copy" size={13} />
            </button>
          </section>

          <dl className={styles.fields}>
            <Field label="Atención">
              <span className={styles.badge} data-tone={conversation.mode}>
                <Icon name={conversation.mode === 'manual' ? 'user' : 'bot'} size={12} strokeWidth={2.2} />
                {conversation.mode === 'manual' ? 'Manual · asesor' : 'Automática · bot'}
              </span>
            </Field>
            <Field label="Estado">{conversation.status === 'open' ? 'Abierta' : 'Cerrada'}</Field>
            <Field label="Ventana de 24 h">
              {conversation.window_open && conversation.window_expires_at
                ? `Abierta · cierra ${longDate.format(new Date(conversation.window_expires_at))} (${hoursLeft(conversation.window_expires_at)} h)`
                : 'Cerrada · solo plantillas'}
            </Field>
            <Field label="Primer mensaje">
              {first ? `${longDate.format(new Date(first.created_at))}${hasMore ? ' o antes' : ''}` : '—'}
            </Field>
            <Field label="Mensajes">
              {messages.length}
              {hasMore ? '+' : ''} en total · {inbound} del cliente
            </Field>
          </dl>
        </div>
      </aside>
    </>
  )
}
