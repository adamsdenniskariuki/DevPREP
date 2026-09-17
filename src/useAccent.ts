import { useState } from 'react'
import { parseAccent, writeAccent } from './accent-preference'
import type { Accent } from './accent-preference'

function initialAccent() {
  const root = document.documentElement
  const error = root.dataset.accentError === 'invalid'
    ? 'The saved accent preference is invalid. Red (rose) is shown; choose an accent or save the current one to replace only this preference.'
    : root.dataset.accentError
      ? 'The accent preference could not be read from browser storage. Red (rose) is shown; you can try saving an accent.'
      : ''
  return { accent: parseAccent(root.dataset.accent ?? null), error }
}

export function useAccent() {
  const [initial] = useState(initialAccent)
  const [accent, setAccent] = useState(initial.accent)
  const [error, setError] = useState(initial.error)

  function save(next: Accent) {
    try {
      writeAccent(window.localStorage, next)
      delete document.documentElement.dataset.accentError
      setError('')
    } catch (cause) {
      setError(`Accent was not saved. This tab uses your choice, but reloading may restore the previous accent. ${cause instanceof Error ? cause.message : 'Browser storage is unavailable.'}`)
    }
  }

  function choose(value: string) {
    try {
      const next = parseAccent(value)
      document.documentElement.dataset.accent = next
      setAccent(next)
      save(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This accent could not be selected.')
    }
  }

  return { accent, error, choose, retry: () => save(accent) }
}
