import { useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { useTemplates } from '../../lib/queries'
import type { MessageContent, Template } from '../../lib/types'
import { Bubble } from '../chat/bubble/Bubble'
import { doodleBackground } from '../chat/doodle'
import { previewMessage } from '../composer/preview'
import styles from './TemplatePicker.module.css'

function fill(body: string, values: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n: string) => values[Number(n) - 1] || match)
}

interface TemplatePickerProps {
  busy: boolean
  onClose: () => void
  onSend: (content: MessageContent) => void
}

export function TemplatePicker({ busy, onClose, onSend }: TemplatePickerProps) {
  const { data, isPending, isError } = useTemplates(true)
  const [selected, setSelected] = useState<Template | null>(null)
  const [values, setValues] = useState<string[]>([])
  const missing = selected ? selected.params.some((_, i) => !values[i]?.trim()) : true

  const choose = (template: Template) => {
    setSelected(template)
    setValues(template.params.map(() => ''))
  }

  return (
    <Modal
      wide
      title="Elegir plantilla"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon="send"
            disabled={!selected || missing || busy}
            onClick={() =>
              selected && onSend({ type: 'template', template: selected.name, params: values.map((v) => v.trim()) })
            }
          >
            {busy ? 'Enviando…' : 'Enviar plantilla'}
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.list} role="listbox" aria-label="Plantillas aprobadas">
          {isPending &&
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.item}>
                <Skeleton width="50%" />
                <Skeleton width="90%" height={10} />
              </div>
            ))}
          {isError && <p className={styles.note}>No se pudieron cargar las plantillas.</p>}
          {data?.length === 0 && (
            <p className={styles.note}>No hay plantillas configuradas en config/templates.json.</p>
          )}
          {data?.map((template) => (
            <button
              key={template.name}
              type="button"
              role="option"
              aria-selected={selected?.name === template.name}
              className={styles.item}
              onClick={() => choose(template)}
            >
              <strong>
                <Icon name="template" size={14} /> {template.name}
              </strong>
              <span>{template.body}</span>
            </button>
          ))}
        </div>

        <div className={styles.detail}>
          {selected ? (
            <>
              {selected.params.length > 0 && (
                <div className={styles.params}>
                  {selected.params.map((param, i) => (
                    <label key={`${param}-${i}`}>
                      <span>
                        {`{{${i + 1}}}`} · {param}
                      </span>
                      <input
                        value={values[i] ?? ''}
                        autoFocus={i === 0}
                        onChange={(e) => setValues((all) => all.map((v, j) => (j === i ? e.target.value : v)))}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className={styles.preview} style={{ backgroundImage: doodleBackground }}>
                <Bubble
                  mine
                  first
                  message={previewMessage({
                    type: 'template',
                    template: selected.name,
                    body: fill(selected.body, values),
                    buttons: selected.buttons.map((title, i) => ({ id: `b${i}`, title })),
                  })}
                />
              </div>
            </>
          ) : (
            <p className={styles.note}>Elige una plantilla para completar sus variables y ver cómo llegará.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
