export type OfflineState = 'checking' | 'preparing' | 'ready' | 'unavailable' | 'error'

export interface WorkerReply {
  ok: boolean
  ready?: boolean
  version?: string
  warning?: string
  error?: string
}

export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  const __APP_RELEASE__: string
}
