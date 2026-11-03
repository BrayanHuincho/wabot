import { ApiError } from '../lib/api'
import { previewOf } from '../lib/format'
import { emit as broadcast } from '../lib/realtime'
import type { Conversation, Media, Message, MessageContent, RealtimeEvent, SimulatorMessage } from '../lib/types'
import {
  brochure,
  info,
  message,
  seed,
  servicesList,
  templates,
  uid,
  welcomeButtons,
  type StoredConversation,
} from './data'

const WINDOW_MS = 24 * 3_600_000
const conversations = seed()
const media = new Map<string, Media>()

const emit = (event: RealtimeEvent) => broadcast(structuredClone(event))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function view(c: StoredConversation): Conversation {
  const last = c.messages.at(-1)
  const expires = c.last_inbound_at ? new Date(new Date(c.last_inbound_at).getTime() + WINDOW_MS) : null
  return {
    id: c.id,
    contact: c.contact,
    mode: c.mode,
    status: c.status,
    unread_count: c.unread_count,
    preview: last ? previewOf(last.type, last.body) : null,
    last_message_at: last?.created_at ?? null,
    window_expires_at: expires?.toISOString() ?? null,
    window_open: Boolean(expires && expires.getTime() > Date.now()),
  }
}

function find(id: string) {
  const conversation = conversations.find((c) => c.id === id)
  if (!conversation) throw new ApiError(404, 'not_found', 'La conversación no existe.')
  return conversation
}

function push(c: StoredConversation, msg: Message) {
  c.messages.push(msg)
  emit({ event: 'message.created', data: { message: msg, conversation: view(c) } })
}

function advanceStatus(c: StoredConversation, msg: Message) {
  const steps: [Message['status'], number][] = [
    ['sent', 500],
    ['delivered', 1300],
    ['read', 2600],
  ]
  for (const [status, delay] of steps) {
    setTimeout(() => {
      const now = new Date().toISOString()
      Object.assign(msg, {
        status,
        delivered_at: status !== 'sent' ? (msg.delivered_at ?? now) : null,
        read_at: status === 'read' ? now : null,
      })
      emit({
        event: 'message.status',
        data: { id: msg.id, conversation_id: c.id, status, delivered_at: msg.delivered_at, read_at: msg.read_at },
      })
    }, delay)
  }
}

function outbound(
  c: StoredConversation,
  author: Message['author'],
  content: MessageContent & { reply_to_id?: string },
) {
  const { type, body, media_id, reply_to_id, ...extras } = content
  const attached = media_id ? media.get(media_id) : undefined
  if (media_id && !attached) throw new ApiError(404, 'not_found', 'El archivo no existe.')
  const template = type === 'template' ? templates.find((t) => t.name === extras.template) : undefined
  const text =
    template?.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => extras.params?.[Number(n) - 1] ?? '') ?? body ?? null
  const buttons = template ? template.buttons.map((title, i) => ({ id: `tpl_${i}`, title })) : extras.buttons
  const msg = message(c.id, 'outbound', author, type, text, new Date().toISOString(), {
    content: { ...extras, buttons },
    media: attached,
    status: 'pending',
    reply_to_id,
  })
  push(c, msg)
  advanceStatus(c, msg)
  return msg
}

async function botReply(c: StoredConversation, incoming: Message) {
  if (c.mode !== 'auto') return
  await wait(500)
  emit({ event: 'typing', data: { conversation_id: c.id, author: 'bot' } })
  await wait(1400)
  if (c.mode !== 'auto') return
  const reply = incoming.content?.reply_id
  const text = (incoming.body ?? '').toLowerCase()
  const name = c.contact.name?.split(' ')[0] ?? ''

  if (reply === 'services' || text.includes('servicio')) {
    outbound(c, 'bot', {
      type: 'list',
      body: 'Estos son nuestros servicios. Elige uno y te cuento más.',
      ...servicesList,
    })
  } else if (reply === 'prices' || text.includes('precio')) {
    outbound(c, 'bot', {
      type: 'cta_url',
      body: 'Nuestros planes empiezan desde *S/ 350* al mes. Revisa el detalle aquí:',
      url: 'https://example.com/precios',
      url_label: 'Ver precios',
    })
  } else if (reply === 'human' || text.includes('asesor')) {
    outbound(c, 'bot', {
      type: 'text',
      body: 'Listo, te comunico con un asesor. En breve te escribe una persona del equipo.',
    })
    c.mode = 'manual'
    emit({ event: 'conversation.updated', data: view(c) })
  } else if (reply?.startsWith('svc_')) {
    const file = brochure()
    media.set(file.id, file)
    outbound(c, 'bot', {
      type: 'document',
      media_id: file.id,
      body: `Aquí tienes el detalle de *${incoming.content?.reply_title}*.`,
    })
  } else if (incoming.type === 'location') {
    outbound(c, 'bot', { type: 'text', body: 'Gracias, ya registramos tu ubicación para la visita.' })
  } else if (incoming.type !== 'text' && incoming.type !== 'reply') {
    outbound(c, 'bot', { type: 'text', body: '¡Recibido! Un asesor lo revisará y te responde pronto.' })
  } else {
    outbound(c, 'bot', {
      type: 'buttons',
      body: `¡Hola${name ? ` ${name}` : ''}! Soy el asistente virtual de *Wabot Demo*. ¿En qué te puedo ayudar?`,
      footer: 'Responde con un botón',
      buttons: welcomeButtons,
    })
  }
}

