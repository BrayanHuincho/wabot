import type { Message, MessageContent } from '../../lib/types'

export function previewMessage(content: MessageContent): Message {
  const { type, body, media_id: _media, ...extras } = content
  return {
    id: 'preview',
    conversation_id: 'preview',
    direction: 'outbound',
    author: 'agent',
    type,
    body: body ?? null,
    content: extras,
    media: null,
    reply_to_id: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    sent_at: null,
    delivered_at: null,
    read_at: null,
  }
}
