import type { WorkerReply } from './pwa-types'

export function appAssets() {
  return Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"], link[rel="modulepreload"]'))
    .map(element => 'src' in element ? element.src : element.href)
    .filter(url => new URL(url).origin === location.origin)
}

export function workerRequest(worker: ServiceWorker, type: 'PWA_STATUS' | 'PREPARE_OFFLINE' | 'ACTIVATE_UPDATE'): Promise<WorkerReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const finish = () => { clearTimeout(timer); channel.port1.close() }
    const timer = setTimeout(() => { finish(); reject(new Error('The offline worker did not respond. Reconnect and try again.')) }, type === 'PREPARE_OFFLINE' ? 30_000 : 8_000)
    channel.port1.onmessage = event => {
      finish()
      const data: unknown = event.data
      if (!data || typeof data !== 'object' || !('ok' in data) || typeof data.ok !== 'boolean') {
        reject(new Error('The offline worker returned an invalid response.'))
        return
      }
      if (data.ok && type !== 'ACTIVATE_UPDATE' && (!('ready' in data) || typeof data.ready !== 'boolean' || !('version' in data) || typeof data.version !== 'string')) {
        reject(new Error('The offline worker returned an incomplete status.'))
        return
      }
      const reply = data as WorkerReply
      if (!reply.ok) reject(new Error(reply.error ?? 'Offline preparation failed.'))
      else resolve(reply)
    }
    try { worker.postMessage({ type, assets: appAssets() }, [channel.port2]) } catch (error) { finish(); reject(error) }
  })
}
