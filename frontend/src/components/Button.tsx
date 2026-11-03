import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'warning'
  icon?: IconName
  size?: 'sm' | 'md'
}

export function Button({ variant = 'outline', icon, size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  active?: boolean
  size?: number
  tip?: 'top' | 'bottom' | 'none'
}

export function IconButton({ icon, label, active, size = 20, tip = 'bottom', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${className ?? ''}`}
      aria-label={label}
      data-tip={tip === 'none' ? undefined : tip}
      aria-pressed={active}
      data-active={active}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
