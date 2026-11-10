// Kept in step with the pinned "pyodide" dependency (asserted by src/problems.test.ts).
export const PYODIDE_VERSION = '314.0.7'

/** The vendored NumPy wheel (vendor/pyodide), served beside the runtime. Must match pyodide-lock.json (src/runner/numpy.test.ts). */
export const NUMPY_WHEEL = 'numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl'

/** The only packages learner code may ask for. Each is loaded by the worker before any learner code runs. */
export const PY_PACKAGES = ['numpy'] as const
export type PyPackage = typeof PY_PACKAGES[number]
export const isPyPackage = (name: unknown): name is PyPackage => typeof name === 'string' && (PY_PACKAGES as readonly string[]).includes(name)

/** Packages a Playground program imports (top-level `import numpy` or `from numpy …`), from the allowlist only. */
export function packagesImported(code: string): PyPackage[] {
  return PY_PACKAGES.filter(name => new RegExp(`^\\s*(?:import\\s+${name}\\b|from\\s+${name}(?:\\.|\\s))`, 'm').test(code))
}
