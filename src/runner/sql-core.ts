/**
 * SQL lab runtime shared by the PGlite worker and the Node tests. Every test case runs on a freshly reset
 * database: exercise schema, then the case's seed rows, then the learner's SQL (and an optional check query).
 * The last statement that returns rows is compared with the expected result table.
 */

export type SqlCell = unknown
export interface SqlTable { columns: string[]; rows: SqlCell[][] }
export interface SqlTest { name: string; seed: string; expected: SqlTable }

export interface SqlRunRequest {
  code: string
  /** DDL (and any base rows) every case starts from. */
  schema: string
  /** Optional query run after the learner's SQL; its result is compared instead (for INSERT/UPDATE/DDL exercises). */
  check?: string
  /** Compare rows in order (the task requires ORDER BY). Otherwise rows compare as a multiset. */
  ordered?: boolean
  cases: SqlTest[]
}

export interface SqlCaseOutcome {
  pass: boolean
  actual?: SqlTable
  error?: string
  /** Why a result table did not match, in plain words. */
  reason?: string
  ms: number
}

export type SqlRunResponse =
  | { kind: 'done'; outcomes: SqlCaseOutcome[] }
  | { kind: 'error'; error: string }

interface SqlField { name: string; dataTypeID: number }
interface SqlResult { rows: unknown[]; fields: SqlField[] }
/** The slice of the PGlite API the runner needs. */
export interface SqlDb {
  exec(sql: string, options?: { rowMode?: 'array' | 'object'; parsers?: Record<number, (value: string, type: number) => unknown> }): Promise<SqlResult[]>
}

export const SQL_TIMEOUT_MS = 8000
export const SQL_ROW_LIMIT = 200
const keepText = (value: string) => value
/** Dates, times and intervals stay as Postgres text (ISO, UTC) so results are stable and easy to write down. */
const PARSERS: Record<number, (value: string) => unknown> = { 1082: keepText, 1083: keepText, 1114: keepText, 1184: keepText, 1186: keepText, 1266: keepText }
const NUMERIC = 1700

const SESSION = `SET TimeZone = 'UTC'; SET DateStyle = 'ISO, YMD'; SET IntervalStyle = 'postgres'; SET client_min_messages = 'error'`
const DROP_SCHEMAS = `DO $$ DECLARE s record; BEGIN
  FOR s IN SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', s.nspname);
  END LOOP;
END $$; CREATE SCHEMA public`

/** Returns the database to a blank public schema with the lab session settings, whatever the last run did. */
export async function resetDb(db: SqlDb) {
  await db.exec('ROLLBACK')
  await db.exec('DISCARD ALL')
  await db.exec(SESSION)
  await db.exec(DROP_SCHEMAS)
}

function normalizeCell(value: unknown, type?: number): unknown {
  if (typeof value === 'bigint') return Number(value)
  if (type === NUMERIC && typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  if (value instanceof Date) return value.toISOString()
  return value
}

function table(result: SqlResult): SqlTable {
  return {
    columns: result.fields.map(field => field.name),
    rows: (result.rows as unknown[][]).slice(0, SQL_ROW_LIMIT + 1).map(row => row.map((cell, index) => normalizeCell(cell, result.fields[index]?.dataTypeID))),
  }
}

/** Runs SQL and returns the last result that has columns (a SELECT, RETURNING or EXPLAIN), if any. */
export async function lastTable(db: SqlDb, sql: string): Promise<SqlTable | undefined> {
  const results = await db.exec(sql, { rowMode: 'array', parsers: PARSERS })
  const last = [...results].reverse().find(result => result.fields.length > 0)
  return last && table(last)
}

function close(a: number, b: number) {
  return a === b || Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Cell equality: numbers within a small tolerance, JSON and arrays structurally, everything else exactly. */
export function cellEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return close(a, b)
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((item, index) => cellEqual(item, (b as unknown[])[index]))
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && cellEqual(left[key], right[key]))
}

function sortKey(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === 'number') return Number(item.toPrecision(10))
    if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    return item
  })
}

