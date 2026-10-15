import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppModel } from '../app-model'
import Icon from '../components/Icon'
import DiagramFigure from '../components/Diagram'
import { lessons } from '../curriculum'
import { problemIndex } from '../problems'
import { caseIndex } from '../cases'
import { guideIndex, loadGuides, quizScore } from '../guides'
import { GUIDE_TOPICS, TOPIC_LABELS } from '../guide-types'
import type { AntiPattern, CaseEntry, Diagram, FieldGuideEntry, GuideEntry, GuideTopic, Snippet } from '../guide-types'
import '../field-guide.css'

type Level = 'all' | 'se' | 'sse'
type Kind = 'all' | 'guide' | 'case'

/** Inline `code` and **bold** inside plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    return <Fragment key={i}>{part}</Fragment>
  })
}
function Prose({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((para, i) => <p key={i} className="preserve-lines">{inline(para)}</p>)}</>
}

/** Figure numbers in reading order: free-standing diagrams first, then those used by examples and anti-patterns. */
function figureNumbers(entry: FieldGuideEntry): { numbers: Map<string, number>; free: Diagram[] } {
  const used = new Set<string>()
  if (entry.kind === 'guide') for (const item of [...entry.examples.flatMap(e => [e.bad, e.good]), ...entry.antipatterns.flatMap(a => [a.bad, a.better])]) if (item.diagram) used.add(item.diagram)
  const free = entry.diagrams.filter(d => !used.has(d.id))
  const order = [...free.map(d => d.id), ...[...used]]
  return { numbers: new Map(order.map((id, i) => [id, i + 1])), free }
}

function SnippetView({ snippet, entry, numbers, tone }: { snippet: Snippet; entry: FieldGuideEntry; numbers: Map<string, number>; tone: 'bad' | 'good' }) {
  const diagram = snippet.diagram ? entry.diagrams.find(d => d.id === snippet.diagram) : undefined
  return <div className={`fg-snippet fg-${tone}`}>
    <p className="fg-snippet-label"><Icon name={tone === 'bad' ? 'x' : 'check'} size={16} /><span className="sr-only">{tone === 'bad' ? 'Avoid: ' : 'Prefer: '}</span>{snippet.label}</p>
    {diagram ? <DiagramFigure diagram={diagram} number={numbers.get(diagram.id)!} /> : <pre className="fg-code" tabIndex={0} aria-label={`${snippet.label} (${snippet.lang ?? 'text'})`}><code>{snippet.code}</code></pre>}
  </div>
}

function AntiPatternCard({ item, entry, numbers, source }: { item: AntiPattern; entry: FieldGuideEntry; numbers: Map<string, number>; source?: boolean }) {
  return <article className="card fg-anti">
    <h3>{item.title}</h3>
    {source && <p className="muted fg-anti-source">From <a href={`#guide/${entry.id}`}>{entry.title}</a> · {TOPIC_LABELS[entry.topic]}</p>}
    <div className="fg-pair">
      <SnippetView snippet={item.bad} entry={entry} numbers={numbers} tone="bad" />
      <SnippetView snippet={item.better} entry={entry} numbers={numbers} tone="good" />
    </div>
    <p className="fg-why"><strong>Why: </strong>{inline(item.why)}</p>
  </article>
}

function Quiz({ app, entry }: { app: AppModel; entry: FieldGuideEntry }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>([])
  const [result, setResult] = useState<{ percent: number; xp: number }>()
  const best = app.progress.guides?.[entry.id]?.best
  const ready = entry.quiz.every((_, i) => answers[i] !== undefined)
  function submit() {
    const percent = quizScore(answers, entry)
    setResult({ percent, xp: app.readGuide(entry.id, percent) })
  }
  return <section className="card fg-quiz" aria-labelledby="fg-quiz-title">
    <div className="section-heading"><h2 id="fg-quiz-title">Quick quiz</h2>{best !== undefined && <span className="pill">Best {best}%</span>}</div>
    <p className="muted">Finishing the quiz marks this entry read. Its questions also join your flashcards.</p>
    <ol className="fg-questions">
      {entry.quiz.map((item, q) => <li key={q}>
        <fieldset disabled={!!result}>
          <legend>{inline(item.question)}</legend>
          {item.choices.map((choice, c) => {
            const mark = result ? c === item.answer ? 'right' : answers[q] === c ? 'wrong' : '' : ''
            return <label key={c} className={`fg-choice ${mark}`}>
              <input type="radio" name={`fg-q-${q}`} checked={answers[q] === c} onChange={() => setAnswers(prev => { const next = [...prev]; next[q] = c; return next })} />
              <span>{inline(choice)}</span>
              {mark === 'right' && <span className="fg-mark"><Icon name="check" size={16} /><span className="sr-only">Correct answer</span></span>}
              {mark === 'wrong' && <span className="fg-mark"><Icon name="x" size={16} /><span className="sr-only">Your answer, incorrect</span></span>}
            </label>
          })}
        </fieldset>
        {result && <p className="fg-explain">{inline(item.explain)}</p>}
      </li>)}
    </ol>
    {result
      ? <div className="fg-quiz-result" role="status"><strong>{result.percent}%</strong> correct{result.xp > 0 ? ` · +${result.xp} XP` : ''}<button type="button" className="text-button" onClick={() => { setAnswers([]); setResult(undefined) }}>Try again</button></div>
      : <button type="button" className="primary" disabled={!ready} onClick={submit}>Check answers</button>}
  </section>
}

