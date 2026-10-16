import { lazy, Suspense, useEffect, useRef } from 'react'
import { lessons } from '../curriculum'
import type { Lesson, LessonLab } from '../curriculum-types'
import { lessonSections } from '../lesson-sections'
import { inline } from '../inline'

const LabDiagram = lazy(() => import('./LabParts').then(module => ({ default: module.LabDiagram })))
const PredictQuiz = lazy(() => import('./LabParts').then(module => ({ default: module.PredictQuiz })))
const LabTakeaways = lazy(() => import('./LabParts').then(module => ({ default: module.LabTakeaways })))
const loading = <p role="status" className="muted">Loading…</p>

export default function LessonReader({ lesson, lab, labError, sectionId, select, openLesson }: {
  lesson: Lesson
  /** Language-lesson lab (diagrams, predict quiz, tip); undefined while it loads. */
  lab?: LessonLab
  labError?: string
  sectionId: string | undefined
  select: (id: string) => void
  openLesson: (lesson: Lesson) => void
}) {
  const sections = lessonSections(lesson)
  const rich = (text: string) => lesson.lang ? inline(text) : text
  const index = Math.max(0, sections.findIndex(section => section.id === sectionId))
  const section = sections[index]
  const heading = useRef<HTMLHeadingElement>(null)
  const previousId = useRef(section.id)
  const focusSection = useRef(false)
  useEffect(() => {
    if (previousId.current !== section.id) {
      if (focusSection.current) heading.current?.focus({ preventScroll: true })
      focusSection.current = false
      previousId.current = section.id
    }
  }, [section.id])
  function turnPage(id: string) {
    focusSection.current = true
    select(id)
  }
  const teaching = section.kind === 'concept' ? lesson.concepts[section.index]
    : section.kind === 'walkthrough' ? lesson.walkthrough[section.index] : undefined

  return <div className="lesson-reader">
    <label className="reader-label" htmlFor="lesson-section">In this lesson</label>
    <select id="lesson-section" value={section.id} onChange={event => select(event.target.value)}>
      {sections.map((item, i) => <option key={item.id} value={item.id}>{i + 1}. {item.title}</option>)}
    </select>
    <div className="reader-position"><span>Section {index + 1} of {sections.length}</span><span>Reading position saves automatically</span></div>
    <div className="reader-body">
      <h2 ref={heading} tabIndex={-1}>{section.title}</h2>
      {section.kind === 'overview' && <>
        <p>{lesson.summary}</p>
        <h3>What you will be able to explain</h3>
        <ul className="objectives">{lesson.objectives.map(item => <li key={item}>{rich(item)}</li>)}</ul>
        <h3>Before you start</h3>
        <p>{lesson.prerequisiteNotes}</p>
        {lesson.prerequisites.length > 0 && <div className="prerequisite-list">{lesson.prerequisites.map(id => {
          const prerequisite = lessons.find(item => item.id === id)!
          return <button key={id} onClick={() => openLesson(prerequisite)}>{prerequisite.title}</button>
        })}</div>}
        <p className="helper">Prerequisites are suggestions, not locks.</p>
      </>}
      {teaching && <>
        {teaching.body.split(/\n\s*\n/).map((paragraph, i) => <p className="preserve-lines" key={i}>{rich(paragraph)}</p>)}
        {teaching.code && <pre className="code-example"><code>{teaching.code}</code></pre>}
        {teaching.diagram && lab && <Suspense fallback={loading}><LabDiagram lab={lab} id={teaching.diagram} /></Suspense>}
      </>}
      {lesson.lang && !lab && (teaching?.diagram || section.kind === 'predict' || section.kind === 'takeaways') && (labError ? <p className="alert" role="alert">{labError}</p> : loading)}
      {section.kind === 'predict' && lab && <Suspense fallback={loading}><PredictQuiz key={lesson.id} lab={lab} /></Suspense>}
      {section.kind === 'example' && <pre className="example-block">{lesson.example}</pre>}
      {section.kind === 'pitfalls' && <ul>{lesson.pitfalls.map(item => <li key={item}>{rich(item)}</li>)}</ul>}
      {section.kind === 'takeaways' && <>
        <ul className="takeaways">{lesson.takeaways.map(item => <li key={item}>{rich(item)}</li>)}</ul>
        {lab && <Suspense fallback={loading}><LabTakeaways lab={lab} openLesson={openLesson} /></Suspense>}
        <p className="helper">Now try the core task. Use the warm-up to build intuition or the stretch challenge to test the limits of your approach.</p>
      </>}
    </div>
    <nav className="reader-pagination" aria-label="Lesson sections">
      <button disabled={index === 0} onClick={() => turnPage(sections[index - 1].id)}>Previous section</button>
      <button disabled={index === sections.length - 1} onClick={() => turnPage(sections[index + 1].id)}>Next section</button>
    </nav>
  </div>
}
