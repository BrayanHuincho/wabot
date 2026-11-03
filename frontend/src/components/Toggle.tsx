import styles from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.track}
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  )
}
