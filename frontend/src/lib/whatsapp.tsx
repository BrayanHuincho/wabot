import type { ReactNode } from 'react'

const pattern = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, term: string, key: string): ReactNode[] {
  if (!term) return [text]
  return text
    .split(new RegExp(`(${escapeRegExp(term)})`, 'gi'))
    .map((part, i) => (i % 2 ? <mark key={`${key}-${i}`}>{part}</mark> : part))
}

export function formatWhatsApp(text: string, term = '', prefix = 'f'): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    const key = `${prefix}-${index++}`
    if (start > last) nodes.push(...highlight(text.slice(last, start), term, `${key}t`))
    const [whole, mono, bold, italic, strike, url] = match
    if (mono !== undefined) nodes.push(<code key={key}>{highlight(mono, term, key)}</code>)
    else if (bold !== undefined) nodes.push(<strong key={key}>{formatWhatsApp(bold, term, key)}</strong>)
    else if (italic !== undefined) nodes.push(<em key={key}>{formatWhatsApp(italic, term, key)}</em>)
    else if (strike !== undefined) nodes.push(<s key={key}>{formatWhatsApp(strike, term, key)}</s>)
    else if (url !== undefined)
      nodes.push(
        <a key={key} href={url} target="_blank" rel="noreferrer noopener">
          {highlight(url, term, key)}
        </a>,
      )
    last = start + whole.length
  }
  if (last < text.length) nodes.push(...highlight(text.slice(last), term, `${prefix}-end`))
  return nodes
}

export function stripWhatsApp(text: string) {
  return text.replace(/```|[*_~]/g, '')
}
