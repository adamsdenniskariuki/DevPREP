import { useState } from 'react'
import { learningPaths } from '../learning-paths'
import type { AppModel } from '../app-model'

export default function WelcomeTour({ app }: { app: AppModel }) {
  const [step, setStep] = useState(0)
  const { progress, changePath, changeProfile, closeTour, today } = app
  const steps = 4
  const next = () => setStep(value => value + 1)
  return <section className="card tour-card" aria-labelledby="tour-title">
    <div className="tour-top"><span className="eyebrow">WELCOME · {step + 1} / {steps}</span><button className="text-button" onClick={closeTour}>Skip tour</button></div>
    {step === 0 && <>
      <h2 id="tour-title">Prep for your next engineering interview.</h2>
      <p>DSA, system design, ML and behavioural practice in short, focused sessions. Everything stays on this device.</p>
      <button className="primary" onClick={next}>Let’s go</button>
    </>}
    {step === 1 && <>
      <h2 id="tour-title">Which role are you targeting?</h2>
      <p>This picks your path. Change it any time in Settings.</p>
      <div className="tour-choices">
        {learningPaths.map(path => <button key={path.id} aria-pressed={progress.selectedPath === path.id} onClick={() => { changePath(path.id); next() }}><strong>{path.shortTitle}</strong><span>{path.audience}</span></button>)}
        <button aria-pressed={!progress.selectedPath} onClick={() => { changePath(undefined); next() }}><strong>Not sure yet</strong><span>Browse every track.</span></button>
      </div>
    </>}
    {step === 2 && <>
      <h2 id="tour-title">When is your interview?</h2>
      <p>Optional. Home counts down and the plan adapts.</p>
      <div className="tour-date"><label htmlFor="tour-interview-date">Interview date</label><input id="tour-interview-date" type="date" min={today} value={progress.profile?.interviewDate ?? ''} onChange={event => changeProfile({ interviewDate: event.target.value || undefined })} /></div>
      <button className="primary" onClick={next}>{progress.profile?.interviewDate ? 'Next' : 'Skip for now'}</button>
    </>}
    {step === 3 && <>
      <h2 id="tour-title">How it works</h2>
      <ol className="tour-steps"><li><strong>Learn</strong> a short lesson.</li><li><strong>Practise</strong> with hints, then compare.</li><li><strong>Rate</strong> your confidence; reviews come back on schedule.</li></ol>
      <p className="helper">Earn XP and keep a streak. Export a backup from Settings now and then.</p>
      <button className="primary" onClick={closeTour}>Start practising</button>
    </>}
  </section>
}
