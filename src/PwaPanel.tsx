import { usePwa } from './usePwa'

export default function PwaPanel({ beforeReload, reloadBlocked }: {
  beforeReload: () => boolean
  reloadBlocked: boolean
}) {
  const pwa = usePwa(beforeReload)
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const status = pwa.offline === 'ready' ? 'Offline lessons ready'
    : pwa.offline === 'preparing' || pwa.offline === 'checking' ? 'Preparing offline lessons'
      : pwa.offline === 'unavailable' ? 'Offline unavailable here' : 'Offline not ready'
  return <section className="pwa-section" aria-label="App installation and offline status">
    <details className="pwa-panel">
      <summary><span>App & offline</span><span className="pwa-status" aria-live="polite">{status}</span>{pwa.updateReady && <span className="pwa-update" aria-live="polite">Update ready</span>}</summary>
      <p>{pwa.standalone ? 'Running as an installed app.' : pwa.installed ? 'The browser reported this app installed.' : 'Use DevPREP in your browser, or install it for a standalone window. Installation is optional and remains a browser/OS action.'}</p>
      {pwa.canInstall && <button className="primary" onClick={() => { void pwa.install() }}>Install DevPREP</button>}
      {!pwa.standalone && !pwa.installed && <p className="helper">{isIOS
        ? 'On iPhone or iPad: open this site in Safari, tap Share, then Add to Home Screen. If the option is unavailable, check your browser/OS support or keep using the website.'
        : 'Chrome/Edge on desktop and supported Android browsers may offer an install icon or Install app / Add to Home screen in their menu. If no option is available, keep using the website or a bookmark; an install prompt cannot be forced.'}</p>}
      {pwa.installMessage && <p aria-live="polite">{pwa.installMessage}</p>}
      <h3>Offline library</h3>
      <p>{pwa.offline === 'ready'
        ? 'All bundled lessons and required app files are prepared in this browser. You can reopen the app, navigate every track, and edit local study work offline.'
        : pwa.offline === 'unavailable'
          ? 'Offline installation needs a supported browser, HTTPS (or localhost), and the production build. Keep using the online lessons here.'
          : 'The first successful preparation requires internet and enough browser storage. Keep this page open until offline lessons are ready.'}</p>
      <div className="button-row">
        {pwa.offline !== 'unavailable' && pwa.offline !== 'ready' && <button disabled={pwa.offline === 'preparing' || pwa.offline === 'checking'} onClick={() => { void pwa.prepare() }}>{pwa.offline === 'error' ? 'Retry offline preparation' : 'Prepare offline lessons'}</button>}
        {pwa.offline !== 'unavailable' && <button disabled={!pwa.online || pwa.updating} onClick={() => { void pwa.check() }}>Check for updates</button>}
        {pwa.updateReady && <button className="primary" disabled={reloadBlocked || pwa.updating} onClick={() => { void pwa.update() }}>{pwa.updating ? 'Applying update' : 'Update & reload'}</button>}
      </div>
      {pwa.updateReady && <p className="helper">{reloadBlocked ? 'Save or export your work and resolve storage warnings before updating. No automatic reload will discard it.' : 'An update is prepared. Reload when you choose; your saved notebook and progress will resume.'}</p>}
      <p className="helper">After a successful deployment, updates are checked on online launch, return to the app, reconnection, and about every five minutes while visible. New files download automatically; open sessions are not forcibly reloaded. When all old app windows close, the browser can activate the prepared version for the next launch. Closed/offline apps cannot be promised background updates, and failed deployments do not publish updates.</p>
      <p className="helper">Browser storage can be evicted or cleared. Export backups regularly. Installed/browser storage may differ, especially on iOS; if your progress is missing, explicitly import a backup rather than assuming automatic sync. Offline export/import still depends on your browser’s file support.</p>
      <p className="pwa-build">Build: {__APP_RELEASE__}{pwa.version ? ` · Offline version: ${pwa.version}` : ''}{!pwa.online ? ' · Offline connection' : ''}</p>
    </details>
    {pwa.warning && <p className="pwa-warning" role="alert">{pwa.warning}</p>}
  </section>
}
