import { tracks } from '../curriculum'
import { accents } from '../accent-preference'
import type { Accent } from '../accent-preference'
import { fonts, modes, palettes } from '../appearance'
import type { Appearance } from '../appearance'
import { getLearningPath, isPathId, learningPaths, pathLessonIds } from '../learning-paths'
import type { AppModel } from '../app-model'

export default function SettingsScreen({ app, appearance, setAppearance, appearanceError, accent, chooseAccent }: {
  app: AppModel
  appearance: Appearance
  setAppearance: (patch: Partial<Appearance>) => void
  appearanceError: string
  accent: Accent
  chooseAccent: (value: string) => void
}) {
  const { progress, heading, changePath, changeProfile, backupControls, replayTour, today } = app
  const path = getLearningPath(progress.selectedPath)
  const focus = progress.profile?.focusTracks ?? []
  return <>
<div className="page-heading"><div><div className="eyebrow">SETTINGS</div><h1 ref={heading} tabIndex={-1}>Settings</h1></div></div>
<section className="card settings-section" aria-labelledby="profile-title"><h2 id="profile-title">Your interview</h2>
  <div className="field"><label htmlFor="learning-path">Target role</label>
    <select id="learning-path" value={progress.selectedPath ?? ''} onChange={event => changePath(isPathId(event.target.value) ? event.target.value : undefined)}>
      <option value="">No path (all curriculum)</option>
      {learningPaths.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
    </select>
    <p className="helper">{path ? `${pathLessonIds(path).length} curated lessons. ${path.emphasis}` : 'Home follows the curriculum order.'} Switching keeps all progress.</p>
  </div>
  <details className="path-comparison"><summary>Compare paths & outcomes</summary>
    <div className="path-choice-grid">{learningPaths.map(item => <div key={item.id}>
      <h3>{item.title}</h3><p>{item.audience}</p><p><strong>{pathLessonIds(item).length} curated lessons.</strong> {item.emphasis}</p>
      <ul>{item.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
    </div>)}</div>
    <p className="helper">Paths are interview-preparation guidance, not a readiness guarantee. ML is optional for both.</p>
  </details>
  <div className="field"><label htmlFor="interview-date">Interview date</label>
    <div className="inline-field"><input id="interview-date" type="date" min={today} value={progress.profile?.interviewDate ?? ''} onChange={event => changeProfile({ interviewDate: event.target.value || undefined })} />
      {progress.profile?.interviewDate && <button className="text-button" onClick={() => changeProfile({ interviewDate: undefined })}>Clear</button>}</div>
  </div>
  <fieldset className="field"><legend>Focus tracks</legend><div className="chip-group">{tracks.map(item => <label key={item.id} className="chip"><input type="checkbox" checked={focus.includes(item.id)} onChange={event => changeProfile({ focusTracks: event.target.checked ? [...focus, item.id] : focus.filter(id => id !== item.id) })} />{item.title}</label>)}</div></fieldset>
</section>

<section className="card settings-section" aria-labelledby="appearance-title"><h2 id="appearance-title">Appearance</h2>
  <fieldset className="field"><legend>Mode</legend><div className="chip-group">{modes.map(item => <label key={item.id} className="chip"><input type="radio" name="mode" checked={appearance.mode === item.id} onChange={() => setAppearance({ mode: item.id })} />{item.label}</label>)}</div></fieldset>
  <fieldset className="field"><legend>Theme</legend><div className="chip-group">{palettes.map(item => <label key={item.id} className="chip palette-chip" data-swatch={item.id}><input type="radio" name="palette" checked={appearance.palette === item.id} onChange={() => setAppearance({ palette: item.id })} /><span className="palette-dot" aria-hidden="true" />{item.label}</label>)}</div></fieldset>
  <div className="field accent-picker"><label htmlFor="accent-choice">Accent</label><span className="accent-swatch" aria-hidden="true" />
    <select id="accent-choice" value={accent} onChange={event => chooseAccent(event.target.value)}>{accents.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>
  <div className="field"><label htmlFor="font-choice">Font</label>
    <select id="font-choice" value={appearance.font} onChange={event => setAppearance({ font: fonts.find(item => item.id === event.target.value)?.id ?? 'atkinson' })}>{fonts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <p className="helper font-preview">The quick brown fox jumps over the lazy dog.</p></div>
  {appearanceError && <p className="pwa-warning" role="alert">{appearanceError}</p>}
</section>

<section className="card settings-section about-data" aria-labelledby="data-title"><h2 id="data-title">About your data</h2>
  <p>Progress, answers and settings live only in this browser. No accounts, no sync, no tracking. Clearing site data or switching browsers loses it, so export a backup now and then. Backups include your unfinished answer. Offline status and updates are in “App & offline” at the bottom of every page.</p>
  {backupControls}
</section>

<section className="card settings-section" aria-labelledby="tour-settings-title"><h2 id="tour-settings-title">Welcome tour</h2><p className="helper">See the quick introduction again.</p><button onClick={replayTour}>Replay welcome tour</button></section>
  </>
}
