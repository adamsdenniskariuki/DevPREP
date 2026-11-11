// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { runReactInJsdom } from './react-jsdom'

const COUNTER = `import { useState } from 'react'
export default function App() {
  const [count, setCount] = useState(0)
  console.log('render', count)
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
}`

const COUNTER_TESTS = `import { test, expect, render, screen, click } from './testing'
import App from './App'
test('starts at zero', async () => {
  await render(<App />)
  expect(screen.getByRole('button').textContent).toBe('Clicked 0 times')
})
test('counts clicks', async () => {
  await render(<App />)
  await click(screen.getByRole('button', { name: /Clicked/ }))
  await click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('Clicked 2 times')
})`

describe('React exercise sandbox', () => {
  it('passes a working component, reporting progress and console output', async () => {
    const { result, progress, total } = await runReactInJsdom(COUNTER, COUNTER_TESTS)
    expect(result.kind).toBe('done')
    if (result.kind !== 'done') return
    expect(result.outcomes.map(outcome => [outcome.name, outcome.pass])).toEqual([['App.test.tsx::starts at zero', true], ['App.test.tsx::counts clicks', true]])
    expect(total).toBe(2)
    expect(progress).toEqual([1, 2])
    expect(result.output).toContain('render 0')
    expect(document.getElementById('preview')!.textContent).toBe('Clicked 0 times')
  })

  it('fails a broken component with a readable message', async () => {
    const { result } = await runReactInJsdom(COUNTER.replace('count + 1', 'count'), COUNTER_TESTS)
    if (result.kind !== 'done') throw new Error(result.error)
    expect(result.outcomes.map(outcome => outcome.pass)).toEqual([true, false])
    expect(result.outcomes[1].error).toMatch(/to have text "Clicked 2 times" \(it has "Clicked 0 times"\)/)
  })

  it('stops a runaway loop with a time limit', async () => {
    const app = `export default function App() { return <p>hi</p> }\nexport function spin() { let n = 0; while (true) { n++ } }`
    const tests = `import { test } from './testing'\nimport { spin } from './App'\ntest('spins', () => { spin() })\ntest('after', () => {})`
    const { result } = await runReactInJsdom(app, tests, 300)
    if (result.kind !== 'done') throw new Error(result.error)
    expect(result.outcomes[0].pass).toBe(false)
    expect(result.outcomes[0].error).toMatch(/Time limit exceeded/)
    expect(result.outcomes[1].pass).toBe(true)
  })

  it('times out a test waiting for an update that never comes', async () => {
    const tests = `import { test, waitFor, screen, render, expect } from './testing'\nimport App from './App'\ntest('waits', async () => { await render(<App />); await new Promise(() => {}) })`
    const { result } = await runReactInJsdom(COUNTER, tests, 300)
    if (result.kind !== 'done') throw new Error(result.error)
    expect(result.outcomes[0].error).toMatch(/Timed out after 0.3 s/)
  })

  it('reports syntax errors with positions, and runtime errors, without running', async () => {
    const syntax = await runReactInJsdom('export default function App() { return <p>hi</div> }', COUNTER_TESTS)
    expect(syntax.result.kind).toBe('error')
    expect(syntax.result.diagnostics?.[0]).toMatchObject({ file: 'App.tsx', line: 1 })
    const missing = await runReactInJsdom(`import x from './nope'\nexport default function App() { return <p>{x}</p> }`, COUNTER_TESTS)
    expect(missing.result).toMatchObject({ kind: 'error', error: expect.stringMatching(/Cannot find module '.\/nope'/) })
  })

  it('reports render errors and keeps the network blocked', async () => {
    const app = `import { useState } from 'react'\nexport default function App() { const [n, setN] = useState(0); setN(n + 1); return <p>{n}</p> }\nexport async function load() { return fetch('https://example.com') }`
    const tests = `import { test, render } from './testing'\nimport App, { load } from './App'\ntest('renders', async () => { await render(<App />) })\ntest('fetches', async () => { await load() })`
    const { result } = await runReactInJsdom(app, tests)
    if (result.kind !== 'done') throw new Error(result.error)
    expect(result.outcomes[0].error).toMatch(/Too many re-renders/)
    expect(result.outcomes[1].error).toMatch(/Network access is disabled/)
    expect(typeof globalThis.fetch).toBe('function')
  })
})
