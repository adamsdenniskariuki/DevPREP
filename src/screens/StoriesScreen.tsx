import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import { MAX_STORIES, MAX_STORY_FIELD } from '../progress'
import type { Story } from '../progress'
import { COMPETENCIES, newStoryId, SSE_SIGNALS } from '../stories'
import type { Competency } from '../stories'

type Draft = Omit<Story, 'updatedAt'>
const FIELDS = [
  { key: 'situation', label: 'Situation', hint: 'Context in two or three sentences.' },
  { key: 'task', label: 'Task', hint: 'Your responsibility and what was at stake.' },
  { key: 'action', label: 'Action', hint: 'What you did, using “I”. The longest part.' },
  { key: 'result', label: 'Result', hint: 'Numbers if you have them, and what you learned.' },
] as const

const blank = (competency?: Competency): Draft => ({ id: newStoryId(), title: '', competencies: competency ? [competency] : [], situation: '', task: '', action: '', result: '' })

export default function StoriesScreen({ app }: { app: AppModel }) {
  const stories = app.progress.stories ?? []
  const [draft, setDraft] = useState<Draft>()
  const [error, setError] = useState('')
  const formHeading = useRef<HTMLHeadingElement>(null)
  const senior = app.progress.selectedPath === 'senior'
  useEffect(() => { (draft ? formHeading : app.heading).current?.focus() }, [app.heading, draft === undefined])

  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    if (!draft.title.trim()) { setError('Give the story a short title.'); return }
    const message = app.saveStory(draft)
    if (message) { setError(message); return }
    setError('')
    setDraft(undefined)
  }

  if (draft) return <form onSubmit={save}>
    <button type="button" className="back-link text-button" onClick={() => { setDraft(undefined); setError('') }}><Icon name="back" size={16} /> Story bank</button>
    <div className="page-heading"><div><div className="eyebrow">BEHAVIORAL · STAR</div><h1 ref={formHeading} tabIndex={-1}>{stories.some(item => item.id === draft.id) ? 'Edit story' : 'New story'}</h1></div></div>
    <div className="card story-form">
      <label className="field" htmlFor="story-title">Title<input id="story-title" maxLength={120} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Cut checkout latency in half" /></label>
      <fieldset className="field"><legend>Competencies it shows</legend><div className="chip-group">{COMPETENCIES.map(item => <label key={item.id} className="chip"><input type="checkbox" checked={draft.competencies.includes(item.id)} onChange={event => setDraft({ ...draft, competencies: event.target.checked ? [...draft.competencies, item.id] : draft.competencies.filter(id => id !== item.id) })} />{item.title}</label>)}</div></fieldset>
      {FIELDS.map(field => <label key={field.key} className="field" htmlFor={`story-${field.key}`}>{field.label} <span className="muted">{field.hint}</span>
        <textarea id={`story-${field.key}`} rows={field.key === 'action' ? 6 : 3} maxLength={MAX_STORY_FIELD} value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} /></label>)}
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="button-row"><button type="submit" className="primary">Save story</button><button type="button" className="text-button" onClick={() => { setDraft(undefined); setError('') }}>Cancel</button></div>
    </div>
  </form>

  return <>
    <a className="back-link" href="#practice"><Icon name="back" size={16} /> Practice</a>
    <div className="page-heading"><div><div className="eyebrow">BEHAVIORAL · STORY BANK</div><h1 ref={app.heading} tabIndex={-1}>Story bank</h1><p>Write 6–8 STAR stories, then reuse them across questions.</p></div><span className="pill">{stories.length} / {MAX_STORIES}</span></div>
    <section aria-labelledby="coverage-title"><h2 id="coverage-title" className="section-title">Coverage</h2>
      <ul className="coverage-grid">{COMPETENCIES.map(item => {
        const count = stories.filter(story => story.competencies.includes(item.id)).length
        return <li key={item.id} className={`card coverage-cell${count ? ' covered' : ''}`}>
          <strong>{item.title}{senior && SSE_SIGNALS.includes(item.id) && <span className="pill">SSE signal</span>}</strong>
          <span className="muted">{item.prompt}</span>
          <span className="coverage-foot">{count ? `${count} ${count === 1 ? 'story' : 'stories'}` : <button type="button" className="text-button" onClick={() => setDraft(blank(item.id))}>Add a story</button>}</span>
        </li>
      })}</ul>
    </section>
    <section aria-labelledby="stories-title"><div className="section-heading"><h2 id="stories-title" className="section-title">Your stories</h2><button type="button" className="primary" disabled={stories.length >= MAX_STORIES} onClick={() => setDraft(blank())}>New story</button></div>
      {stories.length ? <ul className="card code-list">{stories.map(story => <li key={story.id} className="code-row">
        <span className="case-row-text"><strong>{story.title}</strong><span className="muted">{story.competencies.map(id => COMPETENCIES.find(item => item.id === id)?.title).join(' · ') || 'No competencies yet'}</span></span>
        <span className="code-row-meta"><button type="button" className="text-button" onClick={() => setDraft(story)} aria-label={`Edit ${story.title}`}>Edit</button><button type="button" className="text-button" onClick={() => { if (window.confirm(`Delete “${story.title}”?`)) app.deleteStory(story.id) }} aria-label={`Delete ${story.title}`}>Delete</button></span>
      </li>)}</ul> : <p className="muted">No stories yet. Stories are saved on this device and included in backups.</p>}
    </section>
  </>
}
