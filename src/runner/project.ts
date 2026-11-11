import { deepEqual, OUTPUT_LIMIT, truncate, type CaseProgress, type PythonRuntime } from './core'
import type { TypeScriptApi } from './ts-core'
import type * as TS from 'typescript'

/** A multi-file project run: every file of a practice codebase plus the test files to run, in order. */
export interface ProjectRunRequest {
  /** Path → file text. Paths are relative ("cart.ts", "tests/test_cart.py") with forward slashes. */
  files: Record<string, string>
  /** The test files whose `test*` functions run, in this order. */
  tests: string[]
}

export interface ProjectOutcome {
  /** The test file and function, e.g. "test_store.py::test_restock". */
  name: string
  file: string
  pass: boolean
  error?: string
  ms: number
}

/** A problem in one file found before any test ran (a syntax or type error). */
export interface ProjectDiagnostic {
  file: string
  line: number
  column: number
  message: string
  code?: number
}

export type ProjectResponse =
  | { kind: 'done'; outcomes: ProjectOutcome[]; output: string; diagnostics?: ProjectDiagnostic[] }
  | { kind: 'error'; error: string; output: string; diagnostics?: ProjectDiagnostic[] }

/** Longer than single-function runs: a project imports several modules and runs a whole suite. */
export const PROJECT_TIMEOUT_MS = { py: 15_000, ts: 10_000 } as const

export function formatProjectDiagnostic(diagnostic: ProjectDiagnostic): string {
  return `${diagnostic.file} line ${diagnostic.line}:${diagnostic.column} · ${diagnostic.code ? `TS${diagnostic.code}: ` : ''}${diagnostic.message}`
}

const isTestName = (name: string) => /^test/.test(name)

/* ------------------------------------------------------------------ Python */

/**
 * Loaded once per Python worker. Each run writes the files to a fresh folder in Pyodide's in-memory file system,
 * puts it first on sys.path and forgets every module imported from an earlier run, so edits always take effect.
 */
export const PY_PROJECT_HARNESS = `
import sys as _dp_sys, os as _dp_os, json as _dp_json, importlib as _dp_importlib, traceback as _dp_tb, linecache as _dp_linecache
_dp_project = {'n': 0, 'root': None}
_DP_PREFIX = '/tmp/devprep-project-'

def _dp_project_setup(files_json):
    files = _dp_json.loads(files_json)
    for name, module in list(_dp_sys.modules.items()):
        path = getattr(module, '__file__', None) or ''
        if not path:
            try:
                path = str(list(getattr(module, '__path__', None) or [''])[0])
            except BaseException:
                path = ''
        if path.startswith(_DP_PREFIX):
            del _dp_sys.modules[name]
    _dp_sys.path[:] = [p for p in _dp_sys.path if not str(p).startswith(_DP_PREFIX)]
    _dp_project['n'] += 1
    root = _DP_PREFIX + str(_dp_project['n'])
    _dp_project['root'] = root
    errors = []
    for path, text in files.items():
        full = root + '/' + path
        _dp_os.makedirs(_dp_os.path.dirname(full), exist_ok=True)
        with open(full, 'w') as handle:
            handle.write(text)
        if path.endswith('.py'):
            try:
                compile(text, path, 'exec')
            except SyntaxError as error:
                errors.append({'file': path, 'line': error.lineno or 1, 'column': error.offset or 1, 'message': type(error).__name__ + ': ' + str(error.msg)})
    _dp_sys.path.insert(0, root)
    _dp_importlib.invalidate_caches()
    _dp_linecache.clearcache()
    return _dp_json.dumps(errors)

def _dp_module_name(path):
    return path[:-3].replace('/', '.')

def _dp_where(error):
    root = _dp_project['root'] + '/'
    frames = [f for f in _dp_tb.extract_tb(error.__traceback__) if f.filename.startswith(root)]
    if not frames:
        return ''
    last = frames[-1]
    source = (last.line or '').strip()
    return last.filename[len(root):] + ' line ' + str(last.lineno) + (': ' + source if source else '')

def _dp_describe(error):
    text = type(error).__name__ + (': ' + str(error) if str(error) else '')
    where = _dp_where(error)
    return text + ('\\n  at ' + where if where else '')

def _dp_project_collect(path):
    try:
        module = _dp_importlib.import_module(_dp_module_name(path))
    except BaseException as error:
        return _dp_json.dumps({'error': 'Could not import ' + path + ': ' + _dp_describe(error)})
    tests = [(name, fn) for name, fn in vars(module).items() if name.startswith('test') and callable(fn) and getattr(fn, '__module__', None) == module.__name__]
    tests.sort(key=lambda item: getattr(getattr(item[1], '__code__', None), 'co_firstlineno', 0))
    return _dp_json.dumps({'tests': [name for name, _ in tests]})

def _dp_project_call(path, name):
    module = _dp_sys.modules[_dp_module_name(path)]
    try:
        getattr(module, name)()
        return _dp_json.dumps({'pass': True})
    except BaseException as error:
        return _dp_json.dumps({'pass': False, 'error': _dp_describe(error)})
`