function Related({ app, entry }: { app: AppModel; entry: FieldGuideEntry }) {
  const { lessons: lessonIds = [], problems = [], cases = [], guides = [] } = entry.links
  const items: ReactNode[] = [
    ...lessonIds.map(id => { const lesson = lessons.find(l => l.id === id); return lesson && <li key={`l-${id}`}><button type="button" className="text-button" onClick={() => app.start(lesson, app.progress.records[id] ? 'review' : 'learn')}><Icon name="book" size={16} />Lesson: {lesson.title}</button></li> }),
    ...problems.map(id => { const item = problemIndex.find(p => p.id === id); return item && <li key={`p-${id}`}><a className="text-button" href={`#code/${id}`}><Icon name="code" size={16} />Problem: {item.title}</a></li> }),
    ...cases.map(id => { const item = caseIndex.find(c => c.id === id); return item && <li key={`c-${id}`}><a className="text-button" href={`#design/${id}`}><Icon name="layers" size={16} />Design case: {item.title}</a></li> }),
    ...guides.map(id => { const item = guideIndex.find(g => g.id === id); return item && <li key={`g-${id}`}><a className="text-button" href={`#guide/${id}`}><Icon name="compass" size={16} />{item.kind === 'case' ? 'Case study' : 'Guide'}: {item.title}</a></li> }),
  ].filter(Boolean)
  if (!items.length) return null
  return <section className="card fg-related" aria-labelledby="fg-related-title"><h2 id="fg-related-title">Related practice</h2><ul>{items}</ul></section>
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return <section className="fg-section" aria-labelledby={id}><h2 id={id} className="section-title">{title}</h2>{children}</section>
}

function GuideBody({ entry, numbers, free }: { entry: GuideEntry; numbers: Map<string, number>; free: Diagram[] }) {
  return <>
    <div className="callout fg-principle"><span className="eyebrow">PRINCIPLE</span><p>{inline(entry.principle)}</p></div>
    <Section title="Why it matters" id="fg-why"><Prose text={entry.why} /></Section>
    {free.length > 0 && <Section title="How it works" id="fg-diagrams">{free.map(d => <DiagramFigure key={d.id} diagram={d} number={numbers.get(d.id)!} />)}</Section>}
    <Section title="Good and bad" id="fg-examples">
      {entry.examples.map((item, i) => <article key={i} className="card fg-anti">
        <h3>{item.title}</h3>
        <div className="fg-pair"><SnippetView snippet={item.bad} entry={entry} numbers={numbers} tone="bad" /><SnippetView snippet={item.good} entry={entry} numbers={numbers} tone="good" /></div>
        <p className="fg-why"><strong>Why: </strong>{inline(item.why)}</p>
      </article>)}
    </Section>
    <Section title="Checklist" id="fg-checklist"><ul className="card fg-checklist">{entry.checklist.map((item, i) => <li key={i}><Icon name="check" size={16} /><span>{inline(item)}</span></li>)}</ul></Section>
    <Section title="Anti-patterns" id="fg-anti">{entry.antipatterns.map((item, i) => <AntiPatternCard key={i} item={item} entry={entry} numbers={numbers} />)}</Section>
  </>
}

