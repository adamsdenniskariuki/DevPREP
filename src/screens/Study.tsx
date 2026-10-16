import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { loadLabs, tracks } from '../curriculum'
import type { Lesson, LessonLab } from '../curriculum'
import { MAX_DRAFT_LENGTH } from '../progress'
import type { Phase, Rating, StudySession } from '../progress'
import type { LearningPath } from '../learning-paths'
import { inline } from '../inline'
import Icon from '../components/Icon'
import LessonReader from '../components/LessonReader'
import ExtraPractice from '../components/ExtraPractice'
import PathPrompt from '../components/PathPrompt'
import { phaseLabels } from '../labels'

const LabRunner = lazy(() => import('../components/LabParts').then(module => ({ default: module.LabRunner })))

export default function Study({ lesson, session, edit, finish, heading, openLesson, path }: {
  lesson: Lesson
  session: StudySession
  edit: (patch: Partial<StudySession>) => void
  finish: (rating: Rating) => void
  heading: React.RefObject<HTMLHeadingElement | null>
  openLesson: (lesson: Lesson) => void
  path: LearningPath | undefined
}) {
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const [practiceStage, setPracticeStage] = useState<'warmup' | 'core' | 'stretch'>('core')
  const [lab, setLab] = useState<{ id: string; lab?: LessonLab; error?: string }>()
  const [extraCode, setExtraCode] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!lesson.lang) return
    let live = true
    loadLabs().then(labs => { if (live) setLab({ id: lesson.id, lab: labs.get(lesson.id) }) }, () => { if (live) setLab({ id: lesson.id, error: 'The lab could not be loaded. Reconnect and try again.' }) })
    return () => { live = false }
  }, [lesson.id, lesson.lang])
  const current = lab?.id === lesson.id ? lab : undefined
  const labData = current?.lab
  const core = labData?.exercises.find(exercise => exercise.id === 'core')
  const extra = labData?.exercises.find(exercise => exercise.id === practiceStage)
  const loadingLab = <p role="status" className="muted">{current?.error ?? 'Loading the code runner…'}</p>
  const phase = path?.phases.find(item => item.lessonIds.includes(lesson.id))
  const prompt = path?.prompts.find(item => item.lessonId === lesson.id)
  useEffect(() => { stepHeading.current?.focus() }, [session.phase])
  function advance(phase: Phase) {
    edit({ phase, ...(phase === 'assess' ? { solutionRevealed: true } : {}) })
  }
  return <div className={`study-page phase-${session.phase}`}>
    <div className="page-heading"><div><div className="eyebrow">{session.mode === 'review' ? 'RETRIEVAL PRACTICE' : tracks.find(track => track.id === lesson.track)?.title} · ABOUT {lesson.minutes} MIN</div><h1 ref={heading} tabIndex={-1}>{lesson.title}</h1><p>{session.mode === 'review' ? 'Try it from memory. Revisit the lesson whenever you need to.' : lesson.summary}</p><p className="helper">Full-session estimate. Pause between sections; warm-up and stretch practice are optional.</p></div><a className="button" href="#home">Pause session</a></div>
    {path && <div className="path-study-context"><strong>{phase ? `${path.shortTitle}: ${phase.title}` : 'Supplemental lesson outside your selected path'}</strong><p>{phase?.objective ?? 'Your work still counts toward overall progress and its reviews stay in the global queue. It does not add to this path’s lesson count.'}</p></div>}
    <nav className="study-steps" aria-label="Study steps">{(['lesson', 'practice', 'assess'] as const).map((phase, index) => <button key={phase} aria-current={session.phase === phase ? 'step' : undefined} disabled={phase === 'assess' && !session.draft.trim()} onClick={() => advance(phase)}><span>{index + 1}</span>{phaseLabels[phase]}</button>)}</nav>
    <div className="study-columns">
      <article className="card lesson-content">
        <div className="eyebrow">UNDERSTAND THE REASONING</div><h2 ref={session.phase === 'lesson' ? stepHeading : undefined} tabIndex={-1} className="sr-only">Read the lesson</h2>
        <LessonReader lesson={lesson} lab={labData} labError={current?.error} sectionId={session.readingSection} select={readingSection => edit({ readingSection })} openLesson={openLesson} />
        {session.phase === 'lesson' && <button className="primary" onClick={() => advance('practice')}>Continue to practice <Icon name="arrow" size={18} /></button>}
      </article>
      <section className="card practice-content">
        {session.phase === 'lesson' ? <><div className="eyebrow">UP NEXT</div><span className="practice-icon"><Icon name="code" size={28} /></span><h2>Turn the idea into a skill.</h2><p className="preserve-lines">{lesson.lang ? inline(lesson.task) : lesson.task}</p><div className="callout">{lesson.lang ? 'Read the lesson, then write and run your solution against the tests.' : 'Read the lesson, then try the task in your own words. This is a thinking space, not a code runner.'}</div></> : session.phase === 'practice' ? <>
          <div className="eyebrow">YOUR TURN</div><h2 ref={stepHeading} tabIndex={-1}>Work through the problem</h2>
          <div className="practice-levels" role="group" aria-label="Practice difficulty">{(['warmup', 'core', 'stretch'] as const).map(stage => <button key={stage} aria-pressed={practiceStage === stage} onClick={() => setPracticeStage(stage)}>{stage === 'warmup' ? 'Warm-up' : stage === 'core' ? 'Core task' : 'Stretch'}</button>)}</div>
          {practiceStage === 'core' ? <><p className="preserve-lines">{lesson.lang ? inline(lesson.task) : lesson.task}</p>
          {!lesson.lang && lesson.starter && <details><summary>Suggested starting point</summary><pre><code>{lesson.starter}</code></pre></details>}
          {lesson.lang && (core ? <Suspense fallback={loadingLab}><LabRunner lab={labData!} exercise={core} label="Your solution" value={session.draft || core.starter} onChange={draft => edit({ draft: draft.slice(0, MAX_DRAFT_LENGTH) })} /></Suspense> : loadingLab)}</> : <>
          <ExtraPractice key={practiceStage} rich={!!lesson.lang} exercise={lesson.extraPractice.find(exercise => exercise.id === practiceStage)!} />
          {lesson.lang && extra && <Suspense fallback={loadingLab}><LabRunner key={practiceStage} lab={labData!} exercise={extra} label={practiceStage === 'warmup' ? 'Warm-up code' : 'Stretch code'} value={extraCode[practiceStage] ?? extra.starter} onChange={code => setExtraCode(prev => ({ ...prev, [practiceStage]: code }))} /></Suspense>}</>}
          {prompt && <PathPrompt prompt={prompt} />}
          {!lesson.lang && <><label className="answer-label" htmlFor="practice-answer">Your approach & answer</label><p className="helper" id="answer-help">Pseudocode, a sketch or talking points: explain why it works. Nothing is executed or automatically graded.</p>
          <textarea id="practice-answer" aria-describedby="answer-help answer-count" value={session.draft} maxLength={MAX_DRAFT_LENGTH} placeholder="Start with what you know. What would you try, and why?" onChange={event => edit({ draft: event.target.value })} spellCheck={false} />
          <div id="answer-count" className="answer-count">{session.draft.length.toLocaleString()} / {MAX_DRAFT_LENGTH.toLocaleString()} characters</div></>}
          {practiceStage === 'core' && <><div className="hint-area">{session.hintsRevealed < lesson.hints.length && <button onClick={() => edit({ hintsRevealed: session.hintsRevealed + 1 })}>Need a hint? ({session.hintsRevealed}/{lesson.hints.length})</button>}{lesson.hints.slice(0, session.hintsRevealed).map((hint, index) => <div className="callout" key={hint}><strong>Hint {index + 1}</strong><p>{hint}</p></div>)}</div>
          {session.solutionRevealed ? <details open><summary>Worked solution</summary><pre>{lesson.solution}</pre>{core && <pre className="lab-code"><code>{core.solution}</code></pre>}</details> : <button className="text-button" onClick={() => edit({ solutionRevealed: true })}>Reveal worked solution</button>}</>}
          <div className="study-action"><p className="helper">{session.draft.trim() ? 'Ready? Compare your approach and reflect.' : lesson.lang ? 'Edit the starter code before moving to reflection. A partial attempt counts.' : 'Write an attempt before moving to reflection. Getting stuck counts: explain where and why.'}</p><button className="primary" disabled={!session.draft.trim()} onClick={() => advance('assess')}>Compare & reflect <Icon name="arrow" size={18} /></button></div>
        </> : <>
          <div className="eyebrow">CLOSE THE LOOP</div><h2 ref={stepHeading} tabIndex={-1}>Explain it. Then be honest.</h2><p>Compare the reasoning, not just the final answer. This is self-assessment, not automated grading.</p>
          <details open><summary>Your answer</summary><pre>{session.draft}</pre></details>
          <details open><summary>Worked solution & explanation</summary><pre>{lesson.solution}</pre>{core && <pre className="lab-code"><code>{core.solution}</code></pre>}</details>
          <fieldset className="checklist"><legend>What can you explain without looking?</legend>{lesson.checklist.map((item, index) => <label key={item}><input type="checkbox" checked={session.checks[index]} onChange={event => edit({ checks: session.checks.map((checked, i) => i === index ? event.target.checked : checked) })} /><span>{item}</span></label>)}</fieldset>
          <p className="helper">No need to check every box. Use the gaps to choose your next review.</p>
          <section className="interview-followups"><h3>Interview follow-ups</h3><p>Answer aloud before opening the discussion. These are practice prompts, not scripts to memorize.</p>{lesson.followUps.map(item => <details key={item.question}><summary>{item.question}</summary><p className="preserve-lines">{item.answer}</p></details>)}</section>
          {prompt && <PathPrompt prompt={prompt} />}
          <fieldset className="rating-options"><legend>How did this feel?</legend><button onClick={() => finish('again')}><strong>Needs practice</strong><span>Review tomorrow</span></button><button onClick={() => finish('okay')}><strong>Getting there</strong><span>Review in a few days</span></button><button className="primary" onClick={() => finish('confident')}><strong>Confident</strong><span>Review after a longer gap</span></button></fieldset>
          <p className="helper">Picking a confidence finishes the lesson and schedules a review in 1, 3 or 7 days. Your answer is cleared for fresh recall.</p><button className="text-button" onClick={() => advance('practice')}>Back to my answer</button>
        </>}
      </section>
    </div>
  </div>
}
