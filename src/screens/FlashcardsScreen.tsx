import { useEffect, useState } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import { tracks } from '../curriculum'
import type { Track } from '../curriculum-types'
import { BOX_DAYS, deckIndex, dueCount, gradeCard, loadDecks, masteredCount, sessionQueue } from '../flashcards'
import type { Deck, Flashcard, Grade } from '../flashcards'

const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: 'Again', key: '1' }, { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' }, { grade: 'easy', label: 'Easy', key: '4' },
]

function interval(days: number) {
  return days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`
}

export default function FlashcardsScreen({ app }: { app: AppModel }) {
  const [decks, setDecks] = useState<Deck[]>()
  const [error, setError] = useState('')
  const [deck, setDeck] = useState<Track | 'all'>('all')
  const [session, setSession] = useState<{ queue: string[]; at: number; requeued: string[]; reviewed: number; xp: number }>()
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { app.heading.current?.focus() }, [app.heading, session === undefined])
  useEffect(() => {
    let live = true
    loadDecks().then(value => { if (live) setDecks(value) }, () => { if (live) setError('Flashcards could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [])

  const ids = deckIndex.filter(item => deck === 'all' || item.track === deck).flatMap(item => item.cards)
  const fresh = ids.filter(id => !app.progress.cards?.[id]).length
  const due = dueCount(app.progress, app.today, deck === 'all' ? undefined : deck)
  const cards = new Map<string, Flashcard>(decks?.flatMap(item => item.cards.map(card => [card.id, card] as const)) ?? [])
  const current = session && session.at < session.queue.length ? cards.get(session.queue[session.at]) : undefined

  function begin() {
    const queue = sessionQueue(app.progress, ids, app.today)
    setSession({ queue, at: 0, requeued: [], reviewed: 0, xp: 0 })
    setRevealed(false)
  }

  function grade(value: Grade) {
    if (!session || !current) return
    const xp = app.gradeCard(current.id, value)
    const again = value === 'again' && !session.requeued.includes(current.id)
    setSession({ ...session, at: session.at + 1, queue: again ? [...session.queue, current.id] : session.queue, requeued: again ? [...session.requeued, current.id] : session.requeued, reviewed: session.reviewed + 1, xp: session.xp + xp })
    setRevealed(false)
  }

  useEffect(() => {
    if (!current) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select') || event.ctrlKey || event.metaKey || event.altKey) return
      if (!revealed && (event.key === ' ' || event.key === 'Enter') && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); setRevealed(true) }
      const match = revealed && GRADES.find(item => item.key === event.key)
      if (match) { event.preventDefault(); grade(match.grade) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (session) {
    const previous = current ? app.progress.cards?.[current.id] : undefined
    return <>
      <button type="button" className="back-link text-button" onClick={() => setSession(undefined)}><Icon name="back" size={16} /> Decks</button>
      <div className="page-heading"><div><div className="eyebrow">FLASHCARDS · {deck === 'all' ? 'ALL TRACKS' : tracks.find(item => item.id === deck)?.title.toUpperCase()}</div><h1 ref={app.heading} tabIndex={-1}>{current ? `Card ${session.at + 1} of ${session.queue.length}` : 'Session complete'}</h1></div>{current && <span className="pill">{current.level === 'sse' ? 'SSE' : 'SE'}</span>}</div>
      {current ? <section className="card flashcard" aria-live="polite">
        <p className="flashcard-front">{current.front}</p>
        {revealed ? <>
          <p className="flashcard-back">{current.back}</p>
          <div className="grade-row" role="group" aria-label="How well did you recall it?">{GRADES.map(item => <button key={item.grade} type="button" className={item.grade === 'good' ? 'primary' : undefined} onClick={() => grade(item.grade)}><strong>{item.label}</strong><span className="muted">{interval(BOX_DAYS[gradeCard(previous, item.grade, app.today).box])}</span></button>)}</div>
          <p className="muted shortcut-hint">Keys 1–4 grade the card.</p>
        </> : <button type="button" className="primary" autoFocus onClick={() => setRevealed(true)}>Show answer</button>}
      </section> : <section className="card empty-state">
        <span className="empty-icon"><Icon name="check" size={28} /></span>
        <h2>{session.reviewed ? `${session.reviewed} reviews done.` : 'Nothing to review right now.'}</h2>
        <p>{session.xp ? `+${session.xp} XP. ` : ''}Cards come back when they are due.</p>
        <button type="button" className="primary" onClick={() => setSession(undefined)}>Back to decks</button>
      </section>}
    </>
  }

  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">PRACTICE · FLASHCARDS</div><h1 ref={app.heading} tabIndex={-1}>Flashcards</h1><p>Recall, then grade yourself. Good cards wait longer.</p></div><span className="pill">{dueCount(app.progress, app.today)} due</span></div>
    {error && <p className="alert" role="alert">{error}</p>}
    <fieldset className="field"><legend>Deck</legend><div className="chip-group">
      {[{ id: 'all' as const, title: 'All tracks' }, ...tracks].map(item => <label key={item.id} className="chip"><input type="radio" name="deck" checked={deck === item.id} onChange={() => setDeck(item.id)} />{item.title}</label>)}
    </div></fieldset>
    <section className="card deck-card">
      <div className="mini-stats"><div><strong>{due}</strong><span>due</span></div><div><strong>{fresh}</strong><span>new</span></div><div><strong>{masteredCount(app.progress, deck === 'all' ? undefined : deck)}</strong><span>mastered</span></div><div><strong>{ids.length}</strong><span>cards</span></div></div>
      <button type="button" className="primary" disabled={!decks || (!due && !fresh)} onClick={begin}>{due ? `Review ${due} due${fresh ? ' + new' : ''}` : fresh ? 'Learn new cards' : 'All caught up'}<Icon name="arrow" size={16} /></button>
      <p className="muted">Up to 10 new cards a session. “Mastered” means a 2-week interval or longer.</p>
    </section>
  </>
}
