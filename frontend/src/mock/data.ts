import type { Contact, Info, Media, Message, MessageExtras, MessageType, Template } from '../lib/types'
import { pdfUrl, photoUrl, voiceUrl } from './assets'

export interface StoredConversation {
  id: string
  contact: Contact
  mode: 'auto' | 'manual'
  status: 'open' | 'closed'
  unread_count: number
  last_inbound_at: string | null
  messages: Message[]
}

export const info: Info = {
  business_name: 'Wabot Demo',
  business_phone: '+51 1 700 4000',
  channel: 'mock',
  ai_enabled: false,
  ai_model: null,
  service_window_hours: 24,
}

export const templates: Template[] = [
  {
    name: 'retomar_conversacion',
    body: 'Hola {{1}}, te escribimos de Wabot Demo para continuar con tu consulta. ¿Te podemos ayudar en algo más?',
    params: ['nombre'],
    buttons: ['Sí, por favor', 'No, gracias'],
  },
  {
    name: 'recordatorio_cita',
    body: 'Hola {{1}}, te recordamos tu cita del {{2}} a las {{3}}. Responde *CONFIRMAR* para confirmarla.',
    params: ['nombre', 'fecha', 'hora'],
    buttons: [],
  },
  {
    name: 'pedido_enviado',
    body: '¡Tu pedido {{1}} va en camino! Llegará aproximadamente el {{2}}.',
    params: ['número de pedido', 'fecha de entrega'],
    buttons: ['Ver seguimiento'],
  },
]

let seq = 0
export const uid = () => `${Date.now().toString(16)}-${(seq++).toString(16).padStart(4, '0')}-mock`

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function message(
  conversation_id: string,
  direction: 'inbound' | 'outbound',
  author: Message['author'],
  type: MessageType,
  body: string | null,
  created_at: string,
  extras: { content?: MessageExtras; media?: Media; status?: Message['status']; reply_to_id?: string } = {},
): Message {
  const status = extras.status ?? (direction === 'inbound' ? 'received' : 'read')
  return {
    id: uid(),
    conversation_id,
    direction,
    author,
    type,
    body,
    content: extras.content ?? null,
    media: extras.media ?? null,
    reply_to_id: extras.reply_to_id ?? null,
    status,
    created_at,
    sent_at: direction === 'outbound' ? created_at : null,
    delivered_at: status === 'delivered' || status === 'read' ? created_at : null,
    read_at: status === 'read' ? created_at : null,
  }
}

export const brochure = (): Media => ({
  id: uid(),
  filename: 'Brochure-servicios-2026.pdf',
  mime_type: 'application/pdf',
  size_bytes: 48211,
  url: pdfUrl(),
})

export const welcomeButtons = [
  { id: 'services', title: 'Ver servicios' },
  { id: 'prices', title: 'Precios' },
  { id: 'human', title: 'Hablar con asesor' },
]

export const servicesList: MessageExtras = {
  header: 'Nuestros servicios',
  footer: 'Wabot Demo',
  list_button: 'Ver servicios',
  sections: [
    {
      title: 'Marketing',
      rows: [
        { id: 'svc_ads', title: 'Publicidad en redes', description: 'Campañas en Meta y TikTok con reporte semanal' },
        { id: 'svc_seo', title: 'SEO', description: 'Posicionamiento orgánico en Google' },
      ],
    },
    {
      title: 'Desarrollo',
      rows: [
        { id: 'svc_web', title: 'Página web', description: 'Sitio rápido, autoadministrable y con dominio' },
        { id: 'svc_bot', title: 'Chatbot de WhatsApp', description: 'Atención automática 24/7 con traspaso a asesor' },
      ],
    },
  ],
}

