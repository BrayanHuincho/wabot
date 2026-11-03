import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { appendMessage, keys, updateMessage, upsertConversation } from '../lib/cache'
import { startRealtime, subscribe, subscribeState } from '../lib/realtime'
import { usePanel } from './store'

const TYPING_MS = 6000

export function useRealtime() {
  const client = useQueryClient()

  useEffect(() => {
    startRealtime()
    let wasOffline = false
    const offState = subscribeState((state) => {
      if (state === 'offline') wasOffline = true
      if (state === 'online' && wasOffline) {
        wasOffline = false
        void client.invalidateQueries()
      }
    })

    const off = subscribe(({ event, data }) => {
      const { setTyping, selectedId } = usePanel.getState()
      switch (event) {
        case 'message.created':
          appendMessage(client, data.message)
          if (data.message.direction === 'outbound') setTyping(data.conversation.id, null)
          upsertConversation(client, data.conversation)
          if (!client.getQueryData(keys.messages(data.conversation.id)) && selectedId === data.conversation.id) {
            void client.invalidateQueries({ queryKey: keys.messages(data.conversation.id) })
          }
          break
        case 'message.status':
          updateMessage(client, data.conversation_id, data.id, data)
          break
        case 'conversation.updated':
          upsertConversation(client, data)
          break
        case 'typing': {
          const until = Date.now() + TYPING_MS
          setTyping(data.conversation_id, until)
          setTimeout(() => {
            if (usePanel.getState().typing[data.conversation_id] === until) setTyping(data.conversation_id, null)
          }, TYPING_MS)
          break
        }
      }
    })
    return () => {
      off()
      offState()
    }
  }, [client])
}
