import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePanel } from './store'

function report(error: Error) {
  usePanel.getState().toast(error.message || 'Ocurrió un error inesperado.')
}

const client = new QueryClient({
  queryCache: new QueryCache({ onError: report }),
  mutationCache: new MutationCache({ onError: report }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
