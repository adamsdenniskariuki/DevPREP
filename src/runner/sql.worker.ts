import type { PGlite } from '@electric-sql/pglite'
import { resetDb, resetFreeDb, runFreeSql, runSql, startFreeSession, type SqlDb, type SqlRunRequest } from './sql-core'

export type SqlWorkerMessage =
  | { type: 'init'; baseURL: string }
  | ({ type: 'run' } & SqlRunRequest)
  /** Playground: open the persistent database, run SQL on it, or empty it. */
  | { type: 'play-init' }
  | { type: 'play-run'; sql: string }
  | { type: 'play-reset' }

/** The Playground database lives in IndexedDB, apart from the throwaway exercise database. */
export const PLAYGROUND_DATA_DIR = 'idb://devprep-playground'

const scope = self as unknown as DedicatedWorkerGlobalScope
let pglite: Promise<typeof import('@electric-sql/pglite')> | undefined
let database: Promise<PGlite> | undefined
let playground: Promise<PGlite> | undefined

function load(baseURL: string) {
  // PGlite is served from pglite/<version>/ and finds its wasm and data files next to index.js.
  pglite ??= import(/* @vite-ignore */ `${baseURL}index.js`) as Promise<typeof import('@electric-sql/pglite')>
  database ??= (async () => {
    const { PGlite } = await pglite!
    const db = await PGlite.create()
    await resetDb(db as unknown as SqlDb)
    return db
  })()
  return database
}

function openPlayground() {
  playground ??= (async () => {
    const { PGlite } = await pglite!
    const db = await PGlite.create(PLAYGROUND_DATA_DIR)
    await startFreeSession(db as unknown as SqlDb)
    return db
  })()
  return playground
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

scope.onmessage = async (event: MessageEvent<SqlWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      await load(message.baseURL)
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      database = undefined
      pglite = undefined
      scope.postMessage({ type: 'load-error', error: errorMessage(error) })
    }
    return
  }
  if (message.type === 'play-init') {
    try {
      await openPlayground()
      scope.postMessage({ type: 'play-ready' })
    } catch (error) {
      playground = undefined
      scope.postMessage({ type: 'load-error', error: `The Playground database could not open: ${errorMessage(error)}` })
    }
    return
  }
  if (message.type === 'play-run' || message.type === 'play-reset') {
    try {
      const db = await openPlayground() as unknown as SqlDb
      if (message.type === 'play-reset') {
        await resetFreeDb(db)
        scope.postMessage({ type: 'play-result', result: { kind: 'done', results: [], ms: 0 } })
      } else {
        scope.postMessage({ type: 'play-result', result: await runFreeSql(db, message.sql) })
      }
    } catch (error) {
      scope.postMessage({ type: 'play-result', fatal: true, result: { kind: 'error', error: errorMessage(error), ms: 0 } })
    }
    return
  }
  const { type: _type, ...request } = message
  try {
    const db = await database!
    scope.postMessage({ type: 'result', result: await runSql(db as unknown as SqlDb, request) })
  } catch (error) {
    // The database could not be reset, so ask the page to restart this worker.
    scope.postMessage({ type: 'result', fatal: true, result: { kind: 'error', error: errorMessage(error) } })
  }
}