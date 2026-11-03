export type Mode = 'auto' | 'manual'
export type AiStatus = 'ok' | 'disabled' | 'error'
export type ConversationStatus = 'open' | 'closed'
export type Direction = 'inbound' | 'outbound'
export type Author = 'contact' | 'bot' | 'agent' | 'api'
export type MessageStatus = 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'
export type MessageType = 'text' | MediaType | 'buttons' | 'list' | 'cta_url' | 'location' | 'template' | 'reply'

export interface Contact {
  id: string
  phone: string
  name: string | null
}

export interface Conversation {
  id: string
  contact: Contact
  mode: Mode
  status: ConversationStatus
  unread_count: number
  preview: string | null
  last_message_at: string | null
  window_expires_at: string | null
  window_open: boolean
}

export interface Media {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  url: string
}

export interface ReplyButton {
  id: string
  title: string
}

export interface ListRow {
  id: string
  title: string
  description?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export interface Location {
  latitude: number
  longitude: number
  name?: string
  address?: string
}

export interface MessageExtras {
  header?: string
  footer?: string
  buttons?: ReplyButton[]
  list_button?: string
  sections?: ListSection[]
  url?: string
  url_label?: string
  location?: Location
  template?: string
  params?: string[]
  reply_id?: string
  reply_title?: string
}

export interface Message {
  id: string
  conversation_id: string
  direction: Direction
  author: Author
  type: MessageType
  body: string | null
  content: MessageExtras | null
  media: Media | null
  reply_to_id: string | null
  status: MessageStatus
  created_at: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
}

export type MessageContent = MessageExtras & {
  type: Exclude<MessageType, 'reply'>
  body?: string
  media_id?: string
}

export interface SimulatorMessage {
  phone: string
  name?: string
  type: MessageType
  body?: string
  media_id?: string
  reply_id?: string
  reply_title?: string
  location?: Location
  reply_to_id?: string
}

export interface Template {
  name: string
  body: string
  params: string[]
  buttons: string[]
}

export interface Info {
  business_name: string
  business_phone: string
  channel: string
  ai_enabled: boolean
  ai_model: string | null
  ai_provider?: string | null
  ai_status?: AiStatus
  service_window_hours: number
}

export type RealtimeEvent =
  | { event: 'message.created'; data: { message: Message; conversation: Conversation } }
  | {
      event: 'message.status'
      data: Pick<Message, 'id' | 'conversation_id' | 'status' | 'delivered_at' | 'read_at'>
    }
  | { event: 'conversation.updated'; data: Conversation }
  | { event: 'typing'; data: { conversation_id: string; author: 'bot' } }
