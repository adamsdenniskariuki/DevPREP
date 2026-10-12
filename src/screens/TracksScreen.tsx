import { lessons, tracks } from '../curriculum'
import LessonList from '../components/LessonList'
import PathRoadmap from '../components/PathRoadmap'
import type { AppModel } from '../app-model'

export default function TracksScreen({ app }: { app: AppModel }) {
  const { progress, selectedPath, roadmapScope, setRoadmapScope, track, setTrack, start, browseAll, heading } = app
  return <>
<div className="page-heading"><div><div className="eyebrow">CURRICULUM</div><h1 ref={heading} tabIndex={-1}>Tracks</h1><p>Every lesson is open. Follow the order or jump to what you need.</p></div></div>
{selectedPath && <div className="filter-row" aria-label="Roadmap scope"><button aria-pressed={roadmapScope === 'path'} onClick={() => setRoadmapScope('path')}>Selected path</button><button aria-pressed={roadmapScope === 'all'} onClick={() => setRoadmapScope('all')}>All curriculum</button></div>}
{selectedPath && roadmapScope === 'path' ? <PathRoadmap path={selectedPath} progress={progress} start={start} browseAll={() => browseAll()} /> : <>
  <div className="filter-row" aria-label="Filter by track"><button aria-pressed={track === 'all'} onClick={() => setTrack('all')}>All tracks</button>{tracks.map(item => <button key={item.id} aria-pressed={track === item.id} onClick={() => setTrack(item.id)}>{item.title}</button>)}</div>
  {tracks.filter(item => track === 'all' || item.id === track).map(item => <section className="roadmap-track" key={item.id}><div className="section-heading"><div><h2>{item.title}</h2><p>{item.description}</p></div><span className="pill">{lessons.filter(lesson => lesson.track === item.id && progress.records[lesson.id]).length} / {lessons.filter(lesson => lesson.track === item.id).length} complete</span></div><LessonList items={lessons.filter(lesson => lesson.track === item.id)} progress={progress} start={start} /></section>)}
</>}
  </>
}
