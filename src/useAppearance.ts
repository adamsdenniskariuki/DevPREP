import { useEffect, useState } from 'react'
import { APPEARANCE_KEY, parseAppearance, resolveTheme, writeAppearance } from './appearance'
import type { Appearance } from './appearance'

function readSaved(): Appearance {
  try { return parseAppearance(window.localStorage.getItem(APPEARANCE_KEY)) } catch { return parseAppearance(null) }
}

function apply(appearance: Appearance) {
  const root = document.documentElement
  const param = new URLSearchParams(window.location.search).get('scoutTheme')
  root.dataset.theme = resolveTheme(appearance.mode, param, window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.dataset.palette = appearance.palette
  root.dataset.font = appearance.font
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(readSaved)
  const [error, setError] = useState('')

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => {
      if (appearance.mode !== 'system') return
      const param = new URLSearchParams(window.location.search).get('scoutTheme')
      if (param !== 'light' && param !== 'dark') document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
    }
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [appearance.mode])

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch }
    if (patch.mode) {
      // A newly chosen mode replaces any one-off ?scoutTheme= override in this tab.
      const url = new URL(window.location.href)
      if (url.searchParams.has('scoutTheme')) {
        url.searchParams.delete('scoutTheme')
        window.history.replaceState(null, '', url)
      }
    }
    setAppearance(next)
    apply(next)
    try {
      writeAppearance(window.localStorage, next)
      setError('')
    } catch {
      setError('Appearance was not saved. It applies to this tab only.')
    }
  }

  return { appearance, error, update }
}