type PyFn = ((...args: unknown[]) => unknown) & { destroy?: () => void }

/** Runs a Python project's tests through the harness, one JavaScript call per test so progress can be reported. */
export function runPythonProject(py: PythonRuntime, { files, tests }: ProjectRunRequest, flushOutput: () => string = () => '', onCase: CaseProgress = () => {}): ProjectResponse {
  const globals = py.globals as { get(name: string): unknown }
  const setup = globals.get('_dp_project_setup') as PyFn
  const collect = globals.get('_dp_project_collect') as PyFn
  const call = globals.get('_dp_project_call') as PyFn
  try {
    const diagnostics = JSON.parse(String(setup(JSON.stringify(files)))) as ProjectDiagnostic[]
    if (diagnostics.length) return { kind: 'error', error: `Syntax error${diagnostics.length > 1 ? 's' : ''}: ${diagnostics.map(formatProjectDiagnostic).join('\n')}`, output: truncate(flushOutput(), OUTPUT_LIMIT), diagnostics }
    const outcomes: ProjectOutcome[] = []
    for (const file of tests) {
      if (files[file] === undefined) continue
      const found = JSON.parse(String(collect(file))) as { tests?: string[]; error?: string }
      if (found.error) {
        outcomes.push({ name: `${file}::(import)`, file, pass: false, error: found.error, ms: 0 })
        onCase(outcomes.length)
        continue
      }
      for (const name of found.tests ?? []) {
        const started = performance.now()
        const result = JSON.parse(String(call(file, name))) as { pass: boolean; error?: string }
        outcomes.push({ name: `${file}::${name}`, file, pass: result.pass, ...(result.error ? { error: result.error } : {}), ms: Math.round(performance.now() - started) })
        onCase(outcomes.length)
      }
    }
    return { kind: 'done', outcomes, output: truncate(flushOutput(), OUTPUT_LIMIT) }
  } catch (error) {
    return { kind: 'error', error: error instanceof Error ? error.message : String(error), output: truncate(flushOutput(), OUTPUT_LIMIT) }
  } finally {
    setup.destroy?.(); collect.destroy?.(); call.destroy?.()
  }
}

/* -------------------------------------------------------------- TypeScript */

/** Assertion helpers every TypeScript test file can use without importing them. */
export const TS_PROJECT_DECLARATIONS = `
declare function assert(condition: unknown, message?: string): asserts condition;
declare function assertEqual<T>(actual: T, expected: T, message?: string): void;
declare function assertThrows(fn: () => unknown, match?: string | RegExp): void;
`

/** Normalises "a/./b/../c" to "a/c". Returns undefined for paths that climb above the project root. */
export function normalisePath(path: string): string | undefined {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') { if (!parts.length) return undefined; parts.pop() } else parts.push(part)
  }
  return parts.join('/')
}

const dirname = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

/** The project file a relative import names, trying ".ts" and "/index.ts" like a bundler would. */
export function resolveImport(from: string, specifier: string, has: (path: string) => boolean): string | undefined {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return undefined
  const base = normalisePath(`${dirname(from)}/${specifier}`)
  if (base === undefined) return undefined
  return [base, `${base}.ts`, `${base}/index.ts`].find(has)
}

