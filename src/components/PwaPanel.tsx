import type { usePwa } from '../usePwa'

export default function PwaPanel({ pwa, reloadBlocked }: {
  pwa: ReturnType<typeof usePwa>
  reloadBlocked: boolean
}) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const status = pwa.offline === 'ready' ? 'Offline lessons ready'
    : pwa.offline === 'preparing' || pwa.offline === 'checking' ? 'Preparing offline lessons'
      : pwa.offline === 'unavailable' ? 'Offline unavailable here' : 'Offline not ready'
  return <section className="pwa-section" aria-label="App installation and offline status">
    <details className="pwa-panel">
      <summary><span>App & offline</span><span className="pwa-status" aria-live="polite">{status}</span>{pwa.updateReady && <span className="pwa-update" aria-live="polite">Update ready</span>}</summary>
      <p>{pwa.standalone ? 'Running as an installed app.' : pwa.installed ? 'The browser reported this app installed.' : 'Install DevPREP for a standalone window (optional).'}</p>
      {pwa.canInstall && <button className="primary" onClick={() => { void pwa.install() }}>Install DevPREP</button>}
      {!pwa.standalone && !pwa.installed && <p className="helper">{isIOS
        ? 'On iPhone or iPad: open this site in Safari, tap Share, then Add to Home Screen.'
        : 'Look for Install app or Add to Home screen in your browser menu.'}</p>}
      {pwa.installMessage && <p aria-live="polite">{pwa.installMessage}</p>}
      <h3>Offline</h3>
      <p>{pwa.offline === 'ready'
        ? 'Every lesson works offline in this browser.'
        : pwa.offline === 'unavailable'
          ? 'Offline needs a supported browser over HTTPS.'
          : 'Needs one online visit to prepare. Keep this page open.'}</p>
      <div className="button-row">
        {pwa.offline !== 'unavailable' && pwa.offline !== 'ready' && <button disabled={pwa.offline === 'preparing' || pwa.offline === 'checking'} onClick={() => { void pwa.prepare() }}>{pwa.offline === 'error' ? 'Retry offline preparation' : 'Prepare offline lessons'}</button>}
        {pwa.offline !== 'unavailable' && <button disabled={!pwa.online || pwa.updating} onClick={() => { void pwa.check() }}>Check for updates</button>}
        {pwa.updateReady && <button className="primary" disabled={reloadBlocked || pwa.updating} onClick={() => { void pwa.update() }}>{pwa.updating ? 'Applying update' : 'Update & reload'}</button>}
      </div>
      {pwa.updateReady && <p className="helper">{reloadBlocked ? 'Save or export your work and resolve storage warnings before updating.' : 'Reload when you’re ready; your progress resumes.'}</p>}
      <p className="pwa-build">Build: {__APP_RELEASE__}{pwa.version ? ` · Offline version: ${pwa.version}` : ''}{!pwa.online ? ' · Offline connection' : ''}</p>
    </details>
    {pwa.warning && <p className="pwa-warning" role="alert">{pwa.warning}</p>}
  </section>
}
