import { Toasts } from '../components/Toasts'
import { ChatPanel } from '../features/chat/ChatPanel'
import { ConversationList } from '../features/inbox/ConversationList'
import { Simulator } from '../features/simulator/Simulator'
import { usePanel } from './store'
import { useRealtime } from './useRealtime'
import styles from './App.module.css'

export function App() {
  useRealtime()
  const selectedId = usePanel((s) => s.selectedId)

  return (
    <div className={styles.shell} data-simulator data-chat={Boolean(selectedId)}>
      <ConversationList />
      <ChatPanel />
      <Simulator />
      <Toasts />
    </div>
  )
}