/** Type-checks every .ts file of a project together, with relative imports between them. */
export function createProjectChecker(ts: TypeScriptApi, libs: Record<string, string>, entryLib: string, runtime: string) {
  const options: TS.CompilerOptions = {
    strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: [entryLib], types: [], noEmit: true, skipLibCheck: true, noFallthroughCasesInSwitch: true,
  }
  const libFiles = new Map<string, TS.SourceFile>()
  const lib = (name: string, text: string) => {
    let file = libFiles.get(name)
    if (!file) { file = ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true); libFiles.set(name, file) }
    return file
  }
  const RUNTIME = '__devprep_runtime.d.ts'
  let previous: TS.Program | undefined

  return function checkProject(files: Record<string, string>): ProjectDiagnostic[] {
    const names = Object.keys(files).filter(name => name.endsWith('.ts'))
    const sources = new Map(names.map(name => [name, ts.createSourceFile(`/${name}`, files[name], ts.ScriptTarget.ES2022, true)]))
    const local = (fileName: string) => fileName.replace(/^\//, '')
    const host: TS.CompilerHost = {
      getSourceFile: fileName => {
        const name = local(fileName)
        if (sources.has(name)) return sources.get(name)
        if (name === RUNTIME) return lib(RUNTIME, `${runtime}\n${TS_PROJECT_DECLARATIONS}`)
        const libName = fileName.replace(/^.*[\\/]/, '')
        return fileName.startsWith('/lib/') && libs[libName] !== undefined ? lib(libName, libs[libName]) : undefined
      },
      getDefaultLibFileName: () => `/lib/${entryLib}`,
      getDefaultLibLocation: () => '/lib',
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: fileName => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: fileName => {
        const name = local(fileName)
        return sources.has(name) || name === RUNTIME || (fileName.startsWith('/lib/') && libs[fileName.slice(5)] !== undefined)
      },
      readFile: fileName => files[local(fileName)] ?? (fileName.startsWith('/lib/') ? libs[fileName.slice(5)] : undefined),
      directoryExists: directory => {
        const name = local(directory)
        return name === '' || name === 'lib' || names.some(file => file.startsWith(`${name}/`))
      },
    }
    const program = ts.createProgram({ rootNames: [...names.map(name => `/${name}`), `/${RUNTIME}`], options, host, oldProgram: previous })
    previous = program
    return names.flatMap(name => {
      const source = sources.get(name)!
      return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(diagnostic => {
        const at = diagnostic.start === undefined ? { line: 0, character: 0 } : source.getLineAndCharacterOfPosition(diagnostic.start)
        return { file: name, line: at.line + 1, column: at.character + 1, code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') }
      })
    })
  }
}

/** Transpiles one project file to CommonJS so the in-worker `require` can load it. */
export function transpileCommonJs(ts: TypeScriptApi, code: string, fileName: string): string {
  return ts.transpileModule(code, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, removeComments: false }, reportDiagnostics: false }).outputText
}

function show(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  try { return truncate(JSON.stringify(value, (_key, item) => item instanceof Map ? Object.fromEntries(item) : item instanceof Set ? [...item] : item) ?? String(value), 300) } catch { return String(value) }
}

class AssertionError extends Error { override name = 'AssertionError' }

const helpers = {
  assert(condition: unknown, message?: string) { if (!condition) throw new AssertionError(message ?? 'assertion failed') },
  assertEqual(actual: unknown, expected: unknown, message?: string) {
    if (!deepEqual(actual, expected)) throw new AssertionError(`${message ? `${message}: ` : ''}expected ${show(expected)}, got ${show(actual)}`)
  },
  assertThrows(fn: () => unknown, match?: string | RegExp) {
    let thrown: unknown
    try { fn() } catch (error) { thrown = error ?? new Error('threw') }
    if (thrown === undefined) throw new AssertionError('expected the call to throw, but it returned')
    const text = thrown instanceof Error ? thrown.message : String(thrown)
    if (match !== undefined && !(typeof match === 'string' ? text.includes(match) : match.test(text))) throw new AssertionError(`expected an error matching ${String(match)}, got "${text}"`)
  },
}

const errorText = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : `Thrown: ${show(error)}`

/**
 * Runs transpiled CommonJS modules with a small `require` that only resolves relative imports between project files.
 * Each run gets a fresh module cache, so no state leaks between runs. Async tests are awaited one at a time.
 */
