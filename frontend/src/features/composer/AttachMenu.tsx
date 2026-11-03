import { useEffect, useRef } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import styles from './Composer.module.css'

export type AttachAction = 'media' | 'document' | 'audio' | 'buttons' | 'list' | 'cta' | 'location' | 'template'

const items: { action: AttachAction; label: string; icon: IconName; tone: string }[] = [
  { action: 'media', label: 'Imagen o video', icon: 'image', tone: '#007bfc' },
  { action: 'document', label: 'Documento', icon: 'fileText', tone: '#7f66ff' },
  { action: 'audio', label: 'Audio', icon: 'headphones', tone: '#fa6533' },
  { action: 'buttons', label: 'Botones', icon: 'pointer', tone: '#02a698' },
  { action: 'list', label: 'Lista', icon: 'list', tone: '#ffbc38' },
  { action: 'cta', label: 'Enlace (CTA)', icon: 'external', tone: '#0795dc' },
  { action: 'location', label: 'Ubicación', icon: 'pin', tone: '#e5484d' },
  { action: 'template', label: 'Plantilla', icon: 'template', tone: '#54656f' },
]

export function AttachMenu({ onPick, onClose }: { onPick: (action: AttachAction) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
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
    <div ref={ref} className={`${styles.popover} ${styles.attachMenu}`} role="menu">
      {items.map((item) => (
        <button key={item.action} type="button" role="menuitem" onClick={() => onPick(item.action)}>
          <span style={{ color: item.tone }}>
            <Icon name={item.icon} size={18} />
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
