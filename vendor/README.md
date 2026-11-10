# Vendored files

## pyodide/numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl

NumPy 2.4.6 built for Pyodide 314.0.7 (the pinned `pyodide` dependency). The npm package ships the Python runtime but not its package wheels, so this one is kept here and served next to the runtime at `pyodide/<version>/` (see `vite.config.ts`). Math labs, and Playground programs that `import numpy`, load it on demand.

- Source: https://cdn.jsdelivr.net/pyodide/v314.0.7/full/numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl
- Size: 2,960,568 bytes
- SHA-256: `a292c1f5d7d8a2208cd5e94fc467604c131cabcd2fc14fed6eefde121e7fabdf` (the `numpy` entry in `node_modules/pyodide/pyodide-lock.json`; `src/runner/numpy.test.ts` fails if they drift apart)
- Licence: BSD 3-Clause, © NumPy Developers. The text is in [pyodide/NUMPY-LICENSE.txt](pyodide/NUMPY-LICENSE.txt). Licences for components bundled inside NumPy are in the wheel under `numpy-2.4.6.dist-info/licenses/`.

When Pyodide is upgraded, download the `numpy` wheel named in the new `pyodide-lock.json` from the matching `https://cdn.jsdelivr.net/pyodide/v<version>/full/` folder, replace this file and update this note.
