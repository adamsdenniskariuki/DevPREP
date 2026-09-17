import type { Lesson } from './curriculum'
import { displayDate } from './format'
import type { Mode, Progress } from './progress'

export default function LessonList({ items, progress, start, offset = 0, inPath = false }: {
  items: Lesson[]
  progress: Progress
  start: (lesson: Lesson, mode: Mode) => void
  offset?: number
  inPath?: boolean
}) {
  return <div className="lesson-list">{items.map((lesson, index) => {
    const record = progress.records[lesson.id]
    const active = progress.session?.lessonId === lesson.id
    return <article className="lesson-row" key={lesson.id}>
      <span className={`step-number ${record ? 'complete' : ''}`} aria-hidden="true">{record ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m5 12 4 4L19 6" /></svg> : String(offset + index + 1).padStart(2, '0')}</span>
      <div className="lesson-row-copy"><h3>{lesson.title}</h3><p>{lesson.summary}</p><span className="muted">{lesson.minutes} min · {active ? 'In progress' : record ? `Next review ${displayDate(record.due)}` : inPath ? `Path lesson ${offset + index + 1}` : index === 0 ? 'Start here' : 'Next in this track'}</span></div>
      <button onClick={() => start(lesson, record ? 'review' : 'learn')}>{active ? 'Resume' : record ? 'Practice again' : 'Start lesson'}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></button>
    </article>
  })}</div>
}
