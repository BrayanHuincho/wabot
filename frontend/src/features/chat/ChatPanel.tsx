import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePanel } from '../../app/store'
import { IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Skeleton } from '../../components/Skeleton'
import { api } from '../../lib/api'
import { upsertConversation } from '../../lib/cache'
import { useConversation, useMessages } from '../../lib/queries'
import type { Message } from '../../lib/types'
import { stripWhatsApp } from '../../lib/whatsapp'
import { Composer } from '../composer/Composer'
import { ChatHeader } from './ChatHeader'
import { ContactDrawer } from './ContactDrawer'
import { MessageList } from './MessageList'
import styles from './ChatPanel.module.css'

function useMarkRead(id: string, unread: number) {
  const client = useQueryClient()
  useEffect(() => {
    if (unread === 0) return
    api
      .markRead(id)
      .then((conversation) => upsertConversation(client, conversation))
      .catch(() => undefined)
  }, [client, id, unread])
}

function useFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [ref])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen?.()
  }
  return [active, toggle] as const
}

function SearchBar({
  messages,
  onChange,
  onClose,
}: {
  messages: Message[]
  onChange: (term: string, matchId: string | null) => void
  onClose: () => void
}) {
  const [term, setTerm] = useState('')
  const [index, setIndex] = useState(0)
  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return []
    return messages
      .filter((m) =>
        stripWhatsApp(m.body ?? '')
          .toLowerCase()
          .includes(needle),
      )
      .map((m) => m.id)
      .reverse()
  }, [messages, term])
  const current = matches.length ? Math.min(index, matches.length - 1) : -1

  useEffect(() => {
    onChange(term.trim(), current >= 0 ? (matches[current] ?? null) : null)
  }, [term, current, matches, onChange])

  const step = (delta: number) => matches.length && setIndex((current + delta + matches.length) % matches.length)

  return (
    <div className={styles.searchBar} role="search">
      <Icon name="search" size={16} />
      <input
        autoFocus
        value={term}
        placeholder="Buscar en esta conversación"
        aria-label="Buscar en esta conversación"
        onChange={(e) => {
          setTerm(e.target.value)
          setIndex(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') onClose()
        }}
      />
      {term.trim() && (
        <span className={styles.searchCount} aria-live="polite">
          {matches.length ? `${current + 1} de ${matches.length}` : 'Sin resultados'}
        </span>
      )}
      <IconButton icon="chevronUp" label="Anterior" size={18} onClick={() => step(1)} disabled={!matches.length} />
      <IconButton icon="chevronDown" label="Siguiente" size={18} onClick={() => step(-1)} disabled={!matches.length} />
      <IconButton icon="x" label="Cerrar búsqueda (Esc)" size={18} onClick={onClose} />
    </div>
  )
}

function EmptyChat() {
  return (
    <section className={styles.empty}>
      <div className={styles.emptyArt}>
        <Icon name="message" size={30} />
      </div>
      <h2>Selecciona una conversación</h2>
      <p>
        Los mensajes de tus clientes llegan aquí en tiempo real. Usa el simulador para probar el bot sin un teléfono.
      </p>
    </section>
  )
}

export function ChatPanel() {
  const selectedId = usePanel((s) => s.selectedId)
  if (!selectedId) return <EmptyChat />
  return <ChatView key={selectedId} conversationId={selectedId} />
}

function ChatView({ conversationId }: { conversationId: string }) {
  const { data: conversation, isError } = useConversation(conversationId)
  const { messages, hasNextPage } = useMessages(conversationId)
  const typing = usePanel((s) => Boolean(s.typing[conversationId]))
  const select = usePanel((s) => s.select)
  const [searching, setSearching] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [search, setSearch] = useState<{ term: string; matchId: string | null }>({ term: '', matchId: null })
  const ref = useRef<HTMLElement>(null)
  const [expanded, toggleExpand] = useFullscreen(ref)
  const onSearch = useCallback((term: string, matchId: string | null) => setSearch({ term, matchId }), [])
  const closeSearch = useCallback(() => {
    setSearching(false)
    setSearch({ term: '', matchId: null })
  }, [])
  const closeDrawer = useCallback(() => setDrawer(false), [])

  useMarkRead(conversationId, conversation?.unread_count ?? 0)

  if (isError) {
    return (
      <section className={styles.empty}>
        <h2>No se encontró la conversación</h2>
        <button type="button" className={styles.link} onClick={() => select(null)}>
          Volver a la bandeja
        </button>
      </section>
    )
  }


  return (
    <section ref={ref} className={styles.panel} aria-label="Chat">
      {conversation ? (
        <ChatHeader
          conversation={conversation}
          typing={typing}
          searching={searching}
          expanded={expanded}
          onToggleSearch={() => (searching ? closeSearch() : setSearching(true))}
          onToggleExpand={toggleExpand}
          onShowInfo={() => setDrawer(true)}
        />
      ) : (
        <header className={styles.header}>
          <Skeleton width={40} height={40} round />
          <div className={styles.identity}>
            <Skeleton width={140} height={13} />
            <Skeleton width={100} height={11} />
          </div>
        </header>
      )}
      {searching && <SearchBar messages={messages} onChange={onSearch} onClose={closeSearch} />}
      <MessageList
        conversationId={conversationId}
        perspective="business"
        term={search.term}
        activeMatchId={search.matchId}
        typing={typing}
      />
      {conversation && <Composer conversation={conversation} />}
      {drawer && conversation && (
        <ContactDrawer
          conversation={conversation}
          messages={messages}
          hasMore={Boolean(hasNextPage)}
          onClose={closeDrawer}
        />
      )}
    </section>
  )
}
