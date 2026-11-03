import { useRef, useState } from 'react'
import { usePanel } from '../../app/store'
import { Icon, type IconName } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { formatDuration } from '../../lib/dates'
import { initials, mediaType } from '../../lib/format'
import { useConversations, useInfo, useSimulate, useUpload } from '../../lib/queries'
import type { Location, SimulatorMessage } from '../../lib/types'
import { doodleBackground } from '../chat/doodle'
import { MessageList } from '../chat/MessageList'
import { useRecorder } from '../composer/useRecorder'
import styles from './Simulator.module.css'

const customer = { name: 'Brayan', phone: '+51924368603' }
const fallbackLocation: Location = {
  latitude: -12.046374,
  longitude: -77.042793,
  name: 'Plaza de Armas de Lima',
  address: 'Jr. de la Unión, Cercado de Lima',
}

function currentLocation() {
  return new Promise<Location>((resolve) => {
    if (!navigator.geolocation) return resolve(fallbackLocation)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, name: 'Mi ubicación' }),
      () => resolve(fallbackLocation),
      { timeout: 3000 },
    )
  })
}

const attachItems: { key: 'document' | 'media' | 'audio' | 'location'; label: string; icon: IconName; tone: string }[] =
  [
    { key: 'document', label: 'Documento', icon: 'fileText', tone: '#7f66ff' },
    { key: 'media', label: 'Galería', icon: 'image', tone: '#007bfc' },
    { key: 'audio', label: 'Audio', icon: 'headphones', tone: '#fa6533' },
    { key: 'location', label: 'Ubicación', icon: 'pin', tone: '#1fa855' },
  ]

export function Simulator() {
  const { data: info } = useInfo()
  const { data: conversations } = useConversations('open', '')
  const toast = usePanel((s) => s.toast)
  const conversation = conversations?.find((c) => c.contact.phone === customer.phone)
  const typing = usePanel((s) => Boolean(conversation && s.typing[conversation.id]))

  const [text, setText] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const simulate = useSimulate()
  const upload = useUpload()

  const sendAs = (message: Omit<SimulatorMessage, 'phone' | 'name'>) => {
    simulate.mutate({ ...customer, ...message })
  }

  const sendFile = async (file: File) => {
    const media = await upload.mutateAsync(file)
    sendAs({ type: mediaType(media.mime_type), media_id: media.id })
  }

  const recorder = useRecorder(
    (file) => void sendFile(file).catch(() => undefined),
    (message) => toast(message),
  )

  const submit = () => {
    const body = text.trim()
    if (!body) return
    sendAs({ type: 'text', body })
    setText('')
  }

  const attach = async (key: (typeof attachItems)[number]['key']) => {
    setAttachOpen(false)
    if (key === 'location') {
      sendAs({ type: 'location', location: await currentLocation() })
      return
    }
    const input = fileInput.current
    if (!input) return
    input.accept = key === 'media' ? 'image/*,video/*' : key === 'audio' ? 'audio/*' : '*/*'
    input.click()
  }

  const business = info?.business_name ?? 'Wabot'

  return (
    <aside className={styles.column} aria-label="Simulador de cliente">
      <header className={styles.top}>
        <div className={styles.title}>
          <strong>Simulador</strong>
          <span>Escribe como el cliente</span>
        </div>
      </header>

      <div className={styles.stage}>
        <div className={styles.phone}>
          <div className={styles.screen}>
            <div className={styles.waHeader}>
              <Icon name="arrowLeft" size={22} />
              <span className={styles.bizAvatar}>{initials(business, '')}</span>
              <div className={styles.bizName}>
                <strong>{business}</strong>
                <span data-typing={typing}>{typing ? 'escribiendo…' : 'en línea'}</span>
              </div>
              <Icon name="video" size={22} />
              <Icon name="phone" size={19} />
              <Icon name="kebab" size={22} strokeWidth={2.6} />
            </div>

            <div className={styles.chat}>
              {conversation ? (
                <MessageList
                  conversationId={conversation.id}
                  perspective="customer"
                  typing={typing}
                  onReply={(choice, message) =>
                    sendAs({
                      type: 'reply',
                      reply_id: choice.id,
                      reply_title: choice.title,
                      body: choice.title,
                      reply_to_id: message.id,
                    })
                  }
                />
              ) : (
                <div className={styles.chatEmpty} style={{ backgroundImage: doodleBackground }}>
                  <p>
                    <Icon name="lock" size={12} />{' '}
                    Escribe "Hola" para iniciar la conversación con el bot.
                  </p>
                </div>
              )}
              {attachOpen && (
                <Sheet title="Adjuntar" onClose={() => setAttachOpen(false)}>
                  <div className={styles.attachGrid}>
                    {attachItems.map((item) => (
                      <button key={item.key} type="button" onClick={() => void attach(item.key)}>
                        <span style={{ background: item.tone }}>
                          <Icon name={item.icon} size={22} />
                        </span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </Sheet>
              )}
            </div>

            <div className={styles.inputBar}>
              {recorder.recording ? (
                <div className={styles.pill}>
                  <button type="button" onClick={recorder.cancel} aria-label="Descartar">
                    <Icon name="trash" size={20} />
                  </button>
                  <span className={styles.rec}>
                    <i /> {formatDuration(recorder.seconds)}
                  </span>
                </div>
              ) : (
                <div className={styles.pill}>
                  <Icon name="smile" size={23} />
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="Mensaje"
                    aria-label="Mensaje del cliente"
                  />
                  <button type="button" onClick={() => setAttachOpen(true)} aria-label="Adjuntar">
                    <Icon name="paperclip" size={21} style={{ transform: 'rotate(-45deg)' }} />
                  </button>
                  <button type="button" onClick={() => void attach('media')} aria-label="Cámara">
                    <Icon name="camera" size={20} />
                  </button>
                </div>
              )}
              <button
                type="button"
                className={styles.fab}
                disabled={upload.isPending}
                aria-label={recorder.recording ? 'Enviar nota de voz' : text.trim() ? 'Enviar' : 'Grabar nota de voz'}
                onClick={() => (recorder.recording ? recorder.stop() : text.trim() ? submit() : void recorder.start())}
              >
                <Icon name={recorder.recording || text.trim() ? 'send' : 'mic'} size={22} strokeWidth={2.1} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void sendFile(file).catch(() => undefined)
        }}
      />
    </aside>
  )
}
