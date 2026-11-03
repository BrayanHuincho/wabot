import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

export function Skeleton({
  width,
  height = 12,
  round,
}: {
  width?: CSSProperties['width']
  height?: number
  round?: boolean
}) {
  return <span className={styles.skeleton} style={{ width, height, borderRadius: round ? '50%' : undefined }} />
}
