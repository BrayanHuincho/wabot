import { useEffect, useRef } from 'react'
import styles from './Composer.module.css'

const ranges: [number, number][] = [
  [0x1f600, 0x1f637],
  [0x1f642, 0x1f644],
  [0x1f914, 0x1f914],
  [0x1f44d, 0x1f44f],
  [0x1f64c, 0x1f64f],
  [0x1f525, 0x1f525],
  [0x1f389, 0x1f38a],
  [0x1f4aa, 0x1f4aa],
  [0x1f4e6, 0x1f4e6],
  [0x1f4b0, 0x1f4b0],
  [0x1f680, 0x1f680],
  [0x1f697, 0x1f697],
]

const emojis = [
  ...ranges.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))),
  ...[0x2764, 0x2705, 0x2b50, 0x2728, 0x260e, 0x23f0].map((code) => String.fromCodePoint(code)),
]

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className={styles.popover} role="dialog" aria-label="Emojis">
      <div className={styles.emojiGrid}>
        {emojis.map((emoji) => (
          <button key={emoji} type="button" onClick={() => onPick(emoji)} aria-label={`Insertar ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
