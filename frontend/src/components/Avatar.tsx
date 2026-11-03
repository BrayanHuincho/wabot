import { initials } from '../lib/format'
import { WhatsAppGlyph } from './Icon'
import styles from './Avatar.module.css'

interface AvatarProps {
  name: string | null
  phone: string
  size?: number
  badge?: boolean
}

export function Avatar({ name, phone, size = 40, badge = false }: AvatarProps) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name, phone)}
      {badge && (
        <span className={styles.badge}>
          <WhatsAppGlyph size={Math.max(9, size * 0.24)} />
        </span>
      )}
    </span>
  )
}
