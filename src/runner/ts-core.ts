import type * as TS from 'typescript'
import type { TypeDiagnostic } from './core'

export type TypeScriptApi = typeof TS
export { TYPESCRIPT_VERSION } from './ts-version'

export const TS_ENTRY_LIB = 'lib.es2023.d.ts'
export const TS_FILE = 'solution.ts'

/** Host globals available in the runner (workers and Node both provide them), typed without pulling in the DOM lib. */
export const TS_RUNTIME_DECLARATIONS = `
interface Console { log(...data: any[]): void; info(...data: any[]): void; warn(...data: any[]): void; error(...data: any[]): void; debug(...data: any[]): void }
declare var console: Console;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
declare function structuredClone<T>(value: T): T;
`

export type TsDiagnostic = TypeDiagnostic

/** Lib file names reachable from the entry lib through `/// <reference lib>` (lib.es5 also pulls in the decorator libs). */
export function libClosure(read: (fileName: string) => string, entry = TS_ENTRY_LIB): string[] {
  const seen = new Set<string>()
  const visit = (fileName: string) => {
    if (seen.has(fileName)) return
    seen.add(fileName)
    for (const match of read(fileName).matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"/g)) visit(`lib.${match[1].toLowerCase()}.d.ts`)
  }
  visit(entry)
  return [...seen].sort()
}

/** Type-checks and transpiles learner code with an in-memory compiler host. Lib files are parsed once and reused. */
export function createTsCompiler(ts: TypeScriptApi, libs: Record<string, string>) {
  const options: TS.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    lib: [TS_ENTRY_LIB],
    types: [],
    noEmit: true,
    skipLibCheck: true,
    noFallthroughCasesInSwitch: true,
    exactOptionalPropertyTypes: false,
  }
  const files = new Map<string, TS.SourceFile>()
  const fixed = (fileName: string, text: string) => {
    let file = files.get(fileName)
    if (!file) { file = ts.createSourceFile(fileName, text, ts.ScriptTarget.ES2022, true); files.set(fileName, file) }
    return file
  }
  const RUNTIME = 'runtime.d.ts'
  let previous: TS.Program | undefined

  function check(code: string): TsDiagnostic[] {
    const source = ts.createSourceFile(TS_FILE, code, ts.ScriptTarget.ES2022, true)
    const host: TS.CompilerHost = {
      getSourceFile: fileName => {
        const name = fileName.replace(/^.*[\\/]/, '')
        if (name === TS_FILE) return source
        if (name === RUNTIME) return fixed(RUNTIME, TS_RUNTIME_DECLARATIONS)
        return libs[name] === undefined ? undefined : fixed(name, libs[name])
      },
      getDefaultLibFileName: () => `/lib/${TS_ENTRY_LIB}`,
      getDefaultLibLocation: () => '/lib',
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: fileName => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: fileName => {
        const name = fileName.replace(/^.*[\\/]/, '')
        return name === TS_FILE || name === RUNTIME || libs[name] !== undefined
      },
      readFile: fileName => libs[fileName.replace(/^.*[\\/]/, '')],
    }
    const program = ts.createProgram({ rootNames: [`/${TS_FILE}`, `/${RUNTIME}`], options, host, oldProgram: previous })
    previous = program
    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map(diagnostic => {
      const at = diagnostic.start === undefined ? { line: 0, character: 0 } : source.getLineAndCharacterOfPosition(diagnostic.start)
      return { line: at.line + 1, column: at.character + 1, code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') }
    })
  }

  function transpile(code: string): string {
    return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, removeComments: false }, reportDiagnostics: false }).outputText
  }

  /** Transpiles with a source map, so runtime errors can point at the learner's TypeScript line. */
  function transpileMapped(code: string): { code: string; mappings: string } {
    const output = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, removeComments: false, sourceMap: true }, reportDiagnostics: false })
    let mappings = ''
    try { mappings = (JSON.parse(output.sourceMapText ?? '{}') as { mappings?: string }).mappings ?? '' } catch { /* no map */ }
    return { code: output.outputText.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'), mappings }
  }

  return { check, transpile, transpileMapped }
}

export function formatDiagnostic(diagnostic: TsDiagnostic): string {
  return `Line ${diagnostic.line}:${diagnostic.column} · TS${diagnostic.code}: ${diagnostic.message}`
}

/**
 * Checks learner code followed by an exercise's type-check block in one program. Errors on the learner's lines are
 * ordinary diagnostics; errors inside the block (including unused `@ts-expect-error` directives) fail the type checks.
 */
export function checkWithTypeChecks(check: (code: string) => TsDiagnostic[], code: string, typeChecks?: string) {
  if (!typeChecks) return { diagnostics: check(code), typeChecks: undefined }
  const offset = code.split('\n').length + 1
  const all = check(`${code}\n\n${typeChecks}`)
  const errors = all.filter(item => item.line > offset).map(item => ({ ...item, line: item.line - offset }))
  return { diagnostics: all.filter(item => item.line <= offset), typeChecks: { pass: errors.length === 0, errors } }
}
