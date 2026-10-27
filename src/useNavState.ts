import { useCallback, useEffect, useState } from 'react'

export const NAV_KEY = 'devprep.nav.v1'
const DEFAULT_OPEN = ['learn', 'practise', 'design', 'interview', 'me']

interface NavState { expanded: string[]; collapsed: boolean }

function read(): NavState {
  try {
    const saved = JSON.parse(window.localStorage.getItem(NAV_KEY) ?? 'null') as Partial<NavState> | null
    if (saved && Array.isArray(saved.expanded)) return { expanded: saved.expanded.filter(id => typeof id === 'string'), collapsed: saved.collapsed === true }
  } catch { /* A bad or blocked value falls back to the defaults. */ }
  return { expanded: DEFAULT_OPEN, collapsed: false }
}

/** Which tree branches are open and whether the desktop sidebar is collapsed. A UI preference only: not in backups. */
export function useNavState() {
  const [state, setState] = useState(read)
  useEffect(() => {
    try { window.localStorage.setItem(NAV_KEY, JSON.stringify(state)) } catch { /* Storage is optional for this preference. */ }
  }, [state])
  const setOpen = useCallback((ids: readonly string[], open: boolean) => setState(value => {
    const next = new Set(value.expanded)
    for (const id of ids) if (open) next.add(id); else next.delete(id)
    return next.size === value.expanded.length && ids.every(id => value.expanded.includes(id) === open) ? value : { ...value, expanded: [...next] }
  }), [])
  const setCollapsed = useCallback((collapsed: boolean) => setState(value => ({ ...value, collapsed })), [])
  return { expanded: new Set(state.expanded), collapsed: state.collapsed, setOpen, setCollapsed }
}
