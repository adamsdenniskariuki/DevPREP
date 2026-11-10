import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { approxEqual, isPassing, PY_HARNESS, runPython } from './core'
import { PY_FREE_HARNESS, runPythonFree } from './free'
import { isPyPackage, NUMPY_WHEEL, packagesImported, PY_PACKAGES } from './pyodide-version'

const lock = JSON.parse(readFileSync(resolve('node_modules/pyodide/pyodide-lock.json'), 'utf8')) as { packages: Record<string, { file_name: string; sha256: string; depends: string[] }> }
const wheel = readFileSync(resolve('vendor/pyodide', NUMPY_WHEEL))

describe('vendored NumPy wheel', () => {
  it('is the file the pinned Pyodide lock file names, byte for byte', () => {
    expect(lock.packages.numpy.file_name).toBe(NUMPY_WHEEL)
    expect(createHash('sha256').update(wheel).digest('hex')).toBe(lock.packages.numpy.sha256)
    expect(lock.packages.numpy.depends).toEqual([])
  })

  it('is documented with its source, hash and licence', () => {
    const readme = readFileSync(resolve('vendor/README.md'), 'utf8')
    expect(readme).toContain(NUMPY_WHEEL)
    expect(readme).toContain(lock.packages.numpy.sha256)
    expect(readFileSync(resolve('vendor/pyodide/NUMPY-LICENSE.txt'), 'utf8')).toMatch(/NumPy Developers[\s\S]*Redistribution and use/)
    expect(readFileSync(resolve('.gitattributes'), 'utf8')).toMatch(/^\*\.whl binary$/m)
  })

  it('is served and copied beside the runtime by the Vite plugin', () => {
    const config = readFileSync(resolve('vite.config.ts'), 'utf8')
    expect(config).toMatch(/PYODIDE_FILES = \[[^\]]*NUMPY_WHEEL\]/)
    expect(config).toContain("resolve('vendor/pyodide', name)")
  })
})

describe('package allowlist', () => {
  it('allows NumPy only', () => {
    expect(PY_PACKAGES).toEqual(['numpy'])
    expect(isPyPackage('numpy')).toBe(true)
    for (const name of ['micropip', 'pandas', 'requests', 'NUMPY', '', undefined, 1]) expect(isPyPackage(name), String(name)).toBe(false)
  })

  it('finds top-level NumPy imports in Playground programs', () => {
    expect(packagesImported('import numpy as np\nprint(np.ones(2))')).toEqual(['numpy'])
    expect(packagesImported('x = 1\n  from numpy.linalg import norm')).toEqual(['numpy'])
    expect(packagesImported('from numpy import array')).toEqual(['numpy'])
    expect(packagesImported('import numpyish\n# import numpy\nprint("import numpy")')).toEqual([])
    expect(packagesImported('import pandas')).toEqual([])
  })

  it('the worker checks the allowlist, loads with integrity checks and turns off the network before learner code', () => {
    const worker = readFileSync(resolve('src/runner/py.worker.ts'), 'utf8')
    expect(worker).toContain('isPyPackage(name)')
    expect(worker).toContain('checkIntegrity: true')
    const load = worker.indexOf('py.loadPackage(')
    const block = worker.indexOf('blockNetwork(scope)')
    expect(load).toBeGreaterThan(0)
    expect(block).toBeGreaterThan(load)
    // Network is blocked inside the one-time loader, so it precedes every run and free run.
    expect(worker.slice(block)).toContain('return py')
    expect(worker.indexOf("message.type === 'free'")).toBeGreaterThan(block)
  })
})

describe('tolerant comparison', () => {
  it('matches close numbers anywhere in a value, like math.isclose', () => {
    expect(approxEqual(0.1 + 0.2, 0.3)).toBe(true)
    expect(approxEqual([[1, 2.0000001], { a: 3 }], [[1, 2], { a: 3 }], { abs: 1e-6 })).toBe(true)
    expect(approxEqual([1, 2.1], [1, 2], { abs: 1e-6 })).toBe(false)
    expect(approxEqual(100.5, 100, { rel: 0.01 })).toBe(true)
    expect(approxEqual([1, 2], [1, 2, 3], { abs: 1 })).toBe(false)
    expect(approxEqual('1', 1, { abs: 1 })).toBe(false)
    expect(approxEqual(Number.NaN, Number.NaN, { abs: 1 })).toBe(false)
  })

  it('never passes NaN or Infinity from Python, which JSON cannot parse', () => {
    expect(isPassing({ pass: false, actual: 'NaN', ms: 0 }, 0, { abs: 1 })).toBe(false)
    expect(isPassing({ pass: false, actual: '[1, Infinity]', ms: 0 }, [1, 2], { abs: 1 })).toBe(false)
    expect(isPassing({ pass: false, actual: '0.30000000000000004', ms: 0 }, 0.3)).toBe(false)
    expect(isPassing({ pass: false, actual: '0.30000000000000004', ms: 0 }, 0.3, { abs: 1e-9 })).toBe(true)
  })
})

describe('NumPy in Pyodide', () => {
  let py: PyodideAPI
  beforeAll(async () => {
    py = await loadPyodide({ indexURL: `${resolve('node_modules/pyodide')}/` })
    // Forward slashes: Pyodide derives the package name from the path, and backslashes break it on Windows.
    await py.loadPackage(resolve('vendor/pyodide', NUMPY_WHEEL).replace(/\\/g, '/'), { messageCallback: () => {}, errorCallback: message => { throw new Error(message) } })
    py.runPython(PY_HARNESS)
    py.runPython(PY_FREE_HARNESS)
  }, 180_000)

  it('returns arrays and NumPy scalars as plain JSON', () => {
    const code = 'import numpy as np\ndef f(a, b):\n    m = np.array(a) @ np.array(b)\n    return {"m": m, "trace": np.trace(m), "big": bool(np.all(m > 0)), "n": np.int64(3)}'
    const result = runPython(py, { code, name: 'f', cases: [{ args: [[[1, 2], [3, 4]], [[1, 0], [0, 1]]], expected: { m: [[1, 2], [3, 4]], trace: 5, big: true, n: 3 } }] })
    expect(result).toMatchObject({ kind: 'done', outcomes: [{ pass: true }] })
  })

  it('applies the tolerance to float results', () => {
    const code = 'import numpy as np\ndef f(xs):\n    return np.std(np.array(xs))'
    const cases = [{ args: [[1, 2, 3, 4]], expected: 1.118034 }]
    expect(runPython(py, { code, name: 'f', cases })).toMatchObject({ outcomes: [{ pass: false }] })
    expect(runPython(py, { code, name: 'f', cases, tolerance: { abs: 1e-6 } })).toMatchObject({ outcomes: [{ pass: true }] })
  })

  it('runs NumPy Playground programs', () => {
    expect(runPythonFree(py, { code: 'import numpy as np\nnp.ones(2) * np.arange(2)', stdin: '' })).toMatchObject({ kind: 'done', value: 'array([0., 1.])' })
  })
})
