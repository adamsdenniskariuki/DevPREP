import { useEffect, useRef, useState } from 'react'
import { workerRequest } from './pwa-client'
import type { InstallPromptEvent, OfflineState } from './pwa-types'

const CHECK_INTERVAL = 5 * 60_000
const RESUME_THROTTLE = 60_000

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The browser could not prepare the app.'
}

export function usePwa(beforeReload: () => boolean) {
  const [offline, setOffline] = useState<OfflineState>('checking')
  const [online, setOnline] = useState(navigator.onLine)
  const [warning, setWarning] = useState('')
  const [version, setVersion] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installMessage, setInstallMessage] = useState('')
  const [standalone, setStandalone] = useState(() => matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true))
  const [installed, setInstalled] = useState(false)
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const accepting = useRef(false)
  const reloadPending = useRef(false)
  const installedSignal = useRef(false)
  const activationTimer = useRef<number | undefined>(undefined)
  const canReload = useRef(beforeReload)
  const check = useRef<(force?: boolean) => Promise<void>>(async () => {})
  const prepare = useRef<() => Promise<void>>(async () => {})
  canReload.current = beforeReload

  useEffect(() => {
    let disposed = false
    let lastCheck = 0
    let checking = false
    const watched = new WeakSet<ServiceWorker>()
    let hadController = !!navigator.serviceWorker?.controller
    const listeners: Array<() => void> = []
    const mode = matchMedia('(display-mode: standalone)')
    const script = new URL('sw.js', location.href)
    const scope = new URL('./', location.href).href
    const supported = import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext

    const status = async () => {
      const worker = registration.current?.active ?? navigator.serviceWorker?.controller
      if (!worker) return
      try {
        const reply = await workerRequest(worker, 'PWA_STATUS')
        if (disposed) return
        setOffline(reply.ready ? 'ready' : 'error')
        setVersion(reply.version ?? '')
        if (!reply.ready) setWarning('The offline cache is incomplete. Connect to the internet and prepare the lessons again.')
        else if (reply.warning) setWarning(reply.warning)
        else if (!reloadPending.current) setWarning('')
      } catch (error) {
        if (!disposed) {
          setOffline('error')
          setWarning(message(error))
        }
      }
    }

    const watch = (worker: ServiceWorker | null) => {
      if (!worker || watched.has(worker)) return
      watched.add(worker)
      const changed = () => {
        if (disposed) return
        if (worker.state === 'installed' && registration.current?.waiting && hadController) setUpdateReady(true)
        if (worker.state === 'activated') void status()
        if (worker.state === 'redundant') {
          if (!registration.current?.active) setOffline('error')
          setWarning('Offline preparation or update failed. The current version is kept; reconnect and try again.')
        }
      }
      worker.addEventListener('statechange', changed)
      listeners.push(() => worker.removeEventListener('statechange', changed))
      changed()
    }

    const attach = (reg: ServiceWorkerRegistration) => {
      registration.current = reg
      setUpdateReady((!!reg.waiting && !!reg.active) || reloadPending.current)
      const found = () => watch(reg.installing)
      reg.addEventListener('updatefound', found)
      listeners.push(() => reg.removeEventListener('updatefound', found))
      watch(reg.installing)
      if (reg.active) void status()
      else setOffline('preparing')
    }

    const start = async () => {
      try {
        const reg = await navigator.serviceWorker.register(script.href, { scope, updateViaCache: 'none' })
        if (disposed) return
        attach(reg)
      } catch (error) {
        if (!disposed) {
          setOffline('error')
          setWarning(`Offline preparation could not start. ${message(error)}`)
        }
      }
    }

    check.current = async (force = false) => {
      if (!supported || disposed || !navigator.onLine || checking || (!force && Date.now() - lastCheck < RESUME_THROTTLE)) return
      checking = true
      lastCheck = Date.now()
      try {
        if (!registration.current) await start()
        else await registration.current.update()
        if (!disposed) {
          setUpdateReady((!!registration.current?.waiting && !!registration.current?.active) || reloadPending.current)
          await status()
        }
      } catch (error) {
        if (!disposed) setWarning(`Could not check for an update. The current version is unchanged. ${message(error)}`)
      } finally { checking = false }
    }

    prepare.current = async () => {
      if (!supported) return
      if (!navigator.onLine) {
        setWarning('Connect to the internet to prepare or repair offline lessons. Previously prepared lessons can still be used.')
        return
      }
      setWarning('')
      setOffline('preparing')
      try {
        const worker = registration.current?.active
        if (worker) {
          const reply = await workerRequest(worker, 'PREPARE_OFFLINE')
          if (!disposed) {
            setOffline(reply.ready ? 'ready' : 'error')
            setVersion(reply.version ?? '')
            if (reply.warning) setWarning(reply.warning)
          }
        } else {
          await start()
          await registration.current?.update()
        }
      } catch (error) {
        if (!disposed) {
          setOffline('error')
          setWarning(message(error))
          void check.current(true)
        }
      }
    }

    const controllerChanged = () => {
      if (disposed) return
      if (accepting.current) {
        window.clearTimeout(activationTimer.current)
        accepting.current = false
        setUpdating(false)
        if (canReload.current()) {
          location.reload()
          return
        }
        setWarning('The update activated, but reload was paused because saving is blocked. Resolve storage warnings or export your work before restarting.')
        reloadPending.current = true
        setUpdateReady(true)
      } else if (hadController) {
        reloadPending.current = true
        setUpdateReady(true)
      }
      hadController = true
      void status()
    }
    const workerMessage = (event: MessageEvent) => {
      const source = event.source
      if (!source || !('scriptURL' in source) || source.scriptURL !== script.href) return
      const data: unknown = event.data
      if (data && typeof data === 'object' && 'type' in data && data.type === 'DEVPREP_PREPARE_FAILED') {
        if (!registration.current?.active) setOffline('error')
        setWarning('error' in data && typeof data.error === 'string' ? data.error : 'Offline preparation failed. Reconnect and try again.')
      }
    }
    const network = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void check.current(true)
    }
    const visible = () => { if (document.visibilityState === 'visible') void check.current() }
    const prompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
      setInstallMessage('')
    }
    const appInstalled = () => { installedSignal.current = true; setInstalled(true); setInstallPrompt(null); setInstallMessage('The browser reported that installation completed.') }
    const displayMode = () => setStandalone(mode.matches || ('standalone' in navigator && navigator.standalone === true))
    window.addEventListener('beforeinstallprompt', prompt)
    window.addEventListener('appinstalled', appInstalled)
    mode.addEventListener('change', displayMode)
    window.addEventListener('online', network)
    window.addEventListener('offline', network)
    document.addEventListener('visibilitychange', visible)
    let timer: number | undefined
    if (!supported) {
      setOffline('unavailable')
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
      navigator.serviceWorker.addEventListener('message', workerMessage)
      void (async () => {
        try {
          const existing = await navigator.serviceWorker.getRegistration(scope)
          if (disposed) return
          if (existing?.scope === scope) attach(existing)
          if (navigator.onLine) await check.current(true)
          else if (!existing || existing.scope !== scope || !existing.active) {
            setOffline('error')
            setWarning('First-time offline preparation requires an internet connection.')
          }
        } catch (error) {
          if (!disposed) {
            setOffline('error')
            setWarning(`Offline status could not be read. ${message(error)}`)
          }
        }
      })()
      timer = window.setInterval(() => { if (document.visibilityState === 'visible') void check.current() }, CHECK_INTERVAL)
    }
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.clearTimeout(activationTimer.current)
      for (const remove of listeners) remove()
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged)
      navigator.serviceWorker?.removeEventListener('message', workerMessage)
      window.removeEventListener('beforeinstallprompt', prompt)
      window.removeEventListener('appinstalled', appInstalled)
      mode.removeEventListener('change', displayMode)
      window.removeEventListener('online', network)
      window.removeEventListener('offline', network)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    setInstallPrompt(null)
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (!installedSignal.current) setInstallMessage(choice.outcome === 'accepted' ? 'Installation requested. Your browser will confirm completion.' : 'Installation dismissed. You can keep using DevPREP in this browser.')
    } catch (error) {
      setInstallMessage(`The install prompt could not be opened. ${message(error)} Use your browser’s install or Share menu instead.`)
    }
  }

  async function update() {
    if (!canReload.current()) {
      setWarning('Reload is blocked until storage warnings are resolved. Export your work before any manual restart.')
      return
    }
    const waiting = registration.current?.waiting
    if (!waiting) { location.reload(); return }
    setUpdating(true)
    accepting.current = true
    activationTimer.current = window.setTimeout(() => {
      accepting.current = false
      setUpdating(false)
      setWarning('The update has not activated yet. Keep using this version and try again when the browser is ready.')
    }, 15_000)
    try {
      await workerRequest(waiting, 'ACTIVATE_UPDATE')
    } catch (error) {
      window.clearTimeout(activationTimer.current)
      accepting.current = false
      setUpdating(false)
      setWarning(message(error))
    }
  }

  return {
    offline, online, warning, version, updateReady, updating, standalone, installed,
    canInstall: !!installPrompt && !standalone && !installed, installMessage, install, update,
    prepare: () => prepare.current(), check: () => check.current(true),
  }
}
