import { getLearningPath, isPathId, learningPaths, pathLessonIds } from './learning-paths'
import type { PathId } from './learning-paths'

export default function PathPicker({ selected, onChange }: {
  selected: PathId | undefined
  onChange: (id: PathId | undefined) => void
}) {
  const path = getLearningPath(selected)
  return <section className="path-picker" aria-label="Learning path selection">
    <div className="path-picker-main">
      <div><label htmlFor="learning-path">Learning path</label><p>Optional guidance. Switch any time; your progress, notebook, and reviews stay.</p></div>
      <select id="learning-path" value={selected ?? ''} onChange={event => onChange(isPathId(event.target.value) ? event.target.value : undefined)}>
        <option value="">All curriculum (no path selected)</option>
        {learningPaths.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
      </select>
    </div>
    <p className="path-selection-description">{path ? `${path.audience} ${path.emphasis}` : 'No level assigned. Today follows the existing curriculum order until you choose a path.'}</p>
    <details className="path-comparison"><summary>Compare paths & outcomes</summary>
      <div className="path-choice-grid">{learningPaths.map(item => <div key={item.id}>
        <h3>{item.title}</h3><p>{item.audience}</p><p><strong>{pathLessonIds(item).length} curated lessons.</strong> {item.emphasis}</p>
        <ul>{item.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
      </div>)}</div>
      <p className="helper">Paths are interview-preparation guidance, not certification, a job-level assessment, or a readiness guarantee. The Senior path is focused practice, not complete senior-engineer training. ML is optional supplemental study for both paths; all 46 lessons remain available.</p>
    </details>
  </section>
}