function simulate(input: SimulatorMessage) {
  let c = conversations.find((item) => item.contact.phone === input.phone)
  if (!c) {
    c = {
      id: `c-${uid()}`,
      contact: { id: `ct-${uid()}`, phone: input.phone, name: input.name ?? null },
      mode: 'auto',
      status: 'open',
      unread_count: 0,
      last_inbound_at: null,
      messages: [],
    }
    conversations.push(c)
  }
  const now = new Date().toISOString()
  const attached = input.media_id ? media.get(input.media_id) : undefined
  const content =
    input.type === 'reply'
      ? { reply_id: input.reply_id, reply_title: input.reply_title }
      : input.location
        ? { location: input.location }
        : null
  const msg = message(c.id, 'inbound', 'contact', input.type, input.body ?? input.reply_title ?? null, now, {
    content: content ?? undefined,
    media: attached,
    reply_to_id: input.reply_to_id,
  })
  c.status = 'open'
  c.last_inbound_at = now
  c.unread_count += 1
  push(c, msg)
  for (const out of c.messages) {
    if (out.direction === 'outbound' && out.status !== 'read' && out.status !== 'failed') {
      Object.assign(out, { status: 'read', read_at: now })
      emit({
        event: 'message.status',
        data: {
          id: out.id,
          conversation_id: c.id,
          status: 'read',
          delivered_at: out.delivered_at ?? now,
          read_at: now,
        },
      })
    }
  }
  void botReply(c, msg)
  return msg
}

function upload(form: FormData): Media {
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError(422, 'invalid_message', 'Falta el archivo.')
  if (file.size > 16 * 1024 * 1024) throw new ApiError(413, 'file_too_large', 'El archivo supera los 16 MB.')
  const item: Media = {
    id: uid(),
    filename: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    url: URL.createObjectURL(file),
  }
  media.set(item.id, item)
  return item
}

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await wait(120 + Math.random() * 180)
  const url = new URL(path, 'http://mock')
  const parts = url.pathname.split('/').filter(Boolean)
  const params = url.searchParams
  const route = `${method} /${parts.map((p, i) => (i === 1 && parts[0] === 'conversations' ? ':id' : p)).join('/')}`
  const id = parts[1] ?? ''

  const result = ((): unknown => {
    switch (route) {
      case 'GET /info':
        return info
      case 'GET /templates':
        return templates
      case 'GET /conversations': {
        const search = (params.get('search') ?? '').toLowerCase()
        return conversations
          .filter((c) => c.status === (params.get('status') ?? 'open'))
          .filter((c) => !search || `${c.contact.name ?? ''} ${c.contact.phone}`.toLowerCase().includes(search))
          .map(view)
          .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
      }
      case 'GET /conversations/:id':
        return view(find(id))
      case 'PATCH /conversations/:id': {
        const c = find(id)
        Object.assign(c, body as object)
        emit({ event: 'conversation.updated', data: view(c) })
        return view(c)
      }
      case 'POST /conversations/:id/read': {
        const c = find(id)
        c.unread_count = 0
        emit({ event: 'conversation.updated', data: view(c) })
        return view(c)
      }
      case 'GET /conversations/:id/messages': {
        const before = params.get('before')
        const limit = Number(params.get('limit') ?? 50)
        const list = find(id).messages.filter((m) => !before || m.created_at < before)
        return list.slice(-limit)
      }
      case 'POST /conversations/:id/messages': {
        const c = find(id)
        const content = body as MessageContent
        if (c.status === 'closed')
          throw new ApiError(409, 'conversation_closed', 'La conversación está cerrada. Reábrela para responder.')
        if (!view(c).window_open && content.type !== 'template')
          throw new ApiError(
            409,
            'window_closed',
            'Pasaron más de 24 h desde el último mensaje del cliente: solo se permiten plantillas.',
          )
        if (c.mode !== 'manual') {
          c.mode = 'manual'
          emit({ event: 'conversation.updated', data: view(c) })
        }
        return outbound(c, 'agent', content)
      }
      case 'POST /media':
        return upload(body as FormData)
      case 'POST /simulator/messages':
        return simulate(body as SimulatorMessage)
      default:
        throw new ApiError(404, 'not_found', `Ruta simulada no encontrada: ${route}`)
    }
  })()
  return structuredClone(result) as T
}
