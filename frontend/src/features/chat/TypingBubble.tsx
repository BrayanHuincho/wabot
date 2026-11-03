import styles from './MessageList.module.css'

export function TypingBubble({ mine }: { mine: boolean }) {
  return (
    <div className={styles.typingRow} data-mine={mine} aria-label="Escribiendo">
      <span className={styles.typing}>
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}
