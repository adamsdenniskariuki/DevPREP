import { useEffect, useState, type ComponentType } from 'react'
import CodeEditor from './CodeEditor'
import { useEditorPrefs } from '../editor-context'
import type { EditorProps } from '../editor-prefs'

type Rich = ComponentType<EditorProps>
let request: Promise<Rich> | undefined
let rich: Rich | undefined
let failed = false

/** CodeMirror is fetched only when a code screen first needs it, then precached for offline use. */
export function loadRichEditor(): Promise<Rich> {
  request ??= import('./RichEditor').then(module => (rich = module.default), error => { failed = true; throw error })
  return request
}

/**
 * The code editor used on every code surface. It shows the Rich (CodeMirror) editor unless the
 * Plain editor is chosen in Settings, and falls back to Plain if CodeMirror cannot be loaded.
 */
export default function Editor(props: EditorProps) {
  const { prefs, setPrefs } = useEditorPrefs()
  const [, rerender] = useState(0)
  const wantRich = prefs.kind === 'rich'
  useEffect(() => {
    if (!wantRich || rich || failed) return
    let live = true
    loadRichEditor().then(() => { if (live) rerender(n => n + 1) }, () => { if (live) rerender(n => n + 1) })
    return () => { live = false }
  }, [wantRich])

  if (!wantRich) return <CodeEditor {...props} />
  if (failed) return <>
    <CodeEditor {...props} />
    <p className="helper editor-fallback" role="note">The rich editor couldn’t load, so this is the plain editor.</p>
  </>
  // While CodeMirror loads, show the code read-only so nothing typed is lost in the swap.
  if (!rich) return <div aria-busy="true"><CodeEditor {...props} readOnly /></div>
  const Loaded = rich
  return <>
    <Loaded {...props} interview={props.interview ?? prefs.interview} />
    {props.interview === undefined && !props.readOnly && <label className="interview-toggle">
      <input type="checkbox" checked={prefs.interview} onChange={event => setPrefs({ interview: event.target.checked })} />
      Interview mode <span className="muted">· no autocomplete or auto-closing brackets</span>
    </label>}
  </>
}
