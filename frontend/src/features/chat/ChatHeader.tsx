import { usePanel } from '../../app/store'
import { Avatar } from '../../components/Avatar'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Toggle } from '../../components/Toggle'
import { displayName, formatPhone } from '../../lib/format'
import { useUpdateConversation } from '../../lib/queries'
import type { Conversation } from '../../lib/types'
import styles from './ChatPanel.module.css'

interface ChatHeaderProps {
  conversation: Conversation
  typing: boolean
  searching: boolean
  expanded: boolean
  onToggleSearch: () => void
  onToggleExpand: () => void
  onShowInfo: () => void
}

export function ChatHeader({
  conversation,
  typing,
  searching,
  expanded,
  onToggleSearch,
  onToggleExpand,
  onShowInfo,
}: ChatHeaderProps) {
  const { contact, mode, status } = conversation
  const update = useUpdateConversation(conversation.id)
  const select = usePanel((s) => s.select)
  const manual = mode === 'manual'
  const closed = status === 'closed'

  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={() => select(null)} aria-label="Volver a la bandeja">
        <Icon name="arrowLeft" size={20} />
      </button>
      <button type="button" className={styles.who} onClick={onShowInfo} aria-label="Ver información del contacto">
        <Avatar name={contact.name} phone={contact.phone} size={40} badge />
        <span className={styles.identity}>
          <strong>{displayName(contact)}</strong>
          {typing ? (
            <span className={styles.typingText}>escribiendo…</span>
          ) : (
            <span>{formatPhone(contact.phone)}</span>
          )}
        </span>
      </button>
      <div className={styles.actions}>
        <label
          className={styles.modePill}
          data-manual={manual}
          title={manual ? 'Atiendes tú; el bot está en pausa' : 'El bot responde automáticamente'}
        >
          <Icon name={manual ? 'user' : 'bot'} size={15} />
          <span>{manual ? 'Manual' : 'Auto'}</span>
          <Toggle
            checked={manual}
            label="Atención manual"
            disabled={update.isPending || closed}
            onChange={(checked) => update.mutate({ mode: checked ? 'manual' : 'auto' })}
          />
        </label>
        <Button
          icon={closed ? 'rotate' : 'checkCircle'}
          size="sm"
          disabled={update.isPending}
          title={closed ? 'Volver a abrir la conversación' : 'Marcar la conversación como atendida'}
          onClick={() => update.mutate({ status: closed ? 'open' : 'closed' })}
        >
          {closed ? 'Reabrir' : 'Cerrar'}
        </Button>
        <span className={styles.divider} />
        <IconButton
          icon="search"
          label="Buscar en la conversación"
          active={searching}
          onClick={onToggleSearch}
        />
        <IconButton
          icon={expanded ? 'shrink' : 'expand'}
          label={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          active={expanded}
          onClick={onToggleExpand}
          className={styles.fullscreenToggle}
        />
      </div>
    </header>
  )
}
