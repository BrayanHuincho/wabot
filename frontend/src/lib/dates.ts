const dayFormat = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
const weekdayFormat = new Intl.DateTimeFormat('es-PE', { weekday: 'long' })
const shortFormat = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })

const DAY = 86_400_000

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

function daysAgo(iso: string) {
  return Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY)
}

export function formatTime(iso: string) {
  const date = new Date(iso)
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`
}

export function formatDay(iso: string) {
  const diff = daysAgo(iso)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return dayFormat.format(new Date(iso)).replace('septiembre', 'setiembre')
}

export function formatListTime(iso: string | null) {
  if (!iso) return ''
  const diff = daysAgo(iso)
  if (diff === 0) return formatTime(iso)
  if (diff === 1) return 'Ayer'
  if (diff < 7) return weekdayFormat.format(new Date(iso))
  return shortFormat.format(new Date(iso))
}

export function sameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

export function minutesBetween(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function hoursLeft(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000))
}
