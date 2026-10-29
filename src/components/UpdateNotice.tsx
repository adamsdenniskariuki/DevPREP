import { useEffect, useState } from 'react'
import type { usePwa } from '../usePwa'

/** Remembers which downloaded build's notice was dismissed, so a dismissed notice stays quiet across reloads and windows. */
const NOTICE_KEY = 'devprep.update-notice.v1'

function wasDismissed(id: string) {
  try { return !!id && localStorage.getItem(NOTICE_KEY) === id } catch { return false }
}

export default function UpdateNotice({ pwa, reloadBlocked }: { pwa: ReturnType<typeof usePwa>; reloadBlocked: boolean }) {
  const id = pwa.waitingBuild || pwa.waitingVersion
  const [dismissed, setDismissed] = useState('')
  useEffect(() => { if (pwa.updatedElsewhere) setDismissed('') }, [pwa.updatedElsewhere])
  if (!pwa.updateReady) return null
  if (pwa.updatedElsewhere ? dismissed === 'elsewhere' : (!id || dismissed === id || wasDismissed(id))) return null
  const dismiss = () => {
    if (pwa.updatedElsewhere) return setDismissed('elsewhere')
    setDismissed(id)
    try { localStorage.setItem(NOTICE_KEY, id) } catch { /* Without storage the notice may return after a reload; that is harmless. */ }
  }
  return <div className="notice update-notice" role="status">
    <span>{pwa.updatedElsewhere
      ? 'DevPREP updated in another window. Relaunch to finish updating.'
      : `Update downloaded${pwa.waitingVersion ? ` (version ${pwa.waitingVersion})` : ''}. It applies next time you open DevPREP.`}</span>
    <span className="update-notice-actions">
      <button className="text-button" disabled={reloadBlocked || pwa.updating} onClick={() => { void pwa.relaunch() }}>{pwa.updating ? 'Relaunching…' : 'Relaunch now'}</button>
      <button className="text-button" aria-label="Dismiss update notice" onClick={dismiss}>Dismiss</button>
    </span>
  </div>
}