export async function runCommonJsProject(compiled: Record<string, string>, sources: Record<string, string>, tests: string[], onCase: CaseProgress = () => {}, caseLimitMs = 3000): Promise<ProjectResponse> {
  const output: string[] = []
  let size = 0
  const log = (prefix: string) => (...values: unknown[]) => {
    if (size > OUTPUT_LIMIT) return
    const line = prefix + values.map(value => typeof value === 'string' ? value : show(value)).join(' ')
    size += line.length + 1
    output.push(line)
  }
  const console = { log: log(''), info: log(''), debug: log(''), warn: log('Warning: '), error: log('Error: ') }
  const cache = new Map<string, { exports: Record<string, unknown> }>()
  const has = (path: string) => compiled[path] !== undefined
  const load = (path: string) => {
    const cached = cache.get(path)
    if (cached) return cached.exports
    const module = { exports: {} as Record<string, unknown> }
    cache.set(path, module)
    const require = (specifier: string) => {
      const target = resolveImport(path, specifier, has)
      if (!target) throw new Error(`Cannot find module "${specifier}" from ${path}. Only relative imports between this codebase's files work here.`)
      return load(target)
    }
    const run = new Function('exports', 'require', 'module', 'console', 'assert', 'assertEqual', 'assertThrows', `${compiled[path]}\n//# sourceURL=${path}`)
    run(module.exports, require, module, console, helpers.assert, helpers.assertEqual, helpers.assertThrows)
    return module.exports
  }
  const outcomes: ProjectOutcome[] = []
  const text = () => truncate(output.join('\n'), OUTPUT_LIMIT)
  for (const file of tests) {
    if (!has(file)) continue
    let exports: Record<string, unknown>
    try {
      exports = load(file)
    } catch (error) {
      outcomes.push({ name: `${file}::(import)`, file, pass: false, error: `Could not load ${file}: ${errorText(error)}`, ms: 0 })
      onCase(outcomes.length)
      continue
    }
    const source = sources[file] ?? ''
    const position = (name: string) => { const at = source.search(new RegExp(`function\\s+${name}\\b`)); return at < 0 ? Infinity : at }
    const names = Object.keys(exports).filter(name => isTestName(name) && typeof exports[name] === 'function').sort((a, b) => position(a) - position(b))
    for (const name of names) {
      const started = performance.now()
      let error: string | undefined
      try {
        const value = (exports[name] as () => unknown)()
        if (value instanceof Promise) {
          let timer: ReturnType<typeof setTimeout> | undefined
          await Promise.race([value, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out after ${caseLimitMs / 1000} s`)), caseLimitMs) })])
            .finally(() => clearTimeout(timer))
        }
      } catch (caught) {
        error = errorText(caught)
      }
      outcomes.push({ name: `${file}::${name}`, file, pass: error === undefined, ...(error ? { error } : {}), ms: Math.round(performance.now() - started) })
      onCase(outcomes.length)
    }
  }
  return { kind: 'done', outcomes, output: text() }
}

/** Checks, transpiles and runs a TypeScript project. Type errors are reported but the tests still run, as in the labs. */
export async function runTypeScriptProject(ts: TypeScriptApi, checkProject: (files: Record<string, string>) => ProjectDiagnostic[], { files, tests }: ProjectRunRequest, onCase: CaseProgress = () => {}): Promise<ProjectResponse> {
  let diagnostics: ProjectDiagnostic[]
  try {
    diagnostics = checkProject(files)
  } catch (error) {
    return { kind: 'error', error: error instanceof Error ? error.message : String(error), output: '' }
  }
  // Syntax errors (TS1xxx) would make the transpiled code meaningless, so stop before running anything.
  const syntax = diagnostics.filter(item => item.code !== undefined && item.code < 2000)
  if (syntax.length) return { kind: 'error', error: `Syntax error${syntax.length > 1 ? 's' : ''}:\n${syntax.map(formatProjectDiagnostic).join('\n')}`, output: '', diagnostics }
  const compiled = Object.fromEntries(Object.entries(files).filter(([name]) => name.endsWith('.ts')).map(([name, code]) => [name, transpileCommonJs(ts, code, name)]))
  const response = await runCommonJsProject(compiled, files, tests, onCase)
  return diagnostics.length ? { ...response, diagnostics } : response
}
