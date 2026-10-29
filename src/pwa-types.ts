export type OfflineState = 'checking' | 'preparing' | 'ready' | 'unavailable' | 'error'

export interface WorkerReply {
  ok: boolean
  ready?: boolean
  version?: string
  /** The app version (content/changelog.json) this worker was built with. */
  appVersion?: string
  warning?: string
  error?: string
}

export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  const __APP_RELEASE__: string
  const __APP_VERSION__: string
  const __APP_DATE__: string
}
