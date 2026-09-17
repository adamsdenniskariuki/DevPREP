import { lessons } from './curriculum'
import type { Lesson } from './curriculum'
import type { LearningPath } from './learning-paths'
import { pathProgress } from './learning-paths'
import type { Mode, Progress } from './progress'
import LessonList from './LessonList'

export default function PathRoadmap({ path, progress, start, browseAll }: {
  path: LearningPath
  progress: Progress
  start: (lesson: Lesson, mode: Mode) => void
  browseAll: () => void
}) {
  const status = pathProgress(path, progress)
  return <section aria-label={`${path.title} roadmap`}>
    <div className="card path-overview"><div className="section-heading"><h2>{path.title} path</h2><span className="pill">{status.completed} / {status.total} lessons complete</span></div>
      <p>{path.emphasis}</p><progress value={status.completed} max={status.total} aria-label="Path roadmap progress" />
      <p className="helper">{status.completed === status.total ? 'All lessons in this path are explored. Keep reviewing or choose supplemental material; completion is not a readiness score.' : 'This is the recommended sequence. All prerequisites are included earlier; any completed shared lesson already counts.'}</p>
      <button className="text-button" onClick={browseAll}>Browse all lessons, including optional ML</button>
    </div>
    {path.phases.map((phase, index) => {
      const items = phase.lessonIds.map(id => lessons.find(lesson => lesson.id === id)!)
      const offset = path.phases.slice(0, index).reduce((sum, previous) => sum + previous.lessonIds.length, 0)
      return <section key={phase.title} className="path-phase" aria-label={phase.title}>
        <div className="eyebrow">PHASE {index + 1} OF {path.phases.length}</div><h2>{phase.title}</h2><p>{phase.objective}</p>
        <LessonList items={items} progress={progress} start={start} offset={offset} inPath />
      </section>
    })}
  </section>
}
