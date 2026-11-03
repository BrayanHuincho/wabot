import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Conversation, Message } from './types'

export const keys = {
  info: ['info'] as const,
  templates: ['templates'] as const,
  conversations: ['conversations'] as const,
  conversationList: (status: string, search: string) => ['conversations', status, search] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
}

type Pages = InfiniteData<Message[], string | undefined>

function byRecent(a: Conversation, b: Conversation) {
  return (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')
}

export function upsertConversation(client: QueryClient, conversation: Conversation) {
  client.setQueryData(keys.conversation(conversation.id), conversation)
  for (const [key, list] of client.getQueriesData<Conversation[]>({ queryKey: keys.conversations })) {
    if (!list) continue
    const [, status, search] = key as [string, string, string]
    const others = list.filter((c) => c.id !== conversation.id)
    const name = `${conversation.contact.name ?? ''} ${conversation.contact.phone}`.toLowerCase()
    const belongs = conversation.status === status && (!search || name.includes(search.toLowerCase()))
    client.setQueryData(key, belongs ? [...others, conversation].sort(byRecent) : others)
  }
}

export function appendMessage(client: QueryClient, message: Message) {
  client.setQueryData<Pages>(keys.messages(message.conversation_id), (data) => {
    if (!data) return data
    if (data.pages.some((page) => page.some((m) => m.id === message.id))) {
      return patchMessage(data, message.id, message)
    }
    const [newest = [], ...rest] = data.pages
    return { ...data, pages: [[...newest, message], ...rest] }
  })
}

function patchMessage(data: Pages, id: string, patch: Partial<Message>): Pages {
  return {
    ...data,
    pages: data.pages.map((page) => page.map((m) => (m.id === id ? { ...m, ...patch } : m))),
  }
}

export function updateMessage(client: QueryClient, conversationId: string, id: string, patch: Partial<Message>) {
  client.setQueryData<Pages>(keys.messages(conversationId), (data) => data && patchMessage(data, id, patch))
}

export function flattenPages(data: InfiniteData<Message[], unknown> | undefined) {
  return data ? [...data.pages].reverse().flat() : []
}
