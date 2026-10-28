import { useState } from 'react'
import { saveAsSnippet, type SnippetLang } from '../playground'
import Icon from './Icon'

/** Copies code into a new Playground snippet and opens it. */
export default function OpenInPlayground({ lang, name, code }: { lang: SnippetLang; name: string; code: string }) {
  const [error, setError] = useState('')
  function open() {
    try {
      const id = saveAsSnippet(lang, name, code)
      window.location.hash = `#playground/${id}`
    } catch (problem) {
      setError((problem as Error).message)
    }
  }
  return <>
    <button type="button" onClick={open}><Icon name="code" size={16} />Open in Playground</button>
    {error && <span className="helper open-playground-error" role="alert">{error}</span>}
  </>
}
