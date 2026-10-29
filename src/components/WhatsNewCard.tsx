import { formatReleaseDate, RELEASES } from '../changelog'
import { releasesSince } from '../versions'
import '../changelog.css'

/** Shown once after an update activates: the highlights of every release since the last version this browser ran. */
export default function WhatsNewCard({ since, dismiss }: { since?: string; dismiss: () => void }) {
  const releases = releasesSince(RELEASES, __APP_VERSION__, since)
  return <section className="card whats-new" aria-labelledby="whats-new-title">
    <div className="whats-new-head">
      <h2 id="whats-new-title">What’s new in DevPREP {__APP_VERSION__}</h2>
      <button className="text-button" aria-label="Dismiss What’s new" onClick={dismiss}>Dismiss</button>
    </div>
    {releases.map(release => <div key={release.version} className="whats-new-release">
      <h3>{release.title} <span className="whats-new-meta">{release.version} · {formatReleaseDate(release.date)}</span></h3>
      <ul>{release.highlights.map(item => <li key={item.text}><a href={item.route}>{item.text}</a></li>)}</ul>
    </div>)}
    <p><a href="#changelog">See the full changelog</a></p>
  </section>
}
