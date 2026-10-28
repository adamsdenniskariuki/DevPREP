import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { getLearningPath } from './learning-paths'
import { formatBytes, MAX_FULL_BACKUP_BYTES, parseFullBackup, serializeFullBackup } from './board-backup'
import type { FullBackup } from './board-backup'
import { listBoards, replaceBoards } from './boards'
import { download } from './download'
import { readSnippets, writeSnippets } from './playground'
import { emptyProgress, serializeBackup, STORAGE_KEY } from './progress'
import type { Progress } from './progress'

const plural = (count: number) => `${count} ${count === 1 ? 'whiteboard' : 'whiteboards'}`
const snippetPlural = (count: number) => `${count} Playground ${count === 1 ? 'snippet' : 'snippets'}`

/** Loaded on demand so backups with whiteboards add nothing to the main bundle. Returns the file text and a notice. Playground snippets always ride along. */
export async function backupText(progress: Progress, includeBoards: boolean): Promise<{ text: string; notice: string }> {
  const boards = includeBoards ? await listBoards() : []
  const snippets = readSnippets()
  // With no boards or snippets the file keeps the original format, so restoring it never wipes them on another device.
  if (!boards.length && !snippets.length) return { text: serializeBackup(progress), notice: 'Backup downloaded. It includes your written answers.' }
  const text = serializeFullBackup(progress, boards.length ? boards : undefined, snippets)
  const extras = [...boards.length ? [plural(boards.length)] : [], ...snippets.length ? [snippetPlural(snippets.length)] : []].join(' and ')
  return { text, notice: `Backup downloaded with ${extras} (${formatBytes(new TextEncoder().encode(text).length)}). It includes your written answers.` }
}

const reason = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

/** Downloads a backup and returns the notice to show. Errors carry the message for the user. */
export async function exportBackup(progress: Progress, includeBoards: boolean, today: string): Promise<string> {
  try {
    const { text, notice } = await backupText(progress, includeBoards)
    download(text, `devprep-backup-${today}.json`)
    return notice
  } catch (error) {
    throw new Error(`The backup could not be downloaded. ${reason(error, 'Please allow downloads in your browser and try again.')}`)
  }
}

/** Reads and checks a backup file before the confirmation dialog. */
export async function importBackup(file: File): Promise<FullBackup> {
  try {
    return await readBackup(file)
  } catch (error) {
    throw new Error(`${reason(error, 'Unable to read this file.')} Existing progress was not changed.`)
  }
}

/** Downloads the raw stored progress exactly as it is, for the recovery screen. */
export function recoveryExport(today: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) throw new Error('No saved data is available in this browser.')
    download(raw, `devprep-recovery-${today}.json`)
  } catch (error) {
    throw new Error(reason(error, 'Could not read the stored data.'))
  }
}

export async function readBackup(file: File): Promise<FullBackup> {
  if (file.size > MAX_FULL_BACKUP_BYTES) throw new Error('Backup must be 24 MB or smaller (1 MB of progress, 20 MB of whiteboards and 2 MB of Playground snippets).')
  return parseFullBackup(await file.text())
}

interface ImportDialogProps {
  backup: FullBackup
  cancel: () => void
  /** Applies the progress; false if it could not be saved. */
  replace: (progress: Progress) => boolean
  restored: (notice: string) => void
  fail: (error: string) => void
}

/** Confirms a backup import. A backup with whiteboards or snippets replaces this device's; one without leaves them alone. */
export default function ImportDialog({ backup, cancel, replace, restored, fail }: ImportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const { progress, boards, playground } = backup
  function confirm() {
    if (!replace(progress)) return
    if (playground && !writeSnippets(playground)) return fail('Progress was restored, but the Playground snippets were not: this browser would not save them.')
    if (!boards) return restored('Backup restored. Your lessons, reviews, and unfinished session are ready.')
    replaceBoards(boards).then(
      () => restored(`Backup restored with ${plural(boards.length)}. Your lessons, reviews, and unfinished session are ready.`),
      error => fail(`Progress was restored, but the whiteboards were not. ${error instanceof Error ? error.message : ''}`.trim()))
  }
  return <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title" onCancel={cancel}>
    <h2 id="import-title">Replace this browser’s progress?</h2>
    <p>This backup contains {Object.keys(progress.records).length} completed lessons{progress.session ? ' and an unfinished session' : ''}. It will replace, not merge with, your current progress.</p>
    <p>Learning path after import: {getLearningPath(progress.selectedPath)?.title ?? 'All curriculum (no path selected)'}. The backup replaces this choice too.</p>
    <p>{boards ? `It also has ${plural(boards.length)}. They replace the whiteboards on this device.` : 'It has no whiteboards. Whiteboards on this device are kept.'}</p>
    <p>{playground ? `It also has ${snippetPlural(playground.length)}. They replace the snippets on this device.` : 'It has no Playground snippets. Snippets on this device are kept.'}</p>
    <p>Export your current progress first if you want to keep both versions.</p>
    <div className="button-row"><button autoFocus onClick={cancel}>Cancel import</button><button className="primary" onClick={confirm}>Replace progress</button></div>
  </dialog>
}

interface RecoveryProps {
  heading: RefObject<HTMLHeadingElement | null>
  today: string
  /** The export/import buttons, shared with Settings. */
  controls: ReactNode
  replace: (progress: Progress) => boolean
  fail: (error: unknown) => void
  children: ReactNode
}

/** Shown when stored progress can't be read. Loaded on demand because almost nobody needs it. */
export function Recovery({ heading, today, controls, replace, fail, children }: RecoveryProps) {
  useEffect(() => { heading.current?.focus() }, [heading])
  function download() {
    try { recoveryExport(today) } catch (error) { fail(error) }
  }
  return <section className="card recovery"><div className="eyebrow">SAFE RECOVERY</div><h1 ref={heading} tabIndex={-1}>Let’s protect your progress.</h1><p>Existing browser data could not be loaded. We have not replaced it. Download the original data before starting over, or restore a valid DevPREP backup.</p><button onClick={download}>Download original data</button>{controls}<button className="text-button" onClick={() => {
    if (window.confirm('Permanently replace unreadable browser data with a fresh start? Download the original data first.')) replace(emptyProgress())
  }}>Replace with a fresh start</button>{children}</section>
}