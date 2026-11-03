import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePanel } from '../../app/store'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { formatDuration } from '../../lib/dates'
import { mediaType } from '../../lib/format'
import { limits } from '../../lib/limits'
import { useSendMessage, useUpdateConversation, useUpload } from '../../lib/queries'
import type { Conversation, MessageContent } from '../../lib/types'
import { TemplatePicker } from '../templates/TemplatePicker'
import { AttachMenu, type AttachAction } from './AttachMenu'
import { Builder, type BuilderKind } from './Builder'
import { EmojiPicker } from './EmojiPicker'
import { UploadPreview } from './UploadPreview'
import { useRecorder } from './useRecorder'
import styles from './Composer.module.css'

type Popover = 'emoji' | 'attach' | null
type Dialog = { kind: 'builder'; builder: BuilderKind } | { kind: 'template' } | { kind: 'upload'; file: File } | null

const accept: Record<'media' | 'document' | 'audio', string> = {
  media: 'image/*,video/*',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip',
  audio: 'audio/*',
}

export function Composer({ conversation }: { conversation: Conversation }) {
  const [text, setText] = useState('')
  const [popover, setPopover] = useState<Popover>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [dragging, setDragging] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const toast = usePanel((s) => s.toast)
  const send = useSendMessage(conversation.id)
  const upload = useUpload()
  const reopen = useUpdateConversation(conversation.id)
  const closed = conversation.status === 'closed'
  const closedWindow = !closed && !conversation.window_open
  const busy = send.isPending || upload.isPending

  const sendFile = async (file: File, caption = '') => {
    const media = await upload.mutateAsync(file)
    await send.mutateAsync({
      type: mediaType(media.mime_type) as MessageContent['type'],
      media_id: media.id,
      body: caption || undefined,
    })
  }

  const recorder = useRecorder(
    (file) => void sendFile(file).catch(() => undefined),
    (message) => toast(message),
  )

  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  useEffect(() => {
    const panel = root.current?.parentElement
    if (!panel || closedWindow || closed) return
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (!panel.contains(e.relatedTarget as Node)) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) setDialog({ kind: 'upload', file })
    }
    panel.addEventListener('dragover', over)
    panel.addEventListener('dragleave', leave)
    panel.addEventListener('drop', drop)
    return () => {
      panel.removeEventListener('dragover', over)
      panel.removeEventListener('dragleave', leave)
      panel.removeEventListener('drop', drop)
    }
  }, [closedWindow, closed])

  const submit = () => {
    const body = text.trim()
    if (!body || busy || closedWindow) return
    if (body.length > limits.text) {
      toast(`El mensaje supera los ${limits.text} caracteres.`)
      return
    }
    send.mutate({ type: 'text', body }, { onSuccess: () => setText('') })
  }

  const insertEmoji = (emoji: string) => {
    const el = textarea.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const pickAttach = (action: AttachAction) => {
    setPopover(null)
    if (action === 'template') {
      setDialog({ kind: 'template' })
      return
    }
    if (action === 'media' || action === 'document' || action === 'audio') {
      const input = fileInput.current
      if (!input) return
      input.accept = accept[action]
      input.click()
      return
    }
    setDialog({ kind: 'builder', builder: action })
  }

  const sendContent = (content: MessageContent) => send.mutate(content, { onSuccess: () => setDialog(null) })

  return (
    <div ref={root} className={styles.composer}>
      {dragging && (
        <div className={styles.dropZone}>
          <Icon name="paperclip" size={28} />
          Suelta el archivo para enviarlo
        </div>
      )}
      {closed ? (
        <div className={styles.notice}>
          <Icon name="lock" size={16} />
          <p>Esta conversación está cerrada. Reábrela para responder.</p>
          <Button size="sm" icon="rotate" disabled={reopen.isPending} onClick={() => reopen.mutate({ status: 'open' })}>
            Reabrir
          </Button>
        </div>
      ) : closedWindow ? (
        <div className={styles.warning} aria-live="polite">
          <Icon name="clock" size={18} />
          <p>
            <strong>Ventana de 24 h cerrada.</strong> Solo puedes enviar una plantilla aprobada.
          </p>
          <Button variant="warning" size="sm" icon="template" onClick={() => setDialog({ kind: 'template' })}>
            Elegir plantilla
          </Button>
        </div>
      ) : (
        <div className={styles.row}>
          {recorder.recording ? (
            <>
              <IconButton icon="trash" label="Descartar nota de voz" tip="top" onClick={recorder.cancel} />
              <div className={styles.recording}>
                <span className={styles.recDot} />
                <time>{formatDuration(recorder.seconds)}</time>
                <span>Grabando nota de voz</span>
              </div>
              <IconButton
                icon="send"
                label="Enviar nota de voz"
                tip="top"
                className={styles.sendButton}
                onClick={recorder.stop}
              />
            </>
          ) : (
            <>
              <div className={styles.anchor}>
                <IconButton
                  icon="smile"
                  label="Emojis"
                  tip="top"
                  size={22}
                  active={popover === 'emoji'}
                  onClick={() => setPopover(popover === 'emoji' ? null : 'emoji')}
                />
                {popover === 'emoji' && <EmojiPicker onPick={insertEmoji} onClose={() => setPopover(null)} />}
              </div>
              <div className={styles.anchor}>
                <IconButton
                  icon="plus"
                  label="Adjuntar"
                  tip="top"
                  size={22}
                  active={popover === 'attach'}
                  className={styles.attach}
                  data-open={popover === 'attach'}
                  onClick={() => setPopover(popover === 'attach' ? null : 'attach')}
                />
                {popover === 'attach' && <AttachMenu onPick={pickAttach} onClose={() => setPopover(null)} />}
              </div>
              <div className={styles.field}>
                <textarea
                  ref={textarea}
                  rows={1}
                  value={text}
                  placeholder="Escribe un mensaje"
                  aria-label="Mensaje"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  onPaste={(e) => {
                    const file = Array.from(e.clipboardData.files)[0]
                    if (file) {
                      e.preventDefault()
                      setDialog({ kind: 'upload', file })
                    }
                  }}
                />
              </div>
              {text.trim() ? (
                <IconButton
                  icon="send"
                  label="Enviar (Enter)"
                  tip="top"
                  className={styles.sendButton}
                  disabled={busy}
                  onClick={submit}
                />
              ) : (
                <IconButton
                  icon="mic"
                  label="Grabar nota de voz"
                  tip="top"
                  size={22}
                  disabled={busy}
                  onClick={() => void recorder.start()}
                />
              )}
            </>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) setDialog({ kind: 'upload', file })
        }}
      />

      {dialog?.kind === 'upload' && (
        <UploadPreview
          file={dialog.file}
          busy={busy}
          onCancel={() => setDialog(null)}
          onSend={(caption) =>
            void sendFile(dialog.file, caption).then(
              () => setDialog(null),
              () => undefined,
            )
          }
        />
      )}
      {dialog?.kind === 'builder' && (
        <Builder kind={dialog.builder} busy={busy} onClose={() => setDialog(null)} onSend={sendContent} />
      )}
      {dialog?.kind === 'template' && (
        <TemplatePicker busy={busy} onClose={() => setDialog(null)} onSend={sendContent} />
      )}
    </div>
  )
}
