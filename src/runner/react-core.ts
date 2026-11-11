import type { TypeScriptApi } from './ts-core'
import type { ProjectDiagnostic } from './project'

/** The two files of a React exercise: the learner's component and the checking tests. */
export const REACT_APP_FILE = 'App.tsx'
export const REACT_TEST_FILE = 'App.test.tsx'

/** Whole-run limit, including mounting React in the sandbox. Each test also has its own limit. */
export const REACT_TIMEOUT_MS = 12_000
export const REACT_TEST_TIMEOUT_MS = 2_000

export interface ReactCompileResult {
  /** Module name ("./App", "./App.test") → CommonJS code. Empty when there are syntax errors. */
  modules: Record<string, string>
  diagnostics: ProjectDiagnostic[]
}

/**
 * Inserts `__guard()` at the top of every loop body, so a runaway loop throws instead of freezing the page
 * (a sandboxed iframe may share the app's thread).
 */
function loopGuard(ts: TypeScriptApi): import('typescript').TransformerFactory<import('typescript').SourceFile> {
  return context => {
    const f = context.factory
    const guarded = (body: import('typescript').Statement) => f.createBlock([
      f.createExpressionStatement(f.createCallExpression(f.createIdentifier('__guard'), undefined, [])),
      ...ts.isBlock(body) ? body.statements : [body],
    ], true)
    const visit = (node: import('typescript').Node): import('typescript').Node => {
      const next = ts.visitEachChild(node, visit, context)
      if (ts.isForStatement(next)) return f.updateForStatement(next, next.initializer, next.condition, next.incrementor, guarded(next.statement))
      if (ts.isForInStatement(next)) return f.updateForInStatement(next, next.initializer, next.expression, guarded(next.statement))
      if (ts.isForOfStatement(next)) return f.updateForOfStatement(next, next.awaitModifier, next.initializer, next.expression, guarded(next.statement))
      if (ts.isWhileStatement(next)) return f.updateWhileStatement(next, next.expression, guarded(next.statement))
      if (ts.isDoStatement(next)) return f.updateDoStatement(next, guarded(next.statement), next.expression)
      return next
    }
    return source => ts.visitNode(source, visit) as import('typescript').SourceFile
  }
}

/** Compiles each TSX file to CommonJS with the automatic JSX runtime, reporting syntax errors with positions. */
export function compileReact(ts: TypeScriptApi, files: Record<string, string>): ReactCompileResult {
  const modules: Record<string, string> = {}
  const diagnostics: ProjectDiagnostic[] = []
  for (const [file, source] of Object.entries(files)) {
    const output = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, removeComments: false },
      transformers: { before: [loopGuard(ts)] },
    })
    for (const diagnostic of output.diagnostics ?? []) {
      const at = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : { line: 0, character: 0 }
      diagnostics.push({ file, line: at.line + 1, column: at.character + 1, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), code: diagnostic.code })
    }
    modules[`./${file.replace(/\.[jt]sx?$/, '')}`] = output.outputText
  }
  return { modules: diagnostics.length ? {} : modules, diagnostics }
}
