import type { PGlite } from '@electric-sql/pglite'
import { resetDb, runSql, type SqlDb, type SqlRunRequest } from './sql-core'

export type SqlWorkerMessage = { type: 'init'; baseURL: string } | ({ type: 'run' } & SqlRunRequest)

const scope = self as unknown as DedicatedWorkerGlobalScope
let database: Promise<PGlite> | undefined

function load(baseURL: string) {
  database ??= (async () => {
    // PGlite is served from pglite/<version>/ and finds its wasm and data files next to index.js.
    const { PGlite } = await import(/* @vite-ignore */ `${baseURL}index.js`) as typeof import('@electric-sql/pglite')
    const db = await PGlite.create()
    await resetDb(db as unknown as SqlDb)
    return db
  })()
  return database
}

scope.onmessage = async (event: MessageEvent<SqlWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      await load(message.baseURL)
      scope.postMessage({ type: 'ready' })
    } catch (error) {
      database = undefined
      scope.postMessage({ type: 'load-error', error: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  const { type: _type, ...request } = message
  try {
    const db = await database!
    scope.postMessage({ type: 'result', result: await runSql(db as unknown as SqlDb, request) })
  } catch (error) {
    // The database could not be reset, so ask the page to restart this worker.
    scope.postMessage({ type: 'result', fatal: true, result: { kind: 'error', error: error instanceof Error ? error.message : String(error) } })
  }
}
