import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PAGE_SIZE, api } from './api'
import { appendMessage, flattenPages, keys, upsertConversation } from './cache'
import type { ConversationStatus, MessageContent, Mode, SimulatorMessage } from './types'

export function useInfo() {
  return useQuery({ queryKey: keys.info, queryFn: api.info, staleTime: Infinity })
}

export function useTemplates(enabled: boolean) {
  return useQuery({ queryKey: keys.templates, queryFn: api.templates, enabled, staleTime: 60_000 })
}

export function useConversations(status: ConversationStatus, search: string) {
  return useQuery({
    queryKey: keys.conversationList(status, search),
    queryFn: () => api.conversations(status, search),
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: keys.conversation(id ?? ''),
    queryFn: () => api.conversation(id!),
    enabled: Boolean(id),
  })
}

export function useMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryKey: keys.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) => api.messages(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.length < PAGE_SIZE ? undefined : page[0]?.created_at),
    enabled: Boolean(conversationId),
    staleTime: Infinity,
  })
  return { ...query, messages: flattenPages(query.data) }
}

export function useUpdateConversation(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: { mode?: Mode; status?: ConversationStatus }) => api.updateConversation(id, patch),
    onSuccess: (conversation) => upsertConversation(client, conversation),
  })
}

export function useSendMessage(conversationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (content: MessageContent & { reply_to_id?: string }) => api.sendMessage(conversationId, content),
    onSuccess: (message) => appendMessage(client, message),
  })
}

export function useSimulate() {
  return useMutation({ mutationFn: (message: SimulatorMessage) => api.simulate(message) })
}

export function useUpload() {
  return useMutation({ mutationFn: (file: File) => api.upload(file) })
}
