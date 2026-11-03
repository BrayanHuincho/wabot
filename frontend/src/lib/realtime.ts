import { apiKey, apiUrl, mockMode } from './config'
import type { RealtimeEvent } from './types'

type Listener = (event: RealtimeEvent) => void
export type ConnectionState = 'connecting' | 'online' | 'offline'

const listeners = new Set<Listener>()
const stateListeners = new Set<(state: ConnectionState) => void>()
let state: ConnectionState = 'connecting'
let socket: WebSocket | null = null
let attempts = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let started = false

function setState(next: ConnectionState) {
  state = next
  stateListeners.forEach((fn) => fn(next))
}

export function emit(event: RealtimeEvent) {
  listeners.forEach((fn) => fn(event))
}

function socketUrl() {
  const url = new URL(`${apiUrl}/api/v1/ws`)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (apiKey) url.searchParams.set('key', apiKey)
  return url.toString()
}

function scheduleReconnect() {
  const delay = Math.min(30_000, 1000 * 2 ** attempts) * (0.75 + Math.random() * 0.5)
  attempts += 1
  retryTimer = setTimeout(connect, delay)
}

function connect() {
  setState('connecting')
  socket = new WebSocket(socketUrl())
  socket.onopen = () => {
    attempts = 0
    setState('online')
  }
  socket.onmessage = (msg: MessageEvent<string>) => {
    try {
      emit(JSON.parse(msg.data) as RealtimeEvent)
    } catch {
      return
    }
  }
  socket.onclose = () => {
    socket = null
    setState('offline')
    scheduleReconnect()
  }
}

export function startRealtime() {
  if (started) return
  started = true
  if (mockMode) {
    setState('online')
    return
  }
  connect()
  window.addEventListener('online', () => {
    if (socket) return
    clearTimeout(retryTimer)
    attempts = 0
    connect()
  })
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export function subscribeState(fn: (state: ConnectionState) => void) {
  stateListeners.add(fn)
  fn(state)
  return () => void stateListeners.delete(fn)
}
