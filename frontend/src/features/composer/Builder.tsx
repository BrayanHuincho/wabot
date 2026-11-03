import { useState, type ReactNode } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { limits } from '../../lib/limits'
import type { ListSection, MessageContent, ReplyButton } from '../../lib/types'
import { Bubble } from '../chat/bubble/Bubble'
import { doodleBackground } from '../chat/doodle'
import { previewMessage } from './preview'
import styles from './Builder.module.css'

export type BuilderKind = 'buttons' | 'list' | 'cta' | 'location'

const titles: Record<BuilderKind, string> = {
  buttons: 'Mensaje con botones',
  list: 'Mensaje con lista',
  cta: 'Mensaje con enlace',
  location: 'Enviar ubicación',
}

let seq = 0
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

function Field({
  label,
  value,
  onChange,
  max,
  required,
  multiline,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  max?: number
  required?: boolean
  multiline?: boolean
  placeholder?: string
  error?: string
}) {
  const over = max !== undefined && value.length > max
  const message = error ?? (over ? `Máximo ${max} caracteres` : undefined)
  const props = {
    value,
    placeholder,
    'aria-invalid': Boolean(message),
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  }
  return (
    <label className={styles.field}>
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      <small data-error={Boolean(message)}>
        {message ?? ''}
        {max !== undefined && (
          <b>
            {value.length}/{max}
          </b>
        )}
      </small>
    </label>
  )
}

function Rows({
  children,
  onAdd,
  addLabel,
  disabled,
}: {
  children: ReactNode
  onAdd: () => void
  addLabel: string
  disabled: boolean
}) {
  return (
    <div className={styles.group}>
      {children}
      <Button size="sm" variant="ghost" icon="plus" onClick={onAdd} disabled={disabled}>
        {addLabel}
      </Button>
    </div>
  )
}

function validate(kind: BuilderKind, c: MessageContent) {
  const errors: string[] = []
  const tooLong = (value: string | undefined, max: number) => (value ?? '').length > max
  if (kind !== 'location' && !c.body?.trim()) errors.push('Escribe el texto del mensaje.')
  if (tooLong(c.header, limits.header) || tooLong(c.footer, limits.footer))
    errors.push('Encabezado o pie demasiado largos.')
  if (kind === 'buttons') {
    const buttons = c.buttons ?? []
    if (!buttons.length || buttons.length > limits.buttons) errors.push('Agrega de 1 a 3 botones.')
    if (buttons.some((b) => !b.title.trim() || tooLong(b.title, limits.buttonTitle)))
      errors.push('Cada botón necesita un título de hasta 20 caracteres.')
    if (new Set(buttons.map((b) => b.title.trim().toLowerCase())).size !== buttons.length)
      errors.push('Los botones no pueden repetirse.')
  }
  if (kind === 'list') {
    const rows = (c.sections ?? []).flatMap((s) => s.rows)
    if (!c.list_button?.trim() || tooLong(c.list_button, limits.buttonTitle))
      errors.push('El botón de la lista necesita hasta 20 caracteres.')
    if (!rows.length || rows.length > limits.listRows) errors.push('La lista lleva de 1 a 10 filas en total.')
    if (
      rows.some(
        (r) => !r.title.trim() || tooLong(r.title, limits.rowTitle) || tooLong(r.description, limits.rowDescription),
      )
    )
      errors.push('Revisa los títulos (24) y descripciones (72) de las filas.')
    if ((c.sections ?? []).length > 1 && c.sections?.some((s) => !s.title.trim()))
      errors.push('Con varias secciones, cada una necesita título.')
  }
  if (kind === 'cta') {
    if (!/^https?:\/\/\S+\.\S+/.test(c.url ?? '')) errors.push('Escribe una URL válida que empiece con https://')
    if (!c.url_label?.trim() || tooLong(c.url_label, limits.ctaLabel))
      errors.push('El texto del botón necesita hasta 20 caracteres.')
  }
  if (kind === 'location') {
    const { latitude = NaN, longitude = NaN } = c.location ?? {}
    if (!(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180)) errors.push('Latitud o longitud no válidas.')
  }
  return errors
}

