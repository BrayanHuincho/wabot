import { apiKey, apiUrl, mockMode } from './config'
import type {
  Conversation,
  ConversationStatus,
  Info,
  Media,
  Message,
  MessageContent,
  Mode,
  SimulatorMessage,
  Template,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Method = 'GET' | 'POST' | 'PATCH'

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (mockMode) {
    const { mockRequest } = await import('../mock/server')
    return mockRequest<T>(method, path, body)
  }

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${apiUrl}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', 'No se pudo conectar con el servidor.')
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const error = data?.error
    throw new ApiError(res.status, error?.code ?? 'http_error', error?.message ?? `Error ${res.status}`)
  }
  return data as T
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const PAGE_SIZE = 50

export const api = {
  info: () => request<Info>('GET', '/info'),
  conversations: (status: ConversationStatus, search: string) =>
    request<Conversation[]>('GET', `/conversations${query({ status, search, limit: PAGE_SIZE })}`),
  conversation: (id: string) => request<Conversation>('GET', `/conversations/${id}`),
  updateConversation: (id: string, patch: { mode?: Mode; status?: ConversationStatus }) =>
    request<Conversation>('PATCH', `/conversations/${id}`, patch),
  markRead: (id: string) => request<Conversation>('POST', `/conversations/${id}/read`),
  messages: (id: string, before?: string) =>
    request<Message[]>('GET', `/conversations/${id}/messages${query({ before, limit: PAGE_SIZE })}`),
  sendMessage: (id: string, content: MessageContent & { reply_to_id?: string }) =>
    request<Message>('POST', `/conversations/${id}/messages`, content),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Media>('POST', '/media', form)
  },
  templates: () => request<Template[]>('GET', '/templates'),
  simulate: (message: SimulatorMessage) => request<Message>('POST', '/simulator/messages', message),
}
