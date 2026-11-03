import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Toast {
  id: number
  tone: 'error' | 'info'
  message: string
}

interface PanelState {
  selectedId: string | null
  search: string
  typing: Record<string, number>
  toasts: Toast[]
  select: (id: string | null) => void
  setSearch: (search: string) => void
  setTyping: (conversationId: string, until: number | null) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let toastSeq = 0

export const usePanel = create<PanelState>()(
  persist(
    (set) => ({
      selectedId: null,
      search: '',
      typing: {},
      toasts: [],
      select: (selectedId) => set({ selectedId }),
      setSearch: (search) => set({ search }),
      setTyping: (conversationId, until) =>
        set((s) => {
          const typing = { ...s.typing }
          if (until) typing[conversationId] = until
          else delete typing[conversationId]
          return { typing }
        }),
      toast: (message, tone = 'error') => set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, tone, message }] })),
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'wabot-panel',
      partialize: (s) => ({
        selectedId: s.selectedId,
      }),
    },
  ),
)
