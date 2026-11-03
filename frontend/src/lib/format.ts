import type { MessageType } from './types'

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function extension(filename: string) {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

export function initials(name: string | null, phone: string) {
  const source = name?.trim()
  if (!source) return phone.replace(/\D/g, '').slice(-2)
  const [first = '', second] = source.split(/\s+/)
  return (second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2)).toUpperCase()
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('51') && digits.length === 11) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  return `+${digits}`
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 9 ? `+51${digits}` : `+${digits}`
}

export function displayName(contact: { name: string | null; phone: string }) {
  return contact.name?.trim() || formatPhone(contact.phone)
}

export function mediaType(mime: string): MessageType {
  if (mime === 'image/webp') return 'sticker'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

const previews: Partial<Record<MessageType, string>> = {
  image: 'Foto',
  video: 'Video',
  audio: 'Audio',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Ubicación',
  template: 'Plantilla',
}

export function previewOf(type: MessageType, body: string | null) {
  return body || previews[type] || ''
}
