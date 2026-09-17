import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyProgress, parseBackup, STORAGE_KEY, writeProgress } from './progress'
import type { Progress } from './progress'

function message(error: unknown) {
  return error instanceof Error ? error.message : 'The browser could not access storage.'
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return { progress: raw === null ? emptyProgress() : parseBackup(raw), raw, error: '', recovery: false }
  } catch (error) {
    return { progress: emptyProgress(), raw: null, error: message(error), recovery: true }
  }
}

export function useProgress() {
  const [initial] = useState(load)
  const [progress, setProgress] = useState(initial.progress)
  const [error, setError] = useState(initial.error)
  const [recovery, setRecovery] = useState(initial.recovery)
  const [unsaved, setUnsaved] = useState(false)
  const [conflict, setConflict] = useState(false)
  const lastRaw = useRef(initial.raw)
  const current = useRef(progress)
  current.current = progress

  const persist = useCallback((next: Progress) => {
    try {
      if (recovery) throw new Error('Resolve the existing backup problem before saving new progress.')
      if (window.localStorage.getItem(STORAGE_KEY) !== lastRaw.current) {
        setConflict(true)
        throw new Error('Progress changed in another tab. Export this tab’s work before reloading to use the saved version.')
      }
      writeProgress(window.localStorage, next)
      lastRaw.current = JSON.stringify(next)
      setError('')
      setUnsaved(false)
      return true
    } catch (cause) {
      setError(message(cause))
      setUnsaved(true)
      return false
    }
  }, [recovery])

  const update = useCallback((change: (value: Progress) => Progress) => {
    const next = { ...change(current.current), updatedAt: new Date().toISOString() }
    current.current = next
    setProgress(next)
    persist(next)
  }, [persist])

  const replace = useCallback((next: Progress) => {
    try {
      writeProgress(window.localStorage, next)
      lastRaw.current = JSON.stringify(next)
      current.current = next
      setProgress(next)
      setError('')
      setUnsaved(false)
      setRecovery(false)
      setConflict(false)
      return true
    } catch (cause) {
      setError(`Backup was not applied. Existing progress is unchanged. ${message(cause)}`)
      return false
    }
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if ((event.key === STORAGE_KEY || event.key === null) && event.storageArea === window.localStorage && event.newValue !== lastRaw.current) {
        setConflict(true)
        setError('Progress changed in another tab. Export this tab’s work before reloading to use the saved version.')
      }
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved) event.preventDefault()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [unsaved])

  return { progress, update, replace, error, recovery, unsaved, conflict, retry: () => persist(current.current) }
}
