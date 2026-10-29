import type { usePwa } from '../usePwa'

export default function PwaPanel({ pwa, reloadBlocked, recovery = false }: {
  pwa: ReturnType<typeof usePwa>
  reloadBlocked: boolean
  /** Saved progress needs repair: offer no relaunch until it is resolved. */
  recovery?: boolean
}) {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const status = pwa.offline === 'ready' ? 'Offline lessons ready'
    : pwa.offline === 'preparing' || pwa.offline === 'checking' ? 'Preparing offline lessons'
      : pwa.offline === 'unavailable' ? 'Offline unavailable here' : 'Offline not ready'
  return <section className="pwa-section" aria-label="App installation and offline status">
    <details className="pwa-panel">
      <summary><span>App & offline</span><span className="pwa-status" aria-live="polite">{status}</span>{pwa.updateReady && <span className="pwa-update" aria-live="polite"><span className="pwa-dot" aria-hidden="true" />{pwa.updatedElsewhere ? 'Relaunch to finish updating' : 'Update downloaded'}</span>}</summary>
      <p>{pwa.standalone ? 'Running as an installed app.' : pwa.installed ? 'The browser reported this app installed.' : 'Install DevPREP for a standalone window (optional).'}</p>
      {pwa.canInstall && <button className="primary" onClick={() => { void pwa.install() }}>Install DevPREP</button>}
      {!pwa.standalone && !pwa.installed && <p className="helper">{isIOS
        ? 'On iPhone or iPad: open this site in Safari, tap Share, then Add to Home Screen.'
        : 'Look for Install app or Add to Home screen in your browser menu.'}</p>}
      {pwa.installMessage && <p aria-live="polite">{pwa.installMessage}</p>}
      <h3>Version</h3>
      <p className="pwa-version">Version {__APP_VERSION__} · {__APP_DATE__} · <a href="#changelog">What’s new</a></p>
      {pwa.updateReady && <p className="pwa-downloaded">{pwa.updatedElsewhere
        ? 'DevPREP updated in another window. Relaunch to finish updating; this window keeps working until then.'
        : `Update downloaded: ${pwa.waitingVersion ? `version ${pwa.waitingVersion}` : 'a new version'}. It applies next time you open DevPREP.`}</p>}
      <h3>Offline</h3>
      <p>{pwa.offline === 'ready'
        ? 'Every lesson works offline in this browser.'
        : pwa.offline === 'unavailable'
          ? 'Offline needs a supported browser over HTTPS.'
          : 'Needs one online visit to prepare. Keep this page open.'}</p>
      <div className="button-row">
        {pwa.offline !== 'unavailable' && pwa.offline !== 'ready' && <button disabled={pwa.offline === 'preparing' || pwa.offline === 'checking'} onClick={() => { void pwa.prepare() }}>{pwa.offline === 'error' ? 'Retry offline preparation' : 'Prepare offline lessons'}</button>}
        {pwa.offline !== 'unavailable' && <button disabled={!pwa.online || pwa.updating} onClick={() => { void pwa.check() }}>Check for updates</button>}
        {pwa.offline !== 'unavailable' && !recovery && <button className={pwa.updateReady ? 'primary' : undefined} disabled={reloadBlocked || pwa.updating} onClick={() => { void pwa.relaunch() }}>{pwa.updating ? 'Relaunching…' : 'Relaunch now'}</button>}
      </div>
      {pwa.offline !== 'unavailable' && !recovery && <p className="helper">{reloadBlocked ? 'Save or export your work and resolve storage warnings before relaunching.' : pwa.updateReady ? 'Relaunch now saves your work first and returns you to this page.' : 'Relaunch now saves your work first and reopens this page.'}</p>}
      <p className="pwa-build">Build: {__APP_RELEASE__}{pwa.version ? ` · Offline version: ${pwa.version}` : ''}{!pwa.online ? ' · Offline connection' : ''}</p>
    </details>
    {pwa.warning && <p className="pwa-warning" role="alert">{pwa.warning}</p>}
  </section>
}