export function Builder({
  kind,
  busy,
  onClose,
  onSend,
}: {
  kind: BuilderKind
  busy: boolean
  onClose: () => void
  onSend: (content: MessageContent) => void
}) {
  const [header, setHeader] = useState('')
  const [body, setBody] = useState('')
  const [footer, setFooter] = useState('')
  const [buttons, setButtons] = useState<ReplyButton[]>([{ id: uid('btn'), title: '' }])
  const [listButton, setListButton] = useState('Ver opciones')
  const [sections, setSections] = useState<ListSection[]>([
    { title: '', rows: [{ id: uid('row'), title: '', description: '' }] },
  ])
  const [url, setUrl] = useState('https://')
  const [urlLabel, setUrlLabel] = useState('')
  const [lat, setLat] = useState('-12.0464')
  const [lng, setLng] = useState('-77.0428')
  const [placeName, setPlaceName] = useState('')
  const [address, setAddress] = useState('')
  const [touched, setTouched] = useState(false)

  const optional = (value: string) => value.trim() || undefined
  const shared = { header: optional(header), body: body.trim(), footer: optional(footer) }
  const content: MessageContent =
    kind === 'buttons'
      ? { type: 'buttons', ...shared, buttons: buttons.map((b) => ({ ...b, title: b.title.trim() })) }
      : kind === 'list'
        ? {
            type: 'list',
            ...shared,
            list_button: listButton.trim(),
            sections: sections.map((s) => ({
              title: s.title.trim(),
              rows: s.rows.map((r) => ({
                id: r.id,
                title: r.title.trim(),
                description: optional(r.description ?? ''),
              })),
            })),
          }
        : kind === 'cta'
          ? { type: 'cta_url', ...shared, url: url.trim(), url_label: urlLabel.trim() }
          : {
              type: 'location',
              location: {
                latitude: Number(lat),
                longitude: Number(lng),
                name: optional(placeName),
                address: optional(address),
              },
            }
  const errors = validate(kind, content)
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0)

  const updateSection = (index: number, patch: Partial<ListSection>) =>
    setSections((all) => all.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  return (
    <Modal
      wide
      title={titles[kind]}
      onClose={onClose}
      footer={
        <>
          {touched && errors[0] && <span className={styles.footerError}>{errors[0]}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="send"
            disabled={busy}
            onClick={() => {
              setTouched(true)
              if (!errors.length) onSend(content)
            }}
          >
            {busy ? 'Enviando…' : 'Enviar'}
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.form}>
          {kind === 'location' ? (
            <>
              <div className={styles.pair}>
                <Field label="Latitud" value={lat} onChange={setLat} required />
                <Field label="Longitud" value={lng} onChange={setLng} required />
              </div>
              <Field
                label="Nombre del lugar"
                value={placeName}
                onChange={setPlaceName}
                placeholder="Oficina principal"
              />
              <Field label="Dirección" value={address} onChange={setAddress} placeholder="Av. Larco 123, Miraflores" />
            </>
          ) : (
            <>
              <Field label="Encabezado" value={header} onChange={setHeader} max={limits.header} />
              <Field
                label="Mensaje"
                value={body}
                onChange={setBody}
                max={limits.text}
                required
                multiline
                error={touched && !body.trim() ? 'Obligatorio' : undefined}
              />
              <Field label="Pie" value={footer} onChange={setFooter} max={limits.footer} />
            </>
          )}

          {kind === 'buttons' && (
            <Rows
              addLabel="Agregar botón"
              disabled={buttons.length >= limits.buttons}
              onAdd={() => setButtons((b) => [...b, { id: uid('btn'), title: '' }])}
            >
              <h4>
                Botones ({buttons.length}/{limits.buttons})
              </h4>
              {buttons.map((button, i) => (
                <div key={button.id} className={styles.line}>
                  <Field
                    label={`Botón ${i + 1}`}
                    value={button.title}
                    max={limits.buttonTitle}
                    onChange={(title) =>
                      setButtons((all) => all.map((b) => (b.id === button.id ? { ...b, title } : b)))
                    }
                  />
                  <IconButton
                    icon="trash"
                    label="Quitar botón"
                    disabled={buttons.length === 1}
                    onClick={() => setButtons((all) => all.filter((b) => b.id !== button.id))}
                  />
                </div>
              ))}
            </Rows>
          )}

          {kind === 'list' && (
            <>
              <Field
                label="Texto del botón de la lista"
                value={listButton}
                onChange={setListButton}
                max={limits.buttonTitle}
                required
              />
              <h4 className={styles.counter}>
                Filas {totalRows}/{limits.listRows}
              </h4>
              {sections.map((section, s) => (
                <Rows
                  key={s}
                  addLabel="Agregar fila"
                  disabled={totalRows >= limits.listRows}
                  onAdd={() =>
                    updateSection(s, { rows: [...section.rows, { id: uid('row'), title: '', description: '' }] })
                  }
                >
                  <div className={styles.line}>
                    <Field
                      label={`Sección ${s + 1}`}
                      value={section.title}
                      onChange={(title) => updateSection(s, { title })}
                      max={limits.rowTitle}
                    />
                    <IconButton
                      icon="trash"
                      label="Quitar sección"
                      disabled={sections.length === 1}
                      onClick={() => setSections((all) => all.filter((_, i) => i !== s))}
                    />
                  </div>
                  {section.rows.map((row) => (
                    <div key={row.id} className={styles.rowEditor}>
                      <Field
                        label="Título"
                        value={row.title}
                        max={limits.rowTitle}
                        onChange={(title) =>
                          updateSection(s, { rows: section.rows.map((r) => (r.id === row.id ? { ...r, title } : r)) })
                        }
                      />
                      <Field
                        label="Descripción"
                        value={row.description ?? ''}
                        max={limits.rowDescription}
                        onChange={(description) =>
                          updateSection(s, {
                            rows: section.rows.map((r) => (r.id === row.id ? { ...r, description } : r)),
                          })
                        }
                      />
                      <IconButton
                        icon="trash"
                        label="Quitar fila"
                        disabled={section.rows.length === 1}
                        onClick={() => updateSection(s, { rows: section.rows.filter((r) => r.id !== row.id) })}
                      />
                    </div>
                  ))}
                </Rows>
              ))}
              <Button
                size="sm"
                icon="plus"
                disabled={totalRows >= limits.listRows}
                onClick={() =>
                  setSections((all) => [...all, { title: '', rows: [{ id: uid('row'), title: '', description: '' }] }])
                }
              >
                Agregar sección
              </Button>
            </>
          )}

          {kind === 'cta' && (
            <>
              <Field label="URL" value={url} onChange={setUrl} required placeholder="https://tuweb.pe/catalogo" />
              <Field
                label="Texto del botón"
                value={urlLabel}
                onChange={setUrlLabel}
                max={limits.ctaLabel}
                required
                placeholder="Ver catálogo"
              />
            </>
          )}
        </div>

        <div className={styles.preview} style={{ backgroundImage: doodleBackground }}>
          <span className={styles.previewLabel}>Vista previa</span>
          <Bubble
            message={previewMessage({ ...content, body: content.body || 'Tu mensaje aparecerá aquí' })}
            mine
            first
          />
        </div>
      </div>
    </Modal>
  )
}
