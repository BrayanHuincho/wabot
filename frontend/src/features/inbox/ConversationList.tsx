import { useDeferredValue, useEffect, useState } from 'react'
import { usePanel } from '../../app/store'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { Skeleton } from '../../components/Skeleton'
import { formatListTime } from '../../lib/dates'
import { displayName } from '../../lib/format'
import { useConversations } from '../../lib/queries'
import { subscribeState, type ConnectionState } from '../../lib/realtime'
import type { Conversation } from '../../lib/types'
import { stripWhatsApp } from '../../lib/whatsapp'
import { AiStatus } from './AiStatus'
import styles from './ConversationList.module.css'

function useConnection() {
  const [state, setState] = useState<ConnectionState>('connecting')
  useEffect(() => subscribeState(setState), [])
  return state
}

function Row({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation
  active: boolean
  onSelect: () => void
}) {
  const { contact, unread_count: unread } = conversation
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        data-active={active}
        data-unread={unread > 0}
        aria-current={active || undefined}
        onClick={onSelect}
      >
        <Avatar name={contact.name} phone={contact.phone} size={42} badge />
        <span className={styles.rowMain}>
          <span className={styles.rowLine}>
            <span className={styles.name}>{displayName(contact)}</span>
            <time className={styles.time}>{formatListTime(conversation.last_message_at)}</time>
          </span>
          <span className={styles.rowLine}>
            <span className={styles.preview}>{stripWhatsApp(conversation.preview ?? '') || 'Sin mensajes'}</span>
            {unread > 0 && (
              <span className={styles.unread} aria-label={`${unread} sin leer`}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <ul className={styles.list} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <li key={i} className={styles.skeletonRow}>
          <Skeleton width={42} height={42} round />
          <span className={styles.rowMain}>
            <Skeleton width="55%" height={12} />
            <Skeleton width="80%" height={10} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ConversationList() {
  const { search, setSearch, selectedId, select } = usePanel()
  const term = useDeferredValue(search.trim())
  const source = useConversations('open', term)
  const connection = useConnection()
  const items = source.data ?? []

  useEffect(() => {
    const first = source.data?.[0]
    const wide = window.matchMedia('(min-width: 761px)').matches
    if (first && wide && !source.data?.some((c) => c.id === selectedId)) select(first.id)
  }, [source.data, selectedId, select])

  return (
    <aside className={styles.column} aria-label="Conversaciones">
      <header className={styles.header}>
        <span className={styles.logo}>
          <Icon name="message" size={18} strokeWidth={2.2} />
        </span>
        <AiStatus connection={connection} />
      </header>

      <div className={styles.searchRow}>
        <label className={styles.search}>
          <Icon name="search" size={15} />
          <input
            type="search"
            placeholder="Buscar nombre o número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar conversaciones"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
              <Icon name="x" size={14} />
            </button>
          )}
        </label>
      </div>

      {source.isPending ? (
        <ListSkeleton />
      ) : source.isError ? (
        <div className={styles.empty}>
          <Icon name="wifiOff" size={22} />
          <strong>No se pudo cargar la bandeja</strong>
          <button type="button" onClick={() => void source.refetch()}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="inbox" size={22} />
          <strong>{term ? 'Ningún resultado para tu búsqueda' : 'Todavía no hay conversaciones'}</strong>
          {!term && <p>Escribe desde el simulador para empezar una conversación con el bot.</p>}
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((conversation) => (
            <Row
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === selectedId}
              onSelect={() => select(conversation.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}