/** Compares a result with the expected table. Column names must match; rows compare as a multiset unless ordered. */
export function compareTables(expected: SqlTable, actual: SqlTable, ordered = false): { pass: boolean; reason?: string } {
  if (expected.columns.length !== actual.columns.length || expected.columns.some((name, index) => name !== actual.columns[index])) {
    return { pass: false, reason: `Expected columns (${expected.columns.join(', ')}) but got (${actual.columns.join(', ')}).` }
  }
  if (expected.rows.length !== actual.rows.length) {
    return { pass: false, reason: `Expected ${expected.rows.length} ${expected.rows.length === 1 ? 'row' : 'rows'} but got ${actual.rows.length > SQL_ROW_LIMIT ? `more than ${SQL_ROW_LIMIT}` : actual.rows.length}.` }
  }
  const sort = (rows: SqlCell[][]) => ordered ? rows : [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  const left = sort(expected.rows)
  const right = sort(actual.rows)
  const bad = left.findIndex((row, index) => !cellEqual(row, right[index]))
  if (bad < 0) return { pass: true }
  if (ordered && left.every(row => right.some(other => cellEqual(row, other)))) return { pass: false, reason: 'The rows are right but in the wrong order. Check your ORDER BY.' }
  return { pass: false, reason: ordered ? `Row ${bad + 1} differs.` : 'Some rows differ.' }
}

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message, hint } = error as { message: string; hint?: string }
    return hint ? `${message}\nHint: ${hint}` : message
  }
  return String(error)
}

/** Runs one test case on a fresh database. Setup errors are reported as author errors, not learner errors. */
export async function runSqlCase(db: SqlDb, request: Omit<SqlRunRequest, 'cases'>, test: SqlTest): Promise<SqlCaseOutcome> {
  const started = performance.now()
  const ms = () => Math.round(performance.now() - started)
  await resetDb(db)
  try {
    await db.exec(request.schema)
    if (test.seed.trim()) await db.exec(test.seed)
  } catch (error) {
    return { pass: false, error: `The exercise setup failed: ${errorText(error)}`, ms: ms() }
  }
  let actual: SqlTable | undefined
  try {
    actual = await lastTable(db, request.code)
  } catch (error) {
    return { pass: false, error: errorText(error), ms: ms() }
  }
  if (request.check) {
    try {
      await db.exec('ROLLBACK')
      actual = await lastTable(db, request.check)
    } catch (error) {
      return { pass: false, error: `Your SQL ran, but the check query failed: ${errorText(error)}`, ms: ms() }
    }
  }
  if (!actual) return { pass: false, error: 'Your SQL ran but returned no rows. End with a SELECT.', ms: ms() }
  const { pass, reason } = compareTables(test.expected, actual, request.ordered)
  return { pass, actual: { columns: actual.columns, rows: actual.rows.slice(0, SQL_ROW_LIMIT) }, reason, ms: ms() }
}

export async function runSql(db: SqlDb, request: SqlRunRequest): Promise<SqlRunResponse> {
  if (!request.code.trim()) return { kind: 'error', error: 'Write a query first.' }
  const outcomes: SqlCaseOutcome[] = []
  for (const test of request.cases) outcomes.push(await runSqlCase(db, request, test))
  await resetDb(db)
  return { kind: 'done', outcomes }
}

/** One cell as text: NULL for null, JSON for objects and arrays, everything else as is. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** The rows of a result, one line each with cells joined by " | ". This is the format of SQL predict answers. */
export function formatRows(result: SqlTable): string {
  return result.rows.map(row => row.map(formatCell).join(' | ')).join('\n')
}

/** What a predict-the-output snippet returns: its last result's rows, "(no rows)", or "ERROR: <message>". */
export async function predictOutput(db: SqlDb, code: string): Promise<string> {
  await resetDb(db)
  try {
    const result = await lastTable(db, code)
    if (!result) return '(no result)'
    return result.rows.length ? formatRows(result) : '(no rows)'
  } catch (error) {
    return `ERROR: ${errorText(error).split('\n')[0]}`
  } finally {
    await resetDb(db)
  }
}
