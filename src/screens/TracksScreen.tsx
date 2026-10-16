import { lazy, Suspense, useState } from 'react'
import { interviewTracks, languageTracks, lessons, tracks } from '../curriculum'
import type { TrackInfo } from '../curriculum'
import LessonList from '../components/LessonList'
import PathRoadmap from '../components/PathRoadmap'
import type { AppModel } from '../app-model'

const PlacementCheck = lazy(() => import('../components/LabParts').then(module => ({ default: module.PlacementCheck })))

function TrackSection({ app, item }: { app: AppModel; item: TrackInfo }) {
  const { progress, start } = app
  const [placing, setPlacing] = useState(false)
  const subset = lessons.filter(lesson => lesson.track === item.id)
  const placed = progress.placements?.[item.id]
  return <section className="roadmap-track">
    <div className="section-heading"><div><h2>{item.title}</h2><p>{item.description}</p></div><span className="pill">{subset.filter(lesson => progress.records[lesson.id]).length} / {subset.length} complete</span></div>
    {item.placement && !placing && <p className="placement-row"><button type="button" onClick={() => setPlacing(true)}>{placed ? 'Retake placement check' : 'Take placement check'}</button>{placed && <span className="muted"> Last score {placed.percent}% · {placed.known.length} Known</span>}</p>}
    {placing && <Suspense fallback={<p role="status" className="muted">Loading…</p>}><PlacementCheck track={item} place={answers => app.placeTrack(item.id, answers)} done={() => setPlacing(false)} /></Suspense>}
    <LessonList items={subset} progress={progress} start={start} />
  </section>
}

export default function TracksScreen({ app }: { app: AppModel }) {
  const { progress, selectedPath, roadmapScope, setRoadmapScope, track, setTrack, start, browseAll, heading } = app
  const shown = (list: TrackInfo[]) => list.filter(item => track === 'all' || item.id === track)
  return <>
<div className="page-heading"><div><div className="eyebrow">CURRICULUM</div><h1 ref={heading} tabIndex={-1}>Tracks</h1><p>Every lesson is open. Follow the order or jump to what you need.</p></div></div>
{selectedPath && <div className="filter-row" aria-label="Roadmap scope"><button aria-pressed={roadmapScope === 'path'} onClick={() => setRoadmapScope('path')}>Selected path</button><button aria-pressed={roadmapScope === 'all'} onClick={() => setRoadmapScope('all')}>All curriculum</button></div>}
{selectedPath && roadmapScope === 'path' ? <PathRoadmap path={selectedPath} progress={progress} start={start} browseAll={() => browseAll()} /> : <>
  <div className="filter-row" aria-label="Filter by track"><button aria-pressed={track === 'all'} onClick={() => setTrack('all')}>All tracks</button>{tracks.map(item => <button key={item.id} aria-pressed={track === item.id} onClick={() => setTrack(item.id)}>{item.title}</button>)}</div>
  {shown(interviewTracks).map(item => <TrackSection key={item.id} app={app} item={item} />)}
  {shown(languageTracks).length > 0 && <>
    <h2 className="section-title track-group">Languages</h2>
    <p className="muted">Interview-focused language lessons with runnable exercises. Optional: they join your plan once you start one, take the placement check or pick the track as a focus.</p>
    {shown(languageTracks).map(item => <TrackSection key={item.id} app={app} item={item} />)}
  </>}
</>}
  </>
}