function monica(): StoredConversation {
  const id = 'c-monica'
  const hola = message(id, 'inbound', 'contact', 'text', 'Hola', '2026-09-28T15:58:00Z')
  return {
    id,
    contact: { id: 'ct-monica', phone: '+51924368603', name: 'Monica' },
    mode: 'manual',
    status: 'open',
    unread_count: 0,
    last_inbound_at: '2026-09-28T16:00:00Z',
    messages: [
      hola,
      message(
        id,
        'outbound',
        'bot',
        'buttons',
        '¡Hola Monica! Soy el asistente virtual de *Wabot Demo*. ¿En qué te puedo ayudar?',
        '2026-09-28T15:58:04Z',
        {
          content: { buttons: welcomeButtons, footer: 'Responde con un botón' },
        },
      ),
      message(id, 'inbound', 'contact', 'text', 'Que servicios tiene?', '2026-09-28T16:00:00Z'),
      message(
        id,
        'outbound',
        'bot',
        'document',
        'Te comparto nuestro brochure con todos los servicios.',
        '2026-09-28T16:00:06Z',
        {
          media: brochure(),
        },
      ),
      message(id, 'outbound', 'agent', 'text', 'Tenemos el servicio de marketing digital.', '2026-09-28T16:01:00Z'),
    ],
  }
}

function carlos(): StoredConversation {
  const id = 'c-carlos'
  const first = message(
    id,
    'inbound',
    'contact',
    'text',
    'Buenas tardes, quisiera cotizar una página web',
    minutesAgo(32),
  )
  const list = message(
    id,
    'outbound',
    'bot',
    'list',
    'Con gusto. Elige el servicio que te interesa y te envío los detalles.',
    minutesAgo(31),
    {
      content: servicesList,
    },
  )
  return {
    id,
    contact: { id: 'ct-carlos', phone: '+51987654321', name: 'Carlos Ríos' },
    mode: 'auto',
    status: 'open',
    unread_count: 2,
    last_inbound_at: minutesAgo(6),
    messages: [
      first,
      list,
      message(id, 'inbound', 'contact', 'reply', 'Página web', minutesAgo(7), {
        content: { reply_id: 'svc_web', reply_title: 'Página web' },
        reply_to_id: list.id,
      }),
      message(id, 'inbound', 'contact', 'text', '¿Incluye el dominio .pe?', minutesAgo(6)),
    ],
  }
}

function lucia(): StoredConversation {
  const id = 'c-lucia'
  return {
    id,
    contact: { id: 'ct-lucia', phone: '+51955123456', name: 'Lucía Fernández' },
    mode: 'auto',
    status: 'open',
    unread_count: 0,
    last_inbound_at: minutesAgo(60 * 20),
    messages: [
      message(id, 'inbound', 'contact', 'image', 'Así quiero que se vea el banner', minutesAgo(60 * 20), {
        media: { id: uid(), filename: 'referencia.svg', mime_type: 'image/svg+xml', size_bytes: 1520, url: photoUrl() },
      }),
      message(
        id,
        'outbound',
        'bot',
        'cta_url',
        'Puedes revisar ejemplos de banners que hicimos en nuestro portafolio.',
        minutesAgo(60 * 20 - 1),
        {
          content: { url: 'https://example.com/portafolio', url_label: 'Ver portafolio' },
        },
      ),
    ],
  }
}

function ana(): StoredConversation {
  const id = 'c-ana'
  return {
    id,
    contact: { id: 'ct-ana', phone: '+51933444555', name: 'Ana Torres' },
    mode: 'manual',
    status: 'open',
    unread_count: 1,
    last_inbound_at: minutesAgo(60 * 26),
    messages: [
      message(id, 'inbound', 'contact', 'audio', null, minutesAgo(60 * 26), {
        media: { id: uid(), filename: 'nota-de-voz.wav', mime_type: 'audio/wav', size_bytes: 64044, url: voiceUrl() },
      }),
    ],
  }
}

function jorge(): StoredConversation {
  const id = 'c-jorge'
  return {
    id,
    contact: { id: 'ct-jorge', phone: '+51911222333', name: 'Jorge Paredes' },
    mode: 'auto',
    status: 'closed',
    unread_count: 0,
    last_inbound_at: minutesAgo(60 * 24 * 4),
    messages: [
      message(id, 'inbound', 'contact', 'location', null, minutesAgo(60 * 24 * 4), {
        content: {
          location: { latitude: -12.1211, longitude: -77.0297, name: 'Parque Kennedy', address: 'Miraflores, Lima' },
        },
      }),
      message(
        id,
        'outbound',
        'agent',
        'text',
        '¡Perfecto! Te esperamos mañana a las _10:00 a. m._ en esa dirección.',
        minutesAgo(60 * 24 * 4 - 3),
      ),
    ],
  }
}

export function seed(): StoredConversation[] {
  return [carlos(), lucia(), ana(), monica(), jorge()]
}