function CaseBody({ entry, numbers, free }: { entry: CaseEntry; numbers: Map<string, number>; free: Diagram[] }) {
  return <>
    <Section title="The problem" id="fg-problem"><Prose text={entry.problem} /></Section>
    <Section title="Constraints" id="fg-constraints"><ul className="fg-bullets">{entry.constraints.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul></Section>
    {free.length > 0 && <Section title="In pictures" id="fg-diagrams">{free.map(d => <DiagramFigure key={d.id} diagram={d} number={numbers.get(d.id)!} />)}</Section>}
    <Section title="Decisions and trade-offs" id="fg-decisions">
      <dl className="card fg-decisions">{entry.decisions.map((item, i) => <div key={i}><dt>{inline(item.decision)}</dt><dd><span className="eyebrow">TRADE-OFF</span> {inline(item.tradeoff)}</dd></div>)}</dl>
    </Section>
    <Section title="What went wrong" id="fg-failures"><Prose text={entry.failures} /></Section>
    <Section title="Interview lessons" id="fg-lessons"><ul className="card fg-checklist">{entry.lessons.map((item, i) => <li key={i}><Icon name="check" size={16} /><span>{inline(item)}</span></li>)}</ul></Section>
    {entry.caveats && <div className="callout fg-caveat"><strong>What the sources don’t settle</strong><p>{inline(entry.caveats)}</p></div>}
    <Section title="Sources" id="fg-sources">
      <ul className="fg-sources">{entry.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<span className="sr-only"> (opens in a new tab)</span></a> <span className="muted">· {source.publisher}{source.date ? `, ${source.date}` : ''}</span></li>)}</ul>
      <p className="muted">Paraphrased from these public sources. Read them for the full story.</p>
    </Section>
  </>
}

function EntryView({ app, entry }: { app: AppModel; entry: FieldGuideEntry }) {
  const { numbers, free } = figureNumbers(entry)
  const read = app.progress.guides?.[entry.id]
  return <article className="fg-entry">
    <a className="text-button fg-back" href="#guide"><Icon name="back" size={16} />Field Guide</a>
    <div className="page-heading"><div>
      <div className="eyebrow">{entry.kind === 'case' ? `CASE STUDY · ${entry.organisation.toUpperCase()} · ${entry.year}` : `GUIDE · ${TOPIC_LABELS[entry.topic].toUpperCase()}`}</div>
      <h1 ref={app.heading} tabIndex={-1}>{entry.title}</h1>
      <p>{entry.summary}</p>
    </div>
    <span className="fg-meta"><span className="pill">{entry.level === 'sse' ? 'SSE' : 'SE'}</span><span className="pill">{entry.minutes} min</span>{read && <span className="pill core"><Icon name="check" size={14} />Read</span>}</span></div>
    {entry.kind === 'guide' ? <GuideBody entry={entry} numbers={numbers} free={free} /> : <CaseBody entry={entry} numbers={numbers} free={free} />}
    <Section title="How to show this in an interview" id="fg-interview"><ul className="card fg-checklist fg-interview">{entry.interview.map((item, i) => <li key={i}><Icon name="target" size={16} /><span>{inline(item)}</span></li>)}</ul></Section>
    <Quiz key={entry.id} app={app} entry={entry} />
    <details className="card fg-practice"><summary>Practice question</summary><p><strong>{inline(entry.practice.prompt)}</strong></p><Prose text={entry.practice.answer} /><p className="eyebrow">A STRONG ANSWER</p><ul className="fg-bullets">{entry.practice.rubric.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul></details>
    <Related app={app} entry={entry} />
  </article>
}

function TopicSelect({ topic, setTopic, id }: { topic: GuideTopic | 'all'; setTopic: (t: GuideTopic | 'all') => void; id: string }) {
  const topics = GUIDE_TOPICS.filter(t => guideIndex.some(item => item.topic === t))
  return <div className="field"><label htmlFor={id}>Topic</label>
    <select id={id} value={topic} onChange={event => setTopic(event.target.value as GuideTopic | 'all')}>
      <option value="all">All topics</option>
      {topics.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]} ({guideIndex.filter(item => item.topic === t).length})</option>)}
    </select></div>
}

