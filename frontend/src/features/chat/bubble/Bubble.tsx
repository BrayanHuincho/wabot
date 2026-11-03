import { Icon, type IconName } from '../../../components/Icon'
import { formatTime } from '../../../lib/dates'
import type { Author, Message, MessageStatus } from '../../../lib/types'
import { stripWhatsApp } from '../../../lib/whatsapp'
import { LocationCard, MessageMedia, Text } from './MessageBody'
import styles from './Bubble.module.css'

export interface ReplyChoice {
  id: string
  title: string
}

interface BubbleProps {
  message: Message
  mine: boolean
  first: boolean
  term?: string
  quoted?: Message
  showAuthor?: boolean
  showStatus?: boolean
  highlighted?: boolean
  onReply?: (choice: ReplyChoice) => void
  onOpenList?: (message: Message) => void
}

const authors: Partial<Record<Author, { label: string; icon: IconName }>> = {
  bot: { label: 'Bot', icon: 'bot' },
  agent: { label: 'Asesor', icon: 'user' },
  api: { label: 'API', icon: 'plug' },
}

const statusLabel: Record<MessageStatus, string> = {
  received: 'Recibido',
  pending: 'Enviando',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'No se pudo enviar',
}

export function StatusTick({ status }: { status: MessageStatus }) {
  const icon: IconName =
    status === 'pending' ? 'clock' : status === 'failed' ? 'alert' : status === 'sent' ? 'check' : 'checks'
  return (
    <span className={styles.tick} data-status={status} title={statusLabel[status]} aria-label={statusLabel[status]}>
      <Icon name={icon} size={status === 'pending' || status === 'failed' ? 13 : 16} strokeWidth={2} />
    </span>
  )
}

function quoteText(message: Message) {
  return stripWhatsApp(message.body || message.media?.filename || 'Mensaje')
}

function Quote({ quoted, message, mine }: { quoted: Message; message: Message; mine: boolean }) {
  const own = (quoted.direction === message.direction) === mine
  const other = quoted.direction === 'inbound' ? 'Cliente' : 'Empresa'
  return (
    <div className={styles.quote} data-own={own}>
      <strong>{own ? 'Tú' : other}</strong>
      <span>{quoteText(quoted)}</span>
    </div>
  )
}

function Content({ message, term }: { message: Message; term: string }) {
  const content = message.content ?? {}
  switch (message.type) {
    case 'text':
      return <Text text={message.body} term={term} />
    case 'location':
      return content.location ? <LocationCard location={content.location} /> : <Text text={message.body} term={term} />
    case 'reply':
      if (message.reply_to_id) return <Text text={content.reply_title || message.body} term={term} />
      return (
        <div className={styles.choice}>
          <span className={styles.choiceIcon}>
            <Icon name="reply" size={14} />
          </span>
          <span>{content.reply_title || message.body}</span>
        </div>
      )
    case 'buttons':
    case 'list':
    case 'cta_url':
    case 'template':
      return (
        <>
          {content.header && <div className={styles.header}>{content.header}</div>}
          {message.type === 'template' && (
            <span className={styles.templateTag}>
              <Icon name="template" size={12} /> Plantilla{content.template ? ` · ${content.template}` : ''}
            </span>
          )}
          <Text text={message.body} term={term} />
          {content.footer && <div className={styles.footer}>{content.footer}</div>}
        </>
      )
    default:
      return <MessageMedia message={message} term={term} />
  }
}

function Action({ message, onOpenList }: { message: Message; onOpenList?: (m: Message) => void }) {
  const content = message.content ?? {}
  if (message.type === 'list' && content.list_button) {
    return (
      <button type="button" className={styles.inlineAction} onClick={() => onOpenList?.(message)}>
        <Icon name="list" size={16} /> {content.list_button}
      </button>
    )
  }
  if (message.type === 'cta_url' && content.url) {
    return (
      <a className={styles.inlineAction} href={content.url} target="_blank" rel="noreferrer noopener">
        <Icon name="external" size={16} /> {content.url_label || 'Abrir enlace'}
      </a>
    )
  }
  return null
}

export function Bubble({
  message,
  mine,
  first,
  term = '',
  quoted,
  showAuthor,
  showStatus,
  highlighted,
  onReply,
  onOpenList,
}: BubbleProps) {
  const author = showAuthor && message.direction === 'outbound' ? authors[message.author] : undefined
  const buttons = message.type === 'buttons' || message.type === 'template' ? (message.content?.buttons ?? []) : []
  const bare = message.type === 'sticker'
  const media = ['image', 'video', 'sticker'].includes(message.type)

  return (
    <div className={styles.row} data-mine={mine} data-first={first} id={`m-${message.id}`}>
      <div className={styles.stack}>
        <div
          className={styles.bubble}
          data-mine={mine}
          data-tail={first}
          data-bare={bare}
          data-media={media}
          data-highlight={highlighted}
          data-failed={message.status === 'failed'}
        >
          {author && (
            <span className={styles.author} data-author={message.author}>
              <Icon name={author.icon} size={12} strokeWidth={2.2} />
              {author.label}
            </span>
          )}
          {quoted && <Quote quoted={quoted} message={message} mine={mine} />}
          <div className={styles.body} data-status={showStatus}>
            <Content message={message} term={term} />
            <span className={styles.meta}>
              <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
              {showStatus && <StatusTick status={message.status} />}
            </span>
          </div>
          <Action message={message} onOpenList={onOpenList} />
        </div>
        {buttons.length > 0 && (
          <div className={styles.buttons}>
            {buttons.map((button) => (
              <button
                key={button.id}
                type="button"
                disabled={!onReply}
                onClick={() => onReply?.({ id: button.id, title: button.title })}
              >
                <Icon name="reply" size={15} />
                {button.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
