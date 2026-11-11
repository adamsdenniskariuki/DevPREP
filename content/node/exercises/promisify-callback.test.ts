import { promisify, type Callback } from './index'

function divide(a: number, b: number, cb: Callback<number>) {
  setTimeout(() => (b === 0 ? cb(new Error('divide by zero')) : cb(null, a / b)), 0)
}

export async function testResolvesWithValue() {
  assertEqual(await promisify(divide)(10, 4), 2.5)
}

export async function testRejectsWithError() {
  try {
    await promisify(divide)(1, 0)
    assert(false, 'expected a rejection')
  } catch (error) {
    assertEqual((error as Error).message, 'divide by zero')
  }
}

export async function testSynchronousThrowRejects() {
  const broken = (_x: number, _cb: Callback<number>) => { throw new Error('sync boom') }
  try {
    await promisify(broken)(1)
    assert(false, 'expected a rejection')
  } catch (error) {
    assertEqual((error as Error).message, 'sync boom')
  }
}

export async function testUndefinedErrorStillResolves() {
  const ok = (cb: Callback<string>) => cb(undefined, 'done')
  assertEqual(await promisify(ok)(), 'done')
}

export async function testSettlesOnce() {
  const twice = (cb: Callback<number>) => { cb(null, 1); cb(new Error('late')) }
  assertEqual(await promisify(twice)(), 1)
}
