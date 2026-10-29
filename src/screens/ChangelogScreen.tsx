import { useEffect, useMemo, useState } from 'react'
import type { AppModel } from '../app-model'
import { formatReleaseDate, RELEASES } from '../changelog'
import '../changelog.css'

/** Every release, newest first, with its highlights and fuller notes. Lazy-loaded with the changelog data. */
export default function ChangelogScreen({ app }: { app: AppModel }) {
  const [query, setQuery] = useState('')
  // Lazy screen: focus our own heading once the content is in.
  useEffect(() => { app.heading.current?.focus() }, [app.heading])
  const releases = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return RELEASES
    return RELEASES.filter(release => {
      const text = [release.version, release.title, ...release.highlights.map(item => item.text), ...release.notes].join(' ').toLowerCase()
      return words.every(word => text.includes(word))
    })
  }, [query])
  return <>
    <div className="page-heading"><div><div className="eyebrow">CHANGELOG</div><h1 ref={app.heading} tabIndex={-1}>What’s new</h1>
      <p className="muted">You’re on version {__APP_VERSION__} ({formatReleaseDate(__APP_DATE__)}). Updates download in the background and apply the next time you open DevPREP, or straight away with Relaunch now in App &amp; offline.</p></div></div>
    <label className="field changelog-filter"><span>Filter releases</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. whiteboard" /></label>
    <p className="sr-only" role="status">{releases.length} {releases.length === 1 ? 'release' : 'releases'} shown</p>
    {releases.length === 0 && <p className="card empty-state">No release mentions that. Try another word.</p>}
    <ol className="changelog-list">
      {releases.map(release => <li key={release.version}>
        <article className="card changelog-release" aria-labelledby={`release-${release.version}`}>
          <h2 id={`release-${release.version}`}>{release.title}</h2>
          <p className="changelog-meta"><span>Version {release.version}</span> · <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>{release.version === __APP_VERSION__ && <span className="changelog-current"> · Current</span>}</p>
          <ul className="changelog-highlights">{release.highlights.map(item => <li key={item.text}><a href={item.route}>{item.text}</a></li>)}</ul>
          {release.notes.length > 0 && <details className="changelog-notes"><summary>Full notes</summary><ul>{release.notes.map(note => <li key={note}>{note}</li>)}</ul></details>}
        </article>
      </li>)}
    </ol>
  </>
}
