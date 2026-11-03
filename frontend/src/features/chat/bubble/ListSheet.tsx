import { useState } from 'react'
import { Sheet } from '../../../components/Sheet'
import type { Message } from '../../../lib/types'
import type { ReplyChoice } from './Bubble'
import styles from './Bubble.module.css'

interface ListSheetProps {
  message: Message
  onClose: () => void
  onSelect?: (choice: ReplyChoice) => void
}

export function ListSheet({ message, onClose, onSelect }: ListSheetProps) {
  const [selected, setSelected] = useState<ReplyChoice | null>(null)
  const sections = message.content?.sections ?? []

  return (
    <Sheet title={message.content?.list_button || 'Opciones'} onClose={onClose}>
      <div className={styles.sheetList}>
        {sections.map((section, s) => (
          <section key={`${section.title}-${s}`}>
            {section.title && <h4>{section.title}</h4>}
            {section.rows.map((row) => (
              <label key={row.id} className={styles.sheetRow}>
                <span>
                  <strong>{row.title}</strong>
                  {row.description && <small>{row.description}</small>}
                </span>
                <input
                  type="radio"
                  name={`list-${message.id}`}
                  disabled={!onSelect}
                  checked={selected?.id === row.id}
                  onChange={() => setSelected({ id: row.id, title: row.title })}
                />
              </label>
            ))}
          </section>
        ))}
      </div>
      {onSelect && (
        <div className={styles.sheetFooter}>
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return
              onSelect(selected)
              onClose()
            }}
          >
            Enviar
          </button>
        </div>
      )}
    </Sheet>
  )
}
