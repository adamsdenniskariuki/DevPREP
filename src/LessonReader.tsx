import { useEffect, useRef } from 'react'
import { lessons } from './curriculum'
import type { Lesson } from './curriculum-types'
import { lessonSections } from './lesson-sections'

export default function LessonReader({ lesson, sectionId, select, openLesson }: {
  lesson: Lesson
  sectionId: string | undefined
  select: (id: string) => void
  openLesson: (lesson: Lesson) => void
}) {
  const sections = lessonSections(lesson)
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
        <ul className="objectives">{lesson.objectives.map(item => <li key={item}>{item}</li>)}</ul>
        <h3>Before you start</h3>
        <p>{lesson.prerequisiteNotes}</p>
        {lesson.prerequisites.length > 0 && <div className="prerequisite-list">{lesson.prerequisites.map(id => {
          const prerequisite = lessons.find(item => item.id === id)!
          return <button key={id} onClick={() => openLesson(prerequisite)}>{prerequisite.title}</button>
        })}</div>}
        <p className="helper">Prerequisites are recommendations, not locks. Opening another lesson asks before replacing this session. All core and optional work shares one session notebook.</p>
      </>}
      {teaching && <>
        {teaching.body.split(/\n\s*\n/).map((paragraph, i) => <p className="preserve-lines" key={i}>{paragraph}</p>)}
        {teaching.code && <pre className="code-example"><code>{teaching.code}</code></pre>}
      </>}
      {section.kind === 'example' && <pre className="example-block">{lesson.example}</pre>}
      {section.kind === 'pitfalls' && <ul>{lesson.pitfalls.map(item => <li key={item}>{item}</li>)}</ul>}
      {section.kind === 'takeaways' && <>
        <ul className="takeaways">{lesson.takeaways.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="helper">Now try the core task. Use the warm-up to build intuition or the stretch challenge to test the limits of your approach.</p>
      </>}
    </div>
    <nav className="reader-pagination" aria-label="Lesson sections">
      <button disabled={index === 0} onClick={() => turnPage(sections[index - 1].id)}>Previous section</button>
      <button disabled={index === sections.length - 1} onClick={() => turnPage(sections[index + 1].id)}>Next section</button>
    </nav>
  </div>
}