function GuideList({ app }: { app: AppModel }) {
  const { progress } = app
  const [topic, setTopic] = useState<GuideTopic | 'all'>('all')
  const [level, setLevel] = useState<Level>('all')
  const [kind, setKind] = useState<Kind>('all')
  const shown = guideIndex.filter(item => (topic === 'all' || item.topic === topic) && (level === 'all' || item.level === level) && (kind === 'all' || item.kind === kind))
  const read = guideIndex.filter(item => progress.guides?.[item.id]).length
  const antiCount = guideIndex.reduce((sum, item) => sum + item.antipatterns, 0)
  return <>
    <div className="page-heading"><div><div className="eyebrow">FIELD GUIDE</div><h1 ref={app.heading} tabIndex={-1}>Field Guide</h1><p>Best practices, real incidents and the mistakes to avoid, with diagrams.</p></div><span className="pill">{read} of {guideIndex.length} read</span></div>
    <a className="card fg-gallery-link" href="#antipatterns"><Icon name="x" size={20} /><span><strong>Anti-pattern gallery</strong><span className="muted">{antiCount} bad-vs-better pairs, side by side</span></span><Icon name="arrow" size={18} /></a>
    <div className="code-filters">
      <TopicSelect topic={topic} setTopic={setTopic} id="fg-topic" />
      <fieldset className="field"><legend>Level</legend><div className="chip-group">
        {([['all', 'All'], ['se', 'SE'], ['sse', 'SSE']] as const).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="fg-level" checked={level === id} onChange={() => setLevel(id)} />{label}</label>)}
      </div></fieldset>
      <fieldset className="field"><legend>Type</legend><div className="chip-group">
        {([['all', 'All'], ['guide', 'Guides'], ['case', 'Case studies']] as const).map(([id, label]) => <label key={id} className="chip"><input type="radio" name="fg-kind" checked={kind === id} onChange={() => setKind(id)} />{label}</label>)}
      </div></fieldset>
    </div>
    {shown.length === 0 && <p className="card empty-note">Nothing matches these filters.</p>}
    {GUIDE_TOPICS.map(t => {
      const items = shown.filter(item => item.topic === t)
      if (!items.length) return null
      const all = guideIndex.filter(item => item.topic === t)
      return <section key={t} className="code-group" aria-labelledby={`fg-topic-${t}`}>
        <div className="code-group-head"><h2 className="section-title" id={`fg-topic-${t}`}>{TOPIC_LABELS[t]}</h2><span className="pattern-count">{all.filter(item => progress.guides?.[item.id]).length} of {all.length} read</span></div>
        <ul className="fg-cards">
          {items.map(item => <li key={item.id}><a className="card fg-card" href={`#guide/${item.id}`}>
            <span className="eyebrow">{item.kind === 'case' ? `Case study · ${item.organisation}` : 'Guide'}</span>
            <strong>{item.title}</strong>
            <span className="fg-card-summary">{item.summary}</span>
            <span className="fg-meta">{item.level === 'sse' && <span className="pill">SSE</span>}<span className="pill">{item.minutes} min</span><span className="pill">{item.diagrams} diagrams</span>{progress.guides?.[item.id] && <span className="pill core"><Icon name="check" size={14} />Read</span>}</span>
          </a></li>)}
        </ul>
      </section>
    })}
  </>
}

function Gallery({ app, entries }: { app: AppModel; entries: Map<string, FieldGuideEntry> }) {
  const [topic, setTopic] = useState<GuideTopic | 'all'>('all')
  const guides = [...entries.values()].filter((entry): entry is GuideEntry => entry.kind === 'guide' && (topic === 'all' || entry.topic === topic))
  return <>
    <a className="text-button fg-back" href="#guide"><Icon name="back" size={16} />Field Guide</a>
    <div className="page-heading"><div><div className="eyebrow">FIELD GUIDE</div><h1 ref={app.heading} tabIndex={-1}>Anti-pattern gallery</h1><p>Bad on the left, better on the right, and why.</p></div></div>
    <div className="code-filters"><TopicSelect topic={topic} setTopic={setTopic} id="fg-gallery-topic" /></div>
    {guides.flatMap(entry => {
      const { numbers } = figureNumbers(entry)
      return entry.antipatterns.map((item, i) => <AntiPatternCard key={`${entry.id}-${i}`} item={item} entry={entry} numbers={numbers} source />)
    })}
  </>
}

export default function FieldGuideScreen({ app, guideId, gallery }: { app: AppModel; guideId?: string; gallery?: boolean }) {
  const [entries, setEntries] = useState<Map<string, FieldGuideEntry>>()
  const [error, setError] = useState('')
  const needData = !!guideId || !!gallery
  useEffect(() => {
    if (!needData || entries) return
    let live = true
    loadGuides().then(map => { if (live) setEntries(map) }, () => { if (live) setError('The Field Guide could not be loaded. Reconnect and try again.') })
    return () => { live = false }
  }, [needData, entries])
  const entry = useMemo(() => guideId ? entries?.get(guideId) : undefined, [entries, guideId])
  useEffect(() => { if (!needData || entry || (gallery && entries)) app.heading.current?.focus() }, [needData, entry, gallery, entries, app.heading])
  if (!needData) return <GuideList app={app} />
  if (error) return <p role="alert" className="callout">{error}</p>
  if (!entries) return <p role="status">Loading the Field Guide…</p>
  if (gallery) return <Gallery app={app} entries={entries} />
  return entry ? <EntryView key={entry.id} app={app} entry={entry} /> : null
}
