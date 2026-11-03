import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Skeleton } from '../../components/Skeleton'
import { formatDay, minutesBetween, sameDay } from '../../lib/dates'
import { useMessages } from '../../lib/queries'
import type { Message } from '../../lib/types'
import { Bubble, type ReplyChoice } from './bubble/Bubble'
import { ListSheet } from './bubble/ListSheet'
import { doodleBackground } from './doodle'
import { TypingBubble } from './TypingBubble'
import styles from './MessageList.module.css'

interface MessageListProps {
  conversationId: string
  perspective: 'business' | 'customer'
  term?: string
  activeMatchId?: string | null
  typing?: boolean
  onReply?: (choice: ReplyChoice, message: Message) => void
}

function startsGroup(prev: Message | undefined, message: Message) {
  if (!prev) return true
  return (
    prev.direction !== message.direction ||
    prev.author !== message.author ||
    !sameDay(prev.created_at, message.created_at) ||
    minutesBetween(prev.created_at, message.created_at) > 5
  )
}

export function MessageList({
  conversationId,
  perspective,
  term = '',
  activeMatchId,
  typing,
  onReply,
}: MessageListProps) {
  const { messages, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useMessages(conversationId)
  const scroller = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const timeline = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ height: number; firstId?: string } | null>(null)
  const stick = useRef(true)
  const [listMessage, setListMessage] = useState<Message | null>(null)
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const lastId = messages.at(-1)?.id
  const firstId = messages[0]?.id

  useLayoutEffect(() => {
    stick.current = true
  }, [conversationId, lastId])

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (anchor.current && anchor.current.firstId !== firstId) {
      el.scrollTop += el.scrollHeight - anchor.current.height
      anchor.current = null
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [firstId, lastId, typing])

  useEffect(() => {
    const el = scroller.current
    const content = timeline.current
    if (!el || !content) return
    const observer = new ResizeObserver(() => {
      if (stick.current && !anchor.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [isPending])

  useEffect(() => {
    const target = sentinel.current
    const root = scroller.current
    if (!target || !root || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || isFetchingNextPage) return
        anchor.current = { height: root.scrollHeight, firstId }
        void fetchNextPage()
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, firstId])

  useEffect(() => {
    if (activeMatchId)
      document.getElementById(`m-${activeMatchId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeMatchId])

  const mine = (m: Message) => (perspective === 'business' ? m.direction === 'outbound' : m.direction === 'inbound')

  return (
    <div className={styles.wrap}>
      <div
        ref={scroller}
        className={styles.scroller}
        data-perspective={perspective}
        style={{ backgroundImage: doodleBackground }}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        role="log"
        aria-live="polite"
        aria-label="Mensajes"
      >
        <div ref={sentinel} />
        {isFetchingNextPage && <div className={styles.loadingOlder}>Cargando mensajes anteriores…</div>}
        {isPending ? (
          <div className={styles.skeleton} aria-hidden="true">
            {[60, 42, 70, 35, 55].map((w, i) => (
              <div key={i} className={styles.skeletonRow} data-mine={i % 2 === 1}>
                <Skeleton width={`${w}%`} height={34} />
              </div>
            ))}
          </div>
        ) : (
          <div ref={timeline} className={styles.timeline}>
            {messages.map((message, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || !sameDay(prev.created_at, message.created_at)
              const first = startsGroup(prev, message)
              const isMine = mine(message)
              return (
                <Fragment key={message.id}>
                  {newDay && (
                    <div className={styles.day}>
                      <span>{formatDay(message.created_at)}</span>
                    </div>
                  )}
                  <Bubble
                    message={message}
                    mine={isMine}
                    first={first}
                    term={term}
                    quoted={message.reply_to_id ? byId.get(message.reply_to_id) : undefined}
                    showAuthor={perspective === 'business' && first}
                    showStatus={isMine && (perspective === 'business' || message.status !== 'received')}
                    highlighted={message.id === activeMatchId}
                    onReply={onReply && !isMine ? (choice) => onReply(choice, message) : undefined}
                    onOpenList={setListMessage}
                  />
                </Fragment>
              )
            })}
            {typing && <TypingBubble mine={perspective === 'business'} />}
          </div>
        )}
      </div>
      {listMessage && (
        <ListSheet
          message={listMessage}
          onClose={() => setListMessage(null)}
          onSelect={onReply && !mine(listMessage) ? (choice) => onReply(choice, listMessage) : undefined}
        />
      )}
    </div>
  )
}